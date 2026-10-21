# Lodestake

**Nine tiles. One winning vein.** A pooled grid game using WBOT. Play a tile, settle the round, and claim your payout.

**Status:** contracts are tested on a BOT Chain mainnet fork; the mainnet deployment is pending.

- Website and app: https://lodestake.vercel.app (app at [`/app/`](https://lodestake.vercel.app/app/))
- Network: BOT Chain mainnet, chain ID 677 · [BOT Chain](https://www.botchain.ai/) · [BOTScan](https://scan.botchain.ai/)

![Lodestake landing page](docs/lodestake-landing-1280.png)

## How it works

1. **Pick a tile.** Choose one of nine tiles and stake WBOT during the two-minute round.
2. **Settle the round.** Anyone requests settlement; a future block hash picks the winning tile.
3. **Claim your share.** Winners split the losing stakes in proportion to their stake, minus a 5% treasury fee.

## Features

- **Open settlement.** Any player can request and finalize a round — no operator needed.
- **Refund safety.** Solo rounds and expired settlements return every stake in full.
- **No house edge staking.** House staking is disabled; players only play against each other.
- **Wrap in place.** Wrap BOT into WBOT right inside the app.

## Contracts

| Contract | BOT Chain mainnet |
|---|---|
| `Lodestake` | Pending mainnet deployment |

BOT Chain infrastructure used: USDT `0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C`, WBOT `0xD5452816194a3784dBa983426cCe7c122F4abd30`, BDEX router `0x07032d47A1b9f8460cBeE9dC17c1d3E438693929`, BDEX QuoterV2 `0x034A705b36067cff99ABf5C662Be881cBd8d0176`.

Source: [`contracts/src`](contracts/src). Tests: [`contracts/test`](contracts/test). The contracts are unaudited; use small amounts.

## Develop

Requires Node 20+, [Foundry](https://getfoundry.sh) and Python 3.

```bash
git clone --recursive https://github.com/David-glitc/lodestake.git
cd lodestake
npm ci
npm test              # forge test
npm run build         # landing page + app into dist/lodestake
npm run preview       # http://127.0.0.1:8771
```

`npm run build` writes `dist/lodestake/index.html` (landing page), `dist/lodestake/app/` (the dApp) and a Cloudflare Workers bundle under `sites/`.

### Wallets

The app discovers installed wallets with EIP-6963 (BO Wallet, MetaMask, OKX, Rabby and others) and falls back to `window.ethereum`. It switches or adds BOT Chain (chain ID `0x2a5`, RPC `https://rpc.botchain.ai`) before any transaction, and simulates every call before asking for a signature.

### Rehearse on a mainnet fork

```bash
anvil --fork-url https://rpc.botchain.ai --port 8677 --chain-id 677
export BOT_RPC_URL=http://127.0.0.1:8677
node scripts/deploy.mjs && node scripts/fork-check.mjs
```

### Deploy

`scripts/deploy.mjs` reads the deployer key from `BOT_SIGNER_FILE` (default `~/.config/botchain-wave1/deployer.env`, never committed), refuses to broadcast on mainnet without `BOT_MAX_GAS_BOT`, and journals every transaction to `deployments/mainnet.json` so it can resume. `npm run publish` deploys the built site to Vercel as a static production deployment.

## License

MIT. Built on [BOT Chain](https://www.botchain.ai/).
