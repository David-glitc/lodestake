// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title Lodestake
/// @notice 3x3 timed grid. Deploy WBOT on tiles. Settlement is commit → wait → multi-source reveal.
///         Fees are owner-settable (capped). Solo/empty-winner refunds use refundFeeBps.
///         Owner/keeper may push claims via claimFor / claimMany and rescueOar.
contract Lodestake {
    uint8 public constant TILE_COUNT = 9;
    uint256 public constant BPS = 10_000;
    /// @dev Hard caps so setters cannot set absurd fees.
    uint256 public constant MAX_FEE_BPS = 2_000; // 20%
    uint256 public constant MAX_REFUND_FEE_BPS = 1_000; // 10%
    /// @dev Blocks after request before finalize (multiple future hashes available).
    uint64 public constant REVEAL_DELAY = 5;
    /// @dev Fixed house budget per seeded round, split across two distinct tiles.
    uint256 public constant HOUSE_SEED_TOTAL = 1_000 ether;
    uint8 public constant HOUSE_SEED_TILE_COUNT = 2;

    IERC20 public immutable stakeToken;
    address public treasury;
    address public owner;
    uint256 public houseReserve;

    /// @dev Competitive fee on losers’ pool (default 5%).
    uint256 public feeBps = 500;
    /// @dev Refund fee on stake (default 0% while liquidity is thin).
    uint256 public refundFeeBps = 0;
    /// @dev Deploy window length (default 120s).
    uint64 public roundDuration = 120;

    uint256 public currentRoundId;

    struct Round {
        uint64 startTime;
        uint64 endTime;
        uint8 winningTile;
        bool settled;
        uint256 totalDeployed;
        uint256 losersPool;
        uint256 feeTaken;
        uint256 winnerPool;
        uint256 winningTileTotal;
        bool settleRequested;
        uint64 requestBlock;
        bytes32 entropySeed;
        bool refundMode;
        uint32 uniquePlayers;
        bytes32 houseEntropy;
        bool houseSeeded;
        uint8 houseTileA;
        uint8 houseTileB;
        uint256 housePayout;
        uint256 refundFeeBpsApplied;
    }

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(uint8 => uint256)) public tileTotals;
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public playerTileDeposits;
    mapping(uint256 => mapping(address => uint256)) public playerRoundTotal;
    mapping(uint256 => mapping(address => bool)) public roundPlayerSeen;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => address[]) internal roundPlayers;

    event RoundStarted(uint256 indexed roundId, uint64 startTime, uint64 endTime);
    event Deployed(
        uint256 indexed roundId, address indexed player, uint8 tile, uint256 amount, bytes32 txHint
    );
    event SettleRequested(uint256 indexed roundId, uint64 requestBlock, bytes32 entropySeed);
    event RoundSettled(
        uint256 indexed roundId,
        uint8 winningTile,
        uint256 losersPool,
        uint256 feeTaken,
        uint256 winnerPool
    );
    event RoundRefunded(
        uint256 indexed roundId,
        uint8 winningTile,
        uint256 totalDeployed,
        uint256 feeTaken,
        uint32 uniquePlayers
    );
    event Claimed(uint256 indexed roundId, address indexed player, uint256 amount);
    event HouseSeeded(uint256 indexed roundId, uint8 tileA, uint8 tileB, uint256 amount);
    event HouseReserveFunded(address indexed from, uint256 amount);
    event HousePayout(uint256 indexed roundId, uint256 amount);
    event TreasuryUpdated(address indexed treasury);
    event FeesUpdated(uint256 feeBps, uint256 refundFeeBps);
    event RoundDurationUpdated(uint64 roundDuration);
    event Rescued(address indexed token, address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error InvalidTile();
    error InvalidAmount();
    error RoundNotOpen();
    error RoundNotEnded();
    error RoundAlreadySettled();
    error RoundNotSettled();
    error NothingToClaim();
    error AlreadyClaimed();
    error AlreadyDeployed();
    error TransferFailed();
    error ZeroAddress();
    error SettleNotRequested();
    error SettleAlreadyRequested();
    error RevealTooEarly();
    error EntropyUnavailable();
    error NotAuthorized();
    error FeeTooHigh();
    error DurationTooShort();
    error HouseReserveTooLow();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address stakeToken_, address treasury_) {
        if (stakeToken_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        stakeToken = IERC20(stakeToken_);
        treasury = treasury_;
        owner = msg.sender;
        _startRound();
    }

    function deploy(uint8 tile, uint256 amount) external {
        if (tile >= TILE_COUNT) revert InvalidTile();
        if (amount == 0) revert InvalidAmount();

        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        if (round.settled || round.settleRequested || block.timestamp >= round.endTime) {
            revert RoundNotOpen();
        }
        if (playerRoundTotal[roundId][msg.sender] > 0) revert AlreadyDeployed();

        if (!stakeToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        tileTotals[roundId][tile] += amount;
        playerTileDeposits[roundId][msg.sender][tile] += amount;
        playerRoundTotal[roundId][msg.sender] += amount;
        round.totalDeployed += amount;

        if (!roundPlayerSeen[roundId][msg.sender]) {
            roundPlayerSeen[roundId][msg.sender] = true;
            round.uniquePlayers += 1;
            roundPlayers[roundId].push(msg.sender);
        }

        emit Deployed(roundId, msg.sender, tile, amount, bytes32(0));
        // No house stake on the BOT Chain port.
    }

    /// @notice Lock a multi-source seed after endTime. Winning tile still unknown.
    function requestSettle() external {
        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        if (block.timestamp < round.endTime) revert RoundNotEnded();
        if (round.settled) revert RoundAlreadySettled();
        if (round.settleRequested) revert SettleAlreadyRequested();

        bytes32 prior = block.number > 0 ? blockhash(block.number - 1) : bytes32(0);
        round.settleRequested = true;
        round.requestBlock = uint64(block.number);
        round.entropySeed = keccak256(
            abi.encodePacked(
                block.prevrandao,
                prior,
                roundId,
                round.totalDeployed,
                round.uniquePlayers,
                round.endTime,
                block.timestamp,
                msg.sender
            )
        );

        emit SettleRequested(roundId, round.requestBlock, round.entropySeed);
    }

    /// @notice Reveal via mixed future blockhashes + live prevrandao (after REVEAL_DELAY).
    function finalizeSettle() external {
        uint256 roundId = currentRoundId;
        Round storage round = rounds[roundId];
        if (!round.settleRequested) revert SettleNotRequested();
        if (round.settled) revert RoundAlreadySettled();
        if (block.number < uint256(round.requestBlock) + REVEAL_DELAY) revert RevealTooEarly();

        if (round.totalDeployed == 0) {
            _settleEmpty(roundId, round);
            return;
        }

        uint256 req = uint256(round.requestBlock);
        // A fixed future block removes settlement caller timing from the result.
        // This is block entropy, not a VRF; validators may influence block hashes.
        uint256 target = req + REVEAL_DELAY - 1;
        if (block.number > target + 256) {
            _settleRefund(roundId, round, 0, 0);
            return;
        }
        bytes32 entropy = blockhash(target);
        if (entropy == bytes32(0)) revert EntropyUnavailable();
        uint256 randomValue = uint256(keccak256(abi.encode(entropy, roundId, address(this))));
        uint8 rawTile = uint8(randomValue % TILE_COUNT);

        // Solo rounds are not competitive. Return the full external stake.
        if (round.uniquePlayers <= 1 && !round.houseSeeded) {
            _settleRefund(roundId, round, rawTile, 0);
            return;
        }

        // Pick the winner only from tiles that carry stake so funded rounds
        // always produce a competitive settlement instead of empty-tile refunds.
        uint8 winningTile = _pickFundedTile(roundId, randomValue);
        _settleCompetitive(roundId, round, winningTile);
    }

    /// @dev Map entropy onto the set of tiles with non-zero stake for this round.
    function _pickFundedTile(uint256 roundId, uint256 rawTile) internal view returns (uint8) {
        uint8 fundedCount = 0;
        uint8[9] memory fundedTiles;
        for (uint8 i = 0; i < TILE_COUNT; i++) {
            if (tileTotals[roundId][i] > 0) {
                fundedTiles[fundedCount] = i;
                fundedCount++;
            }
        }
        if (fundedCount == 0) {
            return uint8(rawTile);
        }
        return fundedTiles[uint8(uint256(rawTile) % fundedCount)];
    }

    /// @dev Seed two deterministic house tiles after the first external player joins.
    ///      The house reserve is funded separately by the owner from the treasury.
    function _seedHouse(uint256 roundId, Round storage round) internal {
        if (round.houseSeeded || round.uniquePlayers == 0 || houseReserve < HOUSE_SEED_TOTAL) {
            return;
        }

        uint8 tileA = uint8(
            uint256(keccak256(abi.encodePacked(round.houseEntropy, roundId, "house-a"))) % TILE_COUNT
        );
        uint8 tileB = uint8(
            uint256(keccak256(abi.encodePacked(round.houseEntropy, roundId, "house-b"))) % TILE_COUNT
        );
        if (tileB == tileA) tileB = uint8((uint256(tileA) + 1) % TILE_COUNT);

        uint256 perTile = HOUSE_SEED_TOTAL / HOUSE_SEED_TILE_COUNT;
        houseReserve -= HOUSE_SEED_TOTAL;
        round.houseSeeded = true;
        round.houseTileA = tileA;
        round.houseTileB = tileB;
        tileTotals[roundId][tileA] += perTile;
        tileTotals[roundId][tileB] += perTile;
        playerTileDeposits[roundId][address(this)][tileA] += perTile;
        playerTileDeposits[roundId][address(this)][tileB] += perTile;
        playerRoundTotal[roundId][address(this)] += HOUSE_SEED_TOTAL;
        round.totalDeployed += HOUSE_SEED_TOTAL;

        emit HouseSeeded(roundId, tileA, tileB, HOUSE_SEED_TOTAL);
    }

    function _settleEmpty(uint256 roundId, Round storage round) internal {
        round.settled = true;
        round.winningTile = TILE_COUNT;
        emit RoundSettled(roundId, TILE_COUNT, 0, 0, 0);
        _startRound();
    }

    function _settleRefund(
        uint256 roundId,
        Round storage round,
        uint8 winningTile,
        uint256 feeBpsApplied
    ) internal {
        uint256 total = round.totalDeployed;
        uint256 fee = (total * feeBpsApplied) / BPS;
        // Persist the revealed vein even on refund so the UI always has a square.
        round.winningTile = winningTile < TILE_COUNT ? winningTile : 0;
        round.settled = true;
        round.refundMode = true;
        round.feeTaken = fee;
        round.winningTileTotal = tileTotals[roundId][round.winningTile];
        round.refundFeeBpsApplied = feeBpsApplied;

        if (fee > 0) {
            if (!stakeToken.transfer(treasury, fee)) revert TransferFailed();
        }

        emit RoundRefunded(roundId, round.winningTile, total, fee, round.uniquePlayers);
        _startRound();
    }

    function _settleCompetitive(uint256 roundId, Round storage round, uint8 winningTile) internal {
        uint256 winningTotal = tileTotals[roundId][winningTile];
        uint256 losers = round.totalDeployed - winningTotal;
        uint256 fee = (losers * feeBps) / BPS;
        uint256 winnerPool = losers - fee;

        round.winningTile = winningTile;
        round.settled = true;
        round.losersPool = losers;
        round.feeTaken = fee;
        round.winnerPool = winnerPool;
        round.winningTileTotal = winningTotal;

        if (fee > 0) {
            if (!stakeToken.transfer(treasury, fee)) revert TransferFailed();
        }

        uint256 houseOnWinner = playerTileDeposits[roundId][address(this)][winningTile];
        if (houseOnWinner > 0) {
            uint256 housePayout = houseOnWinner;
            if (round.winningTileTotal > 0 && round.winnerPool > 0) {
                housePayout += (round.winnerPool * houseOnWinner) / round.winningTileTotal;
            }
            round.housePayout = housePayout;
            if (!stakeToken.transfer(treasury, housePayout)) revert TransferFailed();
            emit HousePayout(roundId, housePayout);
        }

        emit RoundSettled(roundId, winningTile, losers, fee, winnerPool);
        _startRound();
    }

    function settle() external {
        Round storage round = rounds[currentRoundId];
        if (!round.settleRequested) {
            this.requestSettle();
            return;
        }
        this.finalizeSettle();
    }

    function claim(uint256 roundId) external {
        _claim(roundId, msg.sender);
    }

    function claimFor(uint256 roundId, address player) external {
        if (msg.sender != player && msg.sender != owner) revert NotAuthorized();
        _claim(roundId, player);
    }

    function claimMany(uint256 roundId, address[] calldata players) external onlyOwner {
        uint256 len = players.length;
        for (uint256 i = 0; i < len; i++) {
            address player = players[i];
            if (player == address(0)) continue;
            if (claimed[roundId][player]) continue;
            if (pendingClaim(roundId, player) == 0) continue;
            _claim(roundId, player);
        }
    }

    function _claim(uint256 roundId, address player) internal {
        Round storage round = rounds[roundId];
        if (!round.settled) revert RoundNotSettled();
        if (claimed[roundId][player]) revert AlreadyClaimed();

        uint256 payout;
        if (round.refundMode) {
            uint256 stake = playerRoundTotal[roundId][player];
            if (stake == 0) revert NothingToClaim();
            payout = (stake * (BPS - round.refundFeeBpsApplied)) / BPS;
        } else {
            uint256 playerOnWinner = playerTileDeposits[roundId][player][round.winningTile];
            if (playerOnWinner == 0) revert NothingToClaim();
            payout = playerOnWinner;
            if (round.winningTileTotal > 0 && round.winnerPool > 0) {
                payout += (round.winnerPool * playerOnWinner) / round.winningTileTotal;
            }
        }

        claimed[roundId][player] = true;
        if (payout > 0) {
            if (!stakeToken.transfer(player, payout)) revert TransferFailed();
        }
        emit Claimed(roundId, player, payout);
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    function getTileTotals(uint256 roundId) external view returns (uint256[9] memory totals) {
        for (uint8 i = 0; i < TILE_COUNT; i++) {
            totals[i] = tileTotals[roundId][i];
        }
    }

    function getPlayerDeposits(uint256 roundId, address player)
        external
        view
        returns (uint256[9] memory deposits)
    {
        for (uint8 i = 0; i < TILE_COUNT; i++) {
            deposits[i] = playerTileDeposits[roundId][player][i];
        }
    }

    function getRoundPlayers(uint256 roundId) external view returns (address[] memory) {
        return roundPlayers[roundId];
    }

    function pendingClaim(uint256 roundId, address player) public view returns (uint256) {
        Round storage round = rounds[roundId];
        if (!round.settled || claimed[roundId][player]) return 0;

        if (round.refundMode) {
            uint256 stake = playerRoundTotal[roundId][player];
            if (stake == 0) return 0;
            return (stake * (BPS - round.refundFeeBpsApplied)) / BPS;
        }

        uint256 playerOnWinner = playerTileDeposits[roundId][player][round.winningTile];
        if (playerOnWinner == 0) return 0;
        uint256 payout = playerOnWinner;
        if (round.winningTileTotal > 0 && round.winnerPool > 0) {
            payout += (round.winnerPool * playerOnWinner) / round.winningTileTotal;
        }
        return payout;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @notice Owner can update win/refund fee rates within hard caps (no redeploy).
    function setFees(uint256 feeBps_, uint256 refundFeeBps_) external onlyOwner {
        require(rounds[currentRoundId].totalDeployed == 0, "Round funded");
        if (feeBps_ > MAX_FEE_BPS || refundFeeBps_ > MAX_REFUND_FEE_BPS) revert FeeTooHigh();
        feeBps = feeBps_;
        refundFeeBps = refundFeeBps_;
        emit FeesUpdated(feeBps_, refundFeeBps_);
    }

    /// @notice Owner can update deploy window (applies to newly started rounds).
    function setRoundDuration(uint64 roundDuration_) external onlyOwner {
        if (roundDuration_ < 30) revert DurationTooShort();
        roundDuration = roundDuration_;
        emit RoundDurationUpdated(roundDuration_);
    }

    /// @notice Pull the fixed house budget from the current treasury into reserve.
    ///         The treasury must approve this mine before the owner calls it.
    function fundHouseReserve(uint256) external pure { revert("BOT port: house disabled"); }
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(stakeToken), "Cannot withdraw player stakes");
        if(to == address(0)) revert ZeroAddress();
        if(!IERC20(token).transfer(to,amount)) revert TransferFailed();
    }
    function withdrawStakeToken(address, uint256) external pure { revert("Cannot withdraw player stakes"); }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _startRound() internal {
        currentRoundId += 1;
        uint64 start = uint64(block.timestamp);
        uint64 end = start + roundDuration;
        rounds[currentRoundId] = Round({
            startTime: start,
            endTime: end,
            winningTile: TILE_COUNT,
            settled: false,
            totalDeployed: 0,
            losersPool: 0,
            feeTaken: 0,
            winnerPool: 0,
            winningTileTotal: 0,
            settleRequested: false,
            requestBlock: 0,
            entropySeed: bytes32(0),
            refundMode: false,
            uniquePlayers: 0,
            houseEntropy: keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.number > 0 ? blockhash(block.number - 1) : bytes32(0),
                    currentRoundId,
                    start,
                    address(this),
                    "house"
                )
            ),
            houseSeeded: false,
            houseTileA: 0,
            houseTileB: 0,
            housePayout: 0,
            refundFeeBpsApplied: 0
        });
        emit RoundStarted(currentRoundId, start, end);
    }
}
