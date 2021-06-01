// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract RewardDistributor is Ownable {
    using SafeERC20 for IERC20;

    mapping(address => uint256) public rewards;

    address public rewardToken;

    event Claimed(address user, uint256 amount);
    event Withdrawn(uint256 amount);

    constructor(address _rewardToken) {
        rewardToken = _rewardToken;
    }

    function claim() external {
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "Must have rewards to claim");
        rewards[msg.sender] = 0;
        IERC20(rewardToken).transfer(msg.sender, reward);
        emit Claimed(msg.sender, reward);
    }

    function setRewards(address[] calldata _users, uint256[] calldata _rewards)
        external
        onlyOwner
    {
        require(_users.length == _rewards.length, "Must have equal lengths");
        for (uint256 i = 0; i < _users.length; ++i) {
            rewards[_users[i]] = _rewards[i];
        }
    }

    function withdrawEmergency() external onlyOwner {
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        IERC20(rewardToken).transfer(owner(), balance);
        emit Withdrawn(balance);
    }
}
