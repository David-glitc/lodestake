// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OarMine} from "../src/OarMine.sol";

contract Cash is ERC20 {constructor() ERC20("Wrapped BOT test fixture","WBOT"){} function mint(address a,uint256 n) external {_mint(a,n);}}
contract OarMineTest is Test {
    address alice=address(0xA11CE);address bob=address(0xB0B);address treasury=address(0x777);
    function setUp() public {vm.deal(alice,100 ether);vm.deal(bob,100 ether);vm.deal(address(this),100 ether);}
    function test_expiredMineReturnsStakesAndOwnerCannotDrain() public {
        Cash c=new Cash();OarMine m=new OarMine(address(c),treasury);
        c.mint(alice,1 ether);c.mint(bob,1 ether);
        vm.startPrank(alice);c.approve(address(m),1 ether);m.deploy(0,1 ether);vm.stopPrank();
        vm.startPrank(bob);c.approve(address(m),1 ether);m.deploy(1,1 ether);vm.stopPrank();
        vm.expectRevert();m.withdrawOar(address(this),0);vm.expectRevert();m.rescueToken(address(c),address(this),1 ether);
        vm.expectRevert();m.setFees(1000,0);
        vm.warp(block.timestamp+121);m.requestSettle();vm.roll(block.number+262);m.finalizeSettle();
        vm.prank(alice);m.claim(1);vm.prank(bob);m.claim(1);assertEq(c.balanceOf(alice),1 ether);assertEq(c.balanceOf(bob),1 ether);
    }
    function test_mineResultDoesNotChangeWithSettlementTimestamp() public {
        Cash c=new Cash();OarMine m=new OarMine(address(c),treasury);c.mint(alice,1 ether);c.mint(bob,1 ether);
        vm.startPrank(alice);c.approve(address(m),1 ether);m.deploy(0,1 ether);vm.stopPrank();
        vm.startPrank(bob);c.approve(address(m),1 ether);m.deploy(1,1 ether);vm.stopPrank();
        vm.warp(block.timestamp+121);m.requestSettle();uint256 target=block.number+4;vm.roll(block.number+6);vm.setBlockhash(target,keccak256("fixed block"));
        uint256 snapshot=vm.snapshotState();m.finalizeSettle();uint8 winner=m.getRound(1).winningTile;
        vm.revertToState(snapshot);vm.warp(block.timestamp+15);vm.prank(bob);m.finalizeSettle();assertEq(m.getRound(1).winningTile,winner);
        vm.prank(winner==0?alice:bob);m.claim(1);assertEq(c.balanceOf(address(m)),0);assertEq(c.balanceOf(treasury),0.05 ether);
    }
}
