import { ethers } from "ethers";

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const abiCoder = ethers.utils.defaultAbiCoder;
