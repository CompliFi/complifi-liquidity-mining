import { ethers } from 'hardhat';
import { expect } from 'chai';
import { advanceBlockTo, BigNumber as BN } from './utils/index';

const SUPPLY = '100000000000000';
const { waffle } = require('hardhat');
const provider = waffle.provider;
const SPAN = 2000;

describe('RewardDistributor', function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        this.owner = this.signers[0];
        this.receiver = this.signers[1];

        this.RewardToken = await ethers.getContractFactory('TRewardToken');
        this.RewardDistributor = await ethers.getContractFactory('RewardDistributor');
    });

    beforeEach(async function() {
        this.rewardToken = await this.RewardToken.deploy(SUPPLY);
        this.rewardDistributor = await this.RewardDistributor.deploy(this.rewardToken.address);

        this.supply = await this.rewardToken.totalSupply();
        await this.rewardToken.transfer(this.rewardDistributor.address, this.supply);
    });

    it('should withdraw emergently the remaining tokens to owner', async function() {
        expect(await this.rewardToken.balanceOf(this.owner.address)).to.be.equal(0);
        await this.rewardDistributor.withdrawEmergency();
        expect(await this.rewardToken.balanceOf(this.owner.address)).to.be.equal(this.supply);
    });
});
