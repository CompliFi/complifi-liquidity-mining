const TRewardToken = artifacts.require("TRewardToken");
const RewardDistributor = artifacts.require("RewardDistributor");

const data = require("./../scripts/distributor/rewards_contract.json");

const paused = parseInt( process.env.DELAY_MS || "80000" );

const delay = require('delay');
const wait = async (param) => { console.log("Delay " + paused); await delay(paused); return param;};

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await wait();

    const BN = web3.utils.toBN;

    const budget = BN(50000).mul(BN((10**18).toString())).toString();

    let rewardTokenAddress = "0x752efadc0a7e05ad1bcccda22c141d01a75ef1e4"; // https://etherscan.io/token/0x752efadc0a7e05ad1bcccda22c141d01a75ef1e4
    console.log("RewardToken address: ", rewardTokenAddress);

    let rewardToken;
    if(network === 'rinkeby') {
      console.log("Deploying TRewardToken...");
      await wait(await deployer.deploy(TRewardToken, budget));
      rewardToken = await TRewardToken.deployed();
      console.log("Depoyed TRewardToken: ", rewardToken.address);
      rewardTokenAddress = rewardToken.address;
    }

    console.log("Deploying RewardDistributor...");
    await wait(await deployer.deploy(RewardDistributor, rewardTokenAddress));
    const rewardDistributor = await RewardDistributor.deployed();
    console.log("Deployed RewardDistributor:", rewardDistributor.address);

    if(network === 'rinkeby') {
      console.log("Topping up RewardDistributor with budget");
      await wait(await rewardToken.transfer(rewardDistributor.address, budget));
      console.log("Topped up RewardDistributor with budget");
    }

    console.log("Setting RewardDistributor with params");
    await wait(await rewardDistributor.setRewards(data.users, data.rewards));
    console.log("Set RewardDistributor with params");

    console.log("Done!");
  });
};
