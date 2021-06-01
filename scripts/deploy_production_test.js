// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

const BN = hre.ethers.BigNumber;

async function main() {

  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }

  const secondsPerBlock = 13.2;
  const secondsInHour = 3600;

  const currentBlock = await hre.ethers.provider.getBlockNumber();
  console.log("Current Block: ", currentBlock);
  const startDelay = Math.round((0.5 * secondsInHour) / secondsPerBlock);
  console.log("Start Delay 30min in blocks: ", startDelay);

  const startBlock = currentBlock + startDelay;
  console.log("Start Block: ", startBlock);
  const endBlock = startBlock + Math.round((1 * secondsInHour) / secondsPerBlock);
  console.log("End Block: ", endBlock);

  const duration = endBlock - startBlock;
  console.log("Duration in blocks: ", duration);
  // Config LM
  const rewardPerBlock = "588000000000000"; //0.000588 COMFI
  console.log("Reward per block: ", rewardPerBlock);
  const budget = BN.from(duration).mul(rewardPerBlock).add("1000000000000000000").toString();
  console.log("Budget: ", budget);

  if(endBlock - startBlock !== duration) {
    throw "Incorrect date setup";
  }

  console.log("Deploying TRewardToken...");
  const RewardToken = await hre.ethers.getContractFactory("TRewardToken");
  const rewardToken = await RewardToken.deploy(budget);
  await rewardToken.deployed();
  console.log("Depoyed TRewardToken: ", rewardToken.address);
  const rewardTokenAddress = rewardToken.address;

  // We get the contract to deploy
  console.log("Deploying Reservoir...");
  const Reservoir = await hre.ethers.getContractFactory("Reservoir");
  const reservoir = await Reservoir.deploy();
  await reservoir.deployed();
  console.log("Deployed Reservoir: ", reservoir.address);

  console.log("Topping up Reservoir with budget");
  await rewardToken.transfer(reservoir.address, budget);
  console.log("Topped up Reservoir with budget");

  console.log("Deploying LiquidityMiningView...");
  const LiquidityMiningView = await hre.ethers.getContractFactory("LiquidityMiningView");
  const liquidityMiningView = await LiquidityMiningView.deploy();
  await liquidityMiningView.deployed();
  console.log("Deployed LiquidityMiningView:", liquidityMiningView.address);

  // console.log("Deploying LiquidityMining...");
  const LiquidityMining = await hre.ethers.getContractFactory("LiquidityMining");
  const liquidityMining = await LiquidityMining.deploy(
    rewardTokenAddress,
    reservoir.address,
    rewardPerBlock,
    startBlock,
    endBlock
  );
  await liquidityMining.deployed();
  //const liquidityMining = await LiquidityMining.attach("0x5E8AB4d8b4FE3F6c237A7aB5994b7f0BCB175E27");
  console.log("Deployed LiquidityMining:", liquidityMining.address);

  console.log("Approvig LiquidityMining by Reservour");
  await reservoir.setApprove(
    rewardTokenAddress,
    liquidityMining.address,
    budget
  );

  const addPoolToken = async (poolToken, allocPoint) => {
    console.log("Adding Pool Token ", poolToken, " with allocation ", allocPoint);
    await liquidityMining.add(
      allocPoint,
      poolToken,
      false
    );
  };

  await addPoolToken("0x3eAd43ca1ED431446841e75400215937E2a91Acc", 10); // BTCx5 USDC 1Jun21 LP //https://etherscan.io/address/0x3eAd43ca1ED431446841e75400215937E2a91Acc
  await addPoolToken("0xa06d4b4bdf102cD763A0B47eA47D12FB640FDe4E", 5); // BTCx5 USDC 1Jun21 UP //https://etherscan.io/address/0xa06d4b4bdf102cD763A0B47eA47D12FB640FDe4E
  await addPoolToken("0xD2506366AFd9495be1c87b3762978D6E89FBAd34", 5); // BTCx5 USDC 1Jun21 DOWN //https://etherscan.io/address/0xD2506366AFd9495be1c87b3762978D6E89FBAd34

  await addPoolToken("0xbfB68BedFE44E5a27B5b3931e20ab389D5928405", 10); // ETHx5 USDC 1Jun21 LP
  await addPoolToken("0x2b1B5bD5cC79627f03A43331b4d94C70C8468623", 5); // ETHx5 USDC 1Jun21 UP
  await addPoolToken("0xfC6D44f1aC9b4aA6EC59eaCC89EfC798E2f8807D", 5); // ETHx5 USDC 1Jun21 DOWN

  await addPoolToken("0x2786f6C09f7732681B857216c07C424a6e47e12a", 10); // LINKx5 USDC 1Jun21 LP
  await addPoolToken("0x4172E016e74D0DEbdf35bEbC663491a8ce49fD65", 5); // LINKx5 USDC 1Jun21 UP
  await addPoolToken("0x6c5B8390ad5BDdE8cab444526c3b323396CAeB93", 5); // LINKx5 USDC 1Jun21 DOWN

  await addPoolToken("0xF9444D2411669E47B1e46760d85C45EAc9694884", 10); // UNIx5 USDC 1Jun21 LP
  await addPoolToken("0x0688D04d385A6bCdac9141Ae4d1E3fDFFa5C5009", 5); // UNIx5 USDC 1Jun21 UP
  await addPoolToken("0x8d5FFd8238f2eCcc0845475621119A228b66ccAA", 5); // UNIx5 USDC 1Jun21 DOWN

  await addPoolToken("0xe9C966bc01b4f14c0433800eFbffef4F81540A97", 20); // https://info.uniswap.org/pair/0xe9C966bc01b4f14c0433800eFbffef4F81540A97

  console.log("Setting unlocks...");
  const unlockBlock0 = startBlock;
  const unlockQuota0 = 334;
  console.log(`Set unlocks at ${unlockBlock0} and quota ${unlockQuota0}`);
  const unlockBlock1 = endBlock + startDelay;
  const unlockQuota1 = 333;
  console.log(`Set unlocks at ${unlockBlock1} and quota ${unlockQuota1}`);
  const unlockBlock2 = unlockBlock1 + startDelay;
  const unlockQuota2 = 333;
  console.log(`Set unlocks at ${unlockBlock2} and quota ${unlockQuota2}`);
  await liquidityMining.setUnlocks(
    [unlockBlock0, unlockBlock1, unlockBlock2],
    [unlockQuota0, unlockQuota1, unlockQuota2]
  );
  console.log(`Set unlocks done`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


// npx hardhat verify --constructor-args lm_arguments.js --network mainnet 0x5E8AB4d8b4FE3F6c237A7aB5994b7f0BCB175E27

// lm_arguments.js
// module.exports = ["0xC22e8375F426960E14ef95A1Bb3dDE282d59F130","0x0377F523a360977c5d6d62BCfe0fB431aE4d3447","588000000000000","12365898","12366171"];
