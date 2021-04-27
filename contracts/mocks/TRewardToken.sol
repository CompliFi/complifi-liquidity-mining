// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TRewardToken is ERC20 {
    constructor(uint256 supply) public ERC20("Test Reward Token", "TRT") {
        _mint(msg.sender, supply);
    }
}
