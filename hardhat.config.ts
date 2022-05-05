import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

import "hardhat-abi-exporter";
import { MUMBAI_URL, PRIVATE_KEY, RINKEBY_URL } from "./src/keys";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (const account of accounts) {
        console.log(account.address);
    }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
    solidity: "0.8.4",
    networks: {
        rinkeby: {
            url: "https://rinkeby.infura.io/v3/52d51a0ba80c4d6fbdf4b7ee953692e9",
            accounts: [PRIVATE_KEY],
        },
        // ropsten: {
        //     url: ROPSTEN_URL,
        //     accounts: [PRIVATE_KEY],
        // },
        mumbai: {
            url: MUMBAI_URL,
            accounts: [PRIVATE_KEY],
        },
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS !== undefined,
        currency: "USD",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    abiExporter: {
        path: "./typechain/abi",
        runOnCompile: true,
        clear: true,
        flat: true,
        spacing: 2,
    },
};

export default config;
