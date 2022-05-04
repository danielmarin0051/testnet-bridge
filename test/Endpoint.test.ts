import { expect } from "chai";
import { ethers } from "hardhat";
import { Endpoint } from "../typechain";

const SRC_CHAIN_ID = 1;
const ORACLE_ADDRESS = "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec";

describe("Endpoint", function () {
    let Endpoint: Endpoint;
    this.beforeAll(async () => {
        //
    });
    this.beforeEach(async () => {
        Endpoint = await (await ethers.getContractFactory("Endpoint")).deploy(SRC_CHAIN_ID, ORACLE_ADDRESS);
    });
    it("Should be constructed correctly", async function () {
        const chainId = await Endpoint.chainId();
        expect(chainId.toNumber()).to.equal(SRC_CHAIN_ID);

        const oracle = await Endpoint.oracle();
        expect(oracle).to.equal(ORACLE_ADDRESS);
    });
});
