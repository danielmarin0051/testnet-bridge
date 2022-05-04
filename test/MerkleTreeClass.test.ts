import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { arrayify, keccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { BYTES32_ZERO, TREE_HEIGHT } from "../src/constants";
import { MerkleTree } from "../src/MerkleTree";
import { MerkleTreeMock } from "../typechain";

const VALUE = BYTES32_ZERO;

function generateRandomLeafs(numValues: number): string[] {
    const leafs: string[] = [];
    for (let i = 0; i < numValues; i++) {
        leafs.push(keccak256(arrayify(i === 0 ? VALUE : leafs[i - 1])));
    }
    return leafs;
}

describe("MerkleTreeClass", function () {
    let MerkleTreeClass: MerkleTree;
    let deployer: SignerWithAddress;
    let MerkleTreeMock: MerkleTreeMock;
    this.beforeAll(async () => {
        [deployer] = await ethers.getSigners();
    });
    this.beforeEach(async () => {
        const MerkleTreeMockFactory = await ethers.getContractFactory("MerkleTreeMock");
        MerkleTreeMock = await MerkleTreeMockFactory.deploy();
        await MerkleTreeMock.deployed();

        MerkleTreeClass = new MerkleTree(TREE_HEIGHT);
    });
    it("Has correct height", async () => {
        expect(MerkleTreeClass.height === TREE_HEIGHT);
    });
    it("Mantains the same root", async () => {
        await MerkleTreeMock.insert(VALUE);
        MerkleTreeClass.insert(VALUE, 0);

        const root = await MerkleTreeMock.getRoot();
        const calculatedRoot = MerkleTreeClass.getRoot();

        expect(root).to.equal(calculatedRoot);
    });
    it("Maintains the same root with random leafs", async () => {
        const randomLeafs = generateRandomLeafs(20);
        for (let i = 0; i < randomLeafs.length; i++) {
            await MerkleTreeMock.insert(randomLeafs[i]);
            MerkleTreeClass.insert(randomLeafs[i], i);
        }
        const root = await MerkleTreeMock.getRoot();
        const calculatedRoot = MerkleTreeClass.getRoot();
        expect(root).to.equal(calculatedRoot);
    });
    it("Maintains the same root with random leafs inserted in random order", async () => {
        const randomLeafs = generateRandomLeafs(20);
        for (let i = 0; i < randomLeafs.length; i++) {
            await MerkleTreeMock.insert(randomLeafs[i]);
        }
        const randomLeafsInRandomOrder = randomLeafs
            .map((leaf, index) => ({ leaf, index }))
            .sort((a, b) => Number(a.leaf < b.leaf));

        for (const { leaf, index } of randomLeafsInRandomOrder) {
            MerkleTreeClass.insert(leaf, index);
        }
        const root = await MerkleTreeMock.getRoot();
        const calculatedRoot = MerkleTreeClass.getRoot();
        expect(root).to.equal(calculatedRoot);
    });
    it("Calculates proof correctly", async () => {
        const randomLeafs = generateRandomLeafs(20);
        for (let i = 0; i < randomLeafs.length; i++) {
            await MerkleTreeMock.insert(randomLeafs[i]);
            MerkleTreeClass.insert(randomLeafs[i], i);
        }

        const leafIndex = 15;
        const leaf = randomLeafs[leafIndex];
        const proof = MerkleTreeClass.getProofByIndex(leafIndex);
        const root = MerkleTreeClass.getRoot();

        const isValidProof = await MerkleTreeMock.verifyProof(root, leaf, leafIndex, proof as any);

        expect(isValidProof).to.be.true;
    });
    it("Invalid proof is rejected", async () => {
        const randomLeafs = generateRandomLeafs(20);
        for (let i = 0; i < randomLeafs.length; i++) {
            await MerkleTreeMock.insert(randomLeafs[i]);
            MerkleTreeClass.insert(randomLeafs[i], i);
        }

        const leafIndex = 15;
        const leaf = randomLeafs[leafIndex];
        const proof = MerkleTreeClass.getProofByIndex(leafIndex + 1); // wrong index
        const root = MerkleTreeClass.getRoot();

        const isValidProof = await MerkleTreeMock.verifyProof(root, leaf, leafIndex, proof as any);

        expect(isValidProof).to.be.false;
    });
    it("Adds nodes and proves in random intervals order", async () => {
        const randomLeafs = generateRandomLeafs(20);
        for (let i = 0; i < randomLeafs.length; i++) {
            await MerkleTreeMock.insert(randomLeafs[i]);
            MerkleTreeClass.insert(randomLeafs[i], i);

            // at random intervals with probability 1/3
            if (randomLeafs[i].charCodeAt(0) % 3 === 0) {
                // choose any random leafIndex already inserted and prove it
                const leafIndex = randomLeafs[i].charCodeAt(0) % (i + 1);
                const leaf = randomLeafs[leafIndex];
                const proof = MerkleTreeClass.getProofByIndex(leafIndex);
                const root = MerkleTreeClass.getRoot();

                const isValidProof = await MerkleTreeMock.verifyProof(root, leaf, leafIndex, proof as any);
                expect(isValidProof).to.be.true;
            }
        }
    });
});
