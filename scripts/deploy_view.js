// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {

  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }

  console.log("Deploying LiquidityMiningView...");
  const LiquidityMiningView = await hre.ethers.getContractFactory("LiquidityMiningView");
  const liquidityMiningView = await LiquidityMiningView.deploy();
  await liquidityMiningView.deployed();
  console.log("Deployed LiquidityMiningView:", liquidityMiningView.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
