import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-web3";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-ganache";
import "hardhat-gas-reporter";
import "solidity-coverage";
import { config as dotEnvConfig } from "dotenv";
dotEnvConfig();

import Web3 from 'web3';

import { HardhatUserConfig } from "hardhat/types";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
// task("accounts", "Prints the list of accounts", async () => {
//   const accounts = await ethers.getSigners();
//
//   for (const account of accounts) {
//     console.log(account.address);
//   }
// });

const web3 = new Web3("");
const gasPrice = web3.utils.toWei(
    web3.utils.toBN(process.env.GAS_PRICE_GWEI || 1),
    "gwei"
);

console.log(parseInt(gasPrice.toString()));

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  gasReporter: {
    currency: 'USD',
    gasPrice: 100
  },
  paths: {
    sources: './contracts',
    tests: './test',
    artifacts: "./artifacts",
    cache: "./cache"
  },
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/_FhcEg_5DvMaewwIWP-3ZsH7HuwejLTP`,
        // url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
        // url: 'http://localhost:8545',
        blockNumber: 12196654
      },
      allowUnlimitedContractSize: false,
      blockGasLimit: 40000000,
      gas: 40000000,
      gasPrice: 'auto',
      loggingEnabled: false,
    },
    development: {
      url: 'http://127.0.0.1:8545',
      blockGasLimit: 40000000,
      gas: 40000000,
      timeout: 1000000,
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 500000,
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
