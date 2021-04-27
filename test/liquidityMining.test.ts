import { ethers } from 'hardhat';
import { expect } from 'chai';
import { advanceBlockTo, BigNumber as BN } from './utils/index';

const SUPPLY = '100000000000000';
const { waffle } = require('hardhat');
const provider = waffle.provider;
const SPAN = 2000;

describe('LiquidityMining', function() {
    before(async function() {
        this.signers = await ethers.getSigners();
        this.minter = this.signers[0];
        this.alice = this.signers[1];
        this.bob = this.signers[2];
        this.carol = this.signers[3];

        this.LiquidityMining = await ethers.getContractFactory('LiquidityMining');
        this.LiquidityMiningView = await ethers.getContractFactory('LiquidityMiningView');
        this.TERC20 = await ethers.getContractFactory('TERC20');
        this.RewardToken = await ethers.getContractFactory('TRewardToken');
        this.Reservoir = await ethers.getContractFactory('Reservoir');
    });

    beforeEach(async function() {
        this.rewardToken = await this.RewardToken.deploy(SUPPLY);
        this.reservoir = await this.Reservoir.deploy();

        this.prepareReservoir = async function() {
            this.supply = await this.rewardToken.totalSupply();
            this.reservoirInitialBalance = this.supply.div(BN.from('2'));
            await this.rewardToken.transfer(this.reservoir.address, this.reservoirInitialBalance);
            await this.reservoir.setApprove(
                this.rewardToken.address,
                this.liquidityMining.address,
                this.supply
            );
        };

        this.checkRewardTokenSpent = async function(rewardToken: any, spentValue: string) {
            const reservoirBalance = await rewardToken.balanceOf(this.reservoir.address);
            expect(this.reservoirInitialBalance.sub(reservoirBalance).toString()).to.equal(
                BN.from(spentValue).toString()
            );
        };
        this.referenceBlock = await provider.getBlockNumber();
        this.UNLOCK0 = this.referenceBlock;
        this.UNLOCK1 = this.referenceBlock + 100 + 100;
        this.UNLOCK2 = this.referenceBlock + 100 + 100 + 100;
    });

    it('should set correct state variables', async function() {
        this.liquidityMining =  await this.LiquidityMining.deploy(
            this.rewardToken.address,
            this.reservoir.address,
            '1000',
            this.referenceBlock,
            this.referenceBlock + 100
        );
        await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
        await this.prepareReservoir();
        const rewardToken = await this.liquidityMining.rewardToken();
        expect(rewardToken).to.equal(this.rewardToken.address);
        expect((await this.liquidityMining.unlocks(0))["block"]).to.equal(this.UNLOCK0);
        expect((await this.liquidityMining.unlocks(1))["block"]).to.equal(this.UNLOCK1);
        expect((await this.liquidityMining.unlocks(2))["block"]).to.equal(this.UNLOCK2);
        expect((await this.liquidityMining.unlocks(0))["quota"]).to.equal(20);
        expect((await this.liquidityMining.unlocks(1))["quota"]).to.equal(40);
        expect((await this.liquidityMining.unlocks(2))["quota"]).to.equal(40);
    });

    context('With ERC/LP token added to the field', function() {
        beforeEach(async function() {
            this.poolToken = await this.TERC20.deploy('LPToken', 'LP', '10000000000');
            await this.poolToken.transfer(this.alice.address, '1000');
            await this.poolToken.transfer(this.bob.address, '1000');
            await this.poolToken.transfer(this.carol.address, '1000');
            this.poolToken2 = await this.TERC20.deploy('LPToken2', 'LP2', '10000000000');
            await this.poolToken2.transfer(this.alice.address, '1000');
            await this.poolToken2.transfer(this.bob.address, '1000');
            await this.poolToken2.transfer(this.carol.address, '1000');
        });

        it('should allow emergency withdraw', async function() {
            // 100 per block farming rate starting at block 100
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock,
                this.referenceBlock + 100
            );
            await this.liquidityMining.deployed();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.liquidityMining.add('100', this.poolToken.address, true);
            await this.poolToken.connect(this.bob).approve(this.liquidityMining.address, '1000');
            await this.liquidityMining.connect(this.bob).deposit(0, '100');
            expect(await this.poolToken.balanceOf(this.bob.address)).to.equal('900');
            await this.liquidityMining.connect(this.bob).withdrawEmergency(0);
            expect(await this.poolToken.balanceOf(this.bob.address)).to.equal('1000');
        });

        it('should give out rewards only after farming time', async function() {
            // 100 per block farming rate starting at block 100
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock + 100,
                this.referenceBlock + 200
            );
            await this.prepareReservoir();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.liquidityMining.add('100', this.poolToken.address, true);
            await this.poolToken.connect(this.bob).approve(this.liquidityMining.address, '1000');
            await this.liquidityMining.connect(this.bob).deposit(0, '100');
            await advanceBlockTo(this.referenceBlock + 89);
            await this.liquidityMining.connect(this.bob).deposit(0, '0'); // block 90
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('0');
            await advanceBlockTo(this.referenceBlock + 94);
            await this.liquidityMining.connect(this.bob).deposit(0, '0'); // block 95
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('0');
            await advanceBlockTo(this.referenceBlock + 99);
            await this.liquidityMining.connect(this.bob).deposit(0, '0'); // block 100
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('0');
            await advanceBlockTo(this.referenceBlock + 100);
            await this.liquidityMining.connect(this.bob).deposit(0, '0'); // block 101
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('100');
            await advanceBlockTo(this.referenceBlock + 104);
            await this.liquidityMining.connect(this.bob).deposit(0, '0'); // block 105
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('500');
        });

        it('should not distribute rewards if no one deposit', async function() {
            // 100 per block farming rate starting at block 200
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock + 100,
                this.referenceBlock + 200
            );
            await this.prepareReservoir();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.liquidityMining.add('100', this.poolToken.address, true);
            await this.poolToken.connect(this.bob).approve(this.liquidityMining.address, '1000');
            await advanceBlockTo(this.referenceBlock + 99);
            expect(await this.rewardToken.balanceOf(this.reservoir.address)).to.equal(
                this.reservoirInitialBalance.toNumber()
            );
            await advanceBlockTo(this.referenceBlock + 104);
            expect(await this.rewardToken.balanceOf(this.reservoir.address)).to.equal(
                this.reservoirInitialBalance.toNumber()
            );
            await advanceBlockTo(this.referenceBlock + 109);
            await this.liquidityMining.connect(this.bob).deposit(0, '10'); // block 110
            expect(await this.rewardToken.balanceOf(this.reservoir.address)).to.equal(
                this.reservoirInitialBalance
            );
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('0');
            expect(await this.poolToken.balanceOf(this.bob.address)).to.equal('990');
            await advanceBlockTo(this.referenceBlock + 119);
            await this.liquidityMining.connect(this.bob).withdraw(0, '10'); // block 120
            await this.checkRewardTokenSpent(this.rewardToken, '1000');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('1000');
            expect(await this.poolToken.balanceOf(this.bob.address)).to.equal('1000');
        });

        it('should distribute rewards properly for each staker', async function() {
            // 100 per block farming rate starting at block 300
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock,
                this.referenceBlock + 100
            );
            await this.prepareReservoir();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.liquidityMining.add('100', this.poolToken.address, true);
            await this.poolToken.connect(this.alice).approve(this.liquidityMining.address, '1000');
            await this.poolToken.connect(this.bob).approve(this.liquidityMining.address, '1000');
            await this.poolToken.connect(this.carol).approve(this.liquidityMining.address, '1000');
            // this.alice deposits 10 LPs at block 1310
            await advanceBlockTo(this.referenceBlock + 19);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            // this.bob deposits 20 LPs at block 314
            await advanceBlockTo(this.referenceBlock + 23);
            await this.liquidityMining.connect(this.bob).deposit(0, '20');
            // this.carol deposits 30 LPs at block 1318
            await advanceBlockTo(this.referenceBlock + 27);
            await this.liquidityMining.connect(this.carol).deposit(0, '30');
            // this.alice deposits 10 more LPs at block 1320. At this point:
            await advanceBlockTo(this.referenceBlock + 29);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            await this.checkRewardTokenSpent(this.rewardToken, '1000');
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('566');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('0');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('0');
            // this.bob withdraws 5 LPs at block 330. At this point:
            await advanceBlockTo(this.referenceBlock + 39);
            await this.liquidityMining.connect(this.bob).withdraw(0, '5');
            await this.checkRewardTokenSpent(this.rewardToken, '2000');
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('566');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('619');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('0');
            // this.alice withdraws 20 LPs at block 1340.
            // this.bob withdraws 15 LPs at block 1350.
            // this.carol withdraws 30 LPs at block 1360.
            await advanceBlockTo(this.referenceBlock + 49);
            await this.liquidityMining.connect(this.alice).withdraw(0, '20');
            await advanceBlockTo(this.referenceBlock + 59);
            await this.liquidityMining.connect(this.bob).withdraw(0, '15');
            await advanceBlockTo(this.referenceBlock + 69);
            await this.liquidityMining.connect(this.carol).withdraw(0, '30');
            await this.checkRewardTokenSpent(this.rewardToken, '5000');
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('1159');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('1183');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('2657');
            // All of them should have 1000 LPs back.
            expect(await this.poolToken.balanceOf(this.alice.address)).to.equal('1000');
            expect(await this.poolToken.balanceOf(this.bob.address)).to.equal('1000');
            expect(await this.poolToken.balanceOf(this.carol.address)).to.equal('1000');
        });

        it('should distribute rewards properly for each staker in the whole tokens', async function() {
            const supply = ethers.utils.parseEther('100000000000000');//.mul("1000000000000000000");

            const rewardToken = await this.RewardToken.deploy(supply);

            // 100 per block farming rate starting at block 300
            this.liquidityMining =  await this.LiquidityMining.deploy(
                rewardToken.address,
                this.reservoir.address,
                ethers.utils.parseEther('100'),
                this.referenceBlock,
                this.referenceBlock + 100
            );

            //await this.prepareReservoir();
            this.supply = await rewardToken.totalSupply();
            this.reservoirInitialBalance = this.supply.div(BN.from('2'));
            await rewardToken.transfer(this.reservoir.address, this.reservoirInitialBalance);
            await this.reservoir.setApprove(
                rewardToken.address,
                this.liquidityMining.address,
                this.supply
            );

            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.liquidityMining.add('100', this.poolToken.address, true);
            await this.poolToken.connect(this.alice).approve(this.liquidityMining.address, '1000');
            await this.poolToken.connect(this.bob).approve(this.liquidityMining.address, '1000');
            await this.poolToken.connect(this.carol).approve(this.liquidityMining.address, '1000');
            // this.alice deposits 10 LPs at block 1310
            await advanceBlockTo(this.referenceBlock + 19);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            // this.bob deposits 20 LPs at block 314
            await advanceBlockTo(this.referenceBlock + 23);
            await this.liquidityMining.connect(this.bob).deposit(0, '20');
            // this.carol deposits 30 LPs at block 1318
            await advanceBlockTo(this.referenceBlock + 27);
            await this.liquidityMining.connect(this.carol).deposit(0, '30');
            // this.alice deposits 10 more LPs at block 1320. At this point:
            await advanceBlockTo(this.referenceBlock + 29);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            await this.checkRewardTokenSpent(rewardToken, ethers.utils.parseEther('1000'));
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('566666666666666666666');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('0');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('0');
            // this.bob withdraws 5 LPs at block 330. At this point:
            await advanceBlockTo(this.referenceBlock + 39);
            await this.liquidityMining.connect(this.bob).withdraw(0, '5');
            await this.checkRewardTokenSpent(rewardToken, ethers.utils.parseEther('2000'));
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('566666666666666666666');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('619047619047619047619');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('0');
            // this.alice withdraws 20 LPs at block 1340.
            // this.bob withdraws 15 LPs at block 1350.
            // this.carol withdraws 30 LPs at block 1360.
            await advanceBlockTo(this.referenceBlock + 49);
            await this.liquidityMining.connect(this.alice).withdraw(0, '20');
            await advanceBlockTo(this.referenceBlock + 59);
            await this.liquidityMining.connect(this.bob).withdraw(0, '15');
            await advanceBlockTo(this.referenceBlock + 69);
            await this.liquidityMining.connect(this.carol).withdraw(0, '30');
            await this.checkRewardTokenSpent(rewardToken, ethers.utils.parseEther('5000'));
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('1160073260073260073259');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('1183150183150183150183');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('2656776556776556776557');
            // All of them should have 1000 LPs back.
            expect(await this.poolToken.balanceOf(this.alice.address)).to.equal('1000');
            expect(await this.poolToken.balanceOf(this.bob.address)).to.equal('1000');
            expect(await this.poolToken.balanceOf(this.carol.address)).to.equal('1000');
        });

        it('should distribute rewards properly for each staker in simple scenario ', async function() {
            // 100 per block farming rate starting at block 300
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock,
                this.referenceBlock + 100
            );
            await this.prepareReservoir();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.liquidityMining.add('100', this.poolToken.address, true);
            await this.poolToken.connect(this.alice).approve(this.liquidityMining.address, '1000');
            await this.poolToken.connect(this.bob).approve(this.liquidityMining.address, '1000');
            await this.poolToken.connect(this.carol).approve(this.liquidityMining.address, '1000');
            // this.alice deposits 10 LPs at block 1310
            await advanceBlockTo(this.referenceBlock + 19);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            // this.bob deposits 20 LPs at block 314
            await advanceBlockTo(this.referenceBlock + 23);
            await this.liquidityMining.connect(this.bob).deposit(0, '20');
            // this.carol deposits 30 LPs at block 1318
            await advanceBlockTo(this.referenceBlock + 27);
            await this.liquidityMining.connect(this.carol).deposit(0, '30');
            // this.alice deposits 10 more LPs at block 1320. At this point:
            await advanceBlockTo(this.referenceBlock + 29);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            await this.checkRewardTokenSpent(this.rewardToken, '1000');
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('566');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('0');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('0');
            // this.bob withdraws 5 LPs at block 330. At this point:
            await advanceBlockTo(this.referenceBlock + 39);
            await this.liquidityMining.connect(this.bob).withdraw(0, '5');
            await this.checkRewardTokenSpent(this.rewardToken, '2000');
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('566');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('619');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('0');
            // this.alice withdraws 20 LPs at block 1340.
            // this.bob withdraws 15 LPs at block 1350.
            // this.carol withdraws 30 LPs at block 1360.
            await advanceBlockTo(this.referenceBlock + 49);
            await this.liquidityMining.connect(this.alice).withdraw(0, '20');
            await advanceBlockTo(this.referenceBlock + 59);
            await this.liquidityMining.connect(this.bob).withdraw(0, '15');
            await advanceBlockTo(this.referenceBlock + 69);
            await this.liquidityMining.connect(this.carol).withdraw(0, '30');
            await this.checkRewardTokenSpent(this.rewardToken, '5000');
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal('1159');
            expect(await this.liquidityMining.rewards(this.bob.address)).to.equal('1183');
            expect(await this.liquidityMining.rewards(this.carol.address)).to.equal('2657');
            // All of them should have 1000 LPs back.
            expect(await this.poolToken.balanceOf(this.alice.address)).to.equal('1000');
            expect(await this.poolToken.balanceOf(this.bob.address)).to.equal('1000');
            expect(await this.poolToken.balanceOf(this.carol.address)).to.equal('1000');
        });

        it('should give proper rewards allocation to each pool', async function() {
            // 100 per block farming rate starting at block 1400
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock,
                this.referenceBlock + 100
            );
            await this.prepareReservoir();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.poolToken.connect(this.alice).approve(this.liquidityMining.address, '1000');
            await this.poolToken2.connect(this.bob).approve(this.liquidityMining.address, '1000');

            expect(await this.liquidityMining.isTokenAdded(this.poolToken.address)).to.equal(false);
            // Add first LP to the pool with allocation 1
            await this.liquidityMining.add('10', this.poolToken.address, true);
            expect(await this.liquidityMining.isTokenAdded(this.poolToken.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken.address)).to.equal('0');

            // this.alice deposits 10 LPs at block 1410
            await advanceBlockTo(this.referenceBlock + 19);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');

            // Add LP2 to the pool with allocation 2 at block 1420
            await advanceBlockTo(this.referenceBlock + 29);
            expect(await this.liquidityMining.isTokenAdded(this.poolToken2.address)).to.equal(false);
            await this.liquidityMining.add('20', this.poolToken2.address, true);
            expect(await this.liquidityMining.isTokenAdded(this.poolToken.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken.address)).to.equal('0');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken2.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken2.address)).to.equal('1');
            // this.alice should have 10*100 pending reward
            expect((await this.liquidityMining.getPendingReward(0, this.alice.address))["total"]).to.equal('1000');
            // this.bob deposits 10 LP2s at block 425
            await advanceBlockTo(this.referenceBlock + 34);
            await this.liquidityMining.connect(this.bob).deposit(1, '5');
            // this.alice should have 1000 + 5*1/3*1000 = 2666 pending reward
            expect((await this.liquidityMining.getPendingReward(0, this.alice.address))["total"]).to.equal('1166');
            await advanceBlockTo(this.referenceBlock + 40);
            // At block 430. this.bob should get 5*2/3*1000 = 3333. this.alice should get ~1666 more.
            expect((await this.liquidityMining.getPendingReward(0, this.alice.address))["total"]).to.equal('1333');
            expect((await this.liquidityMining.getPendingReward(1, this.bob.address))["total"]).to.equal('333');
            this.poolToken3 = await this.TERC20.deploy('LPToken3', 'LP3', '10000000000');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken3.address)).to.equal(false);
            await this.liquidityMining.add('20', this.poolToken3.address, true);
            expect(await this.liquidityMining.isTokenAdded(this.poolToken.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken.address)).to.equal('0');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken2.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken2.address)).to.equal('1');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken3.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken3.address)).to.equal('2');

            this.poolToken4 = await this.TERC20.deploy('LPToken4', 'LP4', '10000000000');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken4.address)).to.equal(false);
            await this.liquidityMining.add('20', this.poolToken4.address, true);
            expect(await this.liquidityMining.isTokenAdded(this.poolToken.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken.address)).to.equal('0');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken2.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken2.address)).to.equal('1');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken3.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken3.address)).to.equal('2');
            expect(await this.liquidityMining.isTokenAdded(this.poolToken4.address)).to.equal(true);
            expect(await this.liquidityMining.poolPidByAddress(this.poolToken4.address)).to.equal('3');
        });

        it('should stop giving bonus rewards after the bonus period ends', async function() {
            this.UNLOCK0 = this.referenceBlock;
            this.UNLOCK1 = this.referenceBlock + 1000 + 100;
            this.UNLOCK2 = this.referenceBlock + 1000 + 100 + 100;

            // 100 per block farming rate starting at block 1500
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock,
                this.referenceBlock + 1000
            );
            await this.prepareReservoir();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.poolToken.connect(this.alice).approve(this.liquidityMining.address, '1000');
            await this.liquidityMining.add('1', this.poolToken.address, true);
            // this.alice deposits 10 LPs at block 1590
            await advanceBlockTo(this.referenceBlock + 99);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            // At block 605, she should have 100*15 = 1500 pending.
            await advanceBlockTo(this.referenceBlock + 115);
            await this.liquidityMining.connect(this.alice).claim();
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal((115 - 99) * 100);
            // At block 606, this.alice withdraws all pending rewards and should get 1600.
            await this.liquidityMining.connect(this.alice).deposit(0, '0');
            expect(await this.liquidityMining.rewards(this.alice.address)).to.equal(((115 - 99)+1) * 100);
        });

        it('should be able to claim non-locked and locked rewards correctly after unlocks', async function() {
            this.UNLOCK0 = this.referenceBlock;
            this.UNLOCK1 = this.referenceBlock + SPAN + 100;
            this.UNLOCK2 = this.referenceBlock + SPAN + 100 + 100;

            // 100 per block farming rate starting at block 1500
            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '100',
                this.referenceBlock,
                this.referenceBlock + SPAN
            );
            await this.prepareReservoir();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.poolToken.connect(this.alice).approve(this.liquidityMining.address, '1000');
            await this.liquidityMining.add('1', this.poolToken.address, true);
            await this.liquidityMining.connect(this.alice).deposit(0, '10');
            await advanceBlockTo(this.referenceBlock + SPAN/2);
            await this.liquidityMining.connect(this.alice).claim();
            expect(await this.rewardToken.balanceOf(this.alice.address)).to.equal('19720');
            await advanceBlockTo(this.UNLOCK1);
            await this.liquidityMining.connect(this.alice).withdraw(0, '10');
            expect(await this.poolToken.balanceOf(this.alice.address)).to.equal('1000');
            await this.liquidityMining.connect(this.alice).claim();
            expect(await this.rewardToken.balanceOf(this.alice.address)).to.equal('119100');
            await advanceBlockTo(this.UNLOCK2);
            await this.liquidityMining.connect(this.alice).claim();
            expect(await this.rewardToken.balanceOf(this.alice.address)).to.equal('198500');
        });

        it('should return data by LiquidityMiningView', async function() {
            this.liquidityMiningView =  await this.LiquidityMiningView.deploy();
            await this.liquidityMiningView.deployed();

            this.liquidityMining =  await this.LiquidityMining.deploy(
                this.rewardToken.address,
                this.reservoir.address,
                '1000',
                this.referenceBlock,
                this.referenceBlock + 100
            );
            await this.liquidityMining.deployed();
            await this.liquidityMining.setUnlocks([this.UNLOCK0, this.UNLOCK1, this.UNLOCK2], [20,40,40]);
            await this.prepareReservoir();
            await this.liquidityMining.add('50', this.poolToken.address, false);
            await this.liquidityMining.add('50', this.poolToken2.address, false);

            expect(await this.liquidityMining.totalAllocPoint()).to.equal('100');

            const liquidityMiningInfo = await this.liquidityMiningView.getLiquidityMiningInfo(this.liquidityMining.address);
            expect(liquidityMiningInfo["rewardToken"]).to.equal(this.rewardToken.address);
            expect(liquidityMiningInfo["reservoir"]).to.equal(this.reservoir.address);
            expect(liquidityMiningInfo["rewardPerBlock"]).to.equal('1000');
            expect(liquidityMiningInfo["startBlock"]).to.equal(this.referenceBlock);
            expect(liquidityMiningInfo["endBlock"]).to.equal(this.referenceBlock + 100);
            expect(liquidityMiningInfo["pools"].length).to.equal(2);
            expect(liquidityMiningInfo["unlocks"].length).to.equal(3);

            expect(await this.liquidityMining.unlocksTotalQuotation()).to.equal(20+40+40);

            const liquidityUserRewardInfos = await this.liquidityMiningView.getUserRewardInfos(this.liquidityMining.address, this.alice.address);
        });
    });
});
