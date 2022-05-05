import { ethers } from "hardhat";

async function main() {
    const { chainId } = await ethers.provider.getNetwork();
    console.log(`Deploying Endpoint & Oracle on chainId: ${chainId}`);

    const [deployer] = await ethers.getSigners();
    const balance = await deployer.getBalance();
    console.log(`Deployer: ${deployer.address}, balance: ${balance}`);

    const Oracle = await (await ethers.getContractFactory("NexusOracleMock")).deploy();
    await Oracle.deployed();
    console.log(`Oracle deployed to ${Oracle.address}`);

    const Endpoint = await (await ethers.getContractFactory("Endpoint")).deploy(chainId, Oracle.address);
    await Endpoint.deployed();
    console.log(`Endpoint deployed to ${Endpoint.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
