import { ethers } from "hardhat";

const ENDPOINT_ADDRESS = "0xD19F1ad3539e845a7a8A37827788309A08E53402";

async function main() {
    const { chainId } = await ethers.provider.getNetwork();
    console.log(`Deploying Receiver on chainId: ${chainId}, with ENDPOINT_ADDRESS: ${ENDPOINT_ADDRESS}`);

    const [deployer] = await ethers.getSigners();
    const balance = await deployer.getBalance();
    console.log(`Deployer: ${deployer.address}, balance: ${balance}`);

    const Receiver = await (await ethers.getContractFactory("ReceiverMock")).deploy(ENDPOINT_ADDRESS);
    await Receiver.deployed();
    console.log(`Receiver deployed to ${Receiver.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
