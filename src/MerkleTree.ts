import { BYTES32_ZERO } from "./constants";
import { arrayify, solidityKeccak256 } from "ethers/lib/utils";

export type Bytes32 = string;

export class MerkleTree {
    public height: number;
    public tree: Bytes32[][];
    public zeroHashes: Bytes32[];
    public dirty: boolean = true;

    constructor(height: number) {
        this.height = height;
        this.tree = [];
        for (let i = 0; i <= height; i++) {
            this.tree.push([]);
        }
        this.zeroHashes = MerkleTree.generateZeroHashes(height);
    }

    getRoot(): Bytes32 {
        if (this.dirty) this.calculateBranches();
        return this.tree[this.height][0];
    }

    insert(leaf: Bytes32, index: number) {
        this.dirty = true;
        this.tree[0][index] = leaf;
    }

    calculateBranches() {
        for (let i = 0; i < this.height; i++) {
            const parent = this.tree[i + 1];
            const child = this.tree[i];
            for (let j = 0; j < child.length; j += 2) {
                const leftNode = child[j];
                const rightNode = j + 1 < child.length ? child[j + 1] : this.zeroHashes[i];
                parent[Math.floor(j / 2)] = MerkleTree.keccak256LeftRight(leftNode, rightNode);
            }
        }
        this.dirty = false;
    }

    getProofByValue(value: Bytes32): Bytes32[] {
        const index = this.tree[0].indexOf(value);
        if (index === -1) throw new Error("Value not in tree");
        return this.getProofByIndex(index);
    }

    getProofByIndex(index: number): Bytes32[] {
        if (this.dirty) this.calculateBranches();
        const proof: Bytes32[] = [];
        for (let i = 0; i < this.height; i++) {
            index = index % 2 === 1 ? index - 1 : index + 1;
            if (index < this.tree[i].length) {
                proof.push(this.tree[i][index]);
            } else {
                proof.push(this.zeroHashes[i]);
            }
            index = Math.floor(index / 2);
        }
        return proof;
    }

    static generateZeroHashes(height: number): Bytes32[] {
        const zeroHashes: Bytes32[] = [];
        for (let i = 0; i < height; i++) {
            zeroHashes.push(BYTES32_ZERO);
        }
        for (let i = 0; i < height - 1; i++) {
            zeroHashes[i + 1] = MerkleTree.keccak256LeftRight(zeroHashes[i], zeroHashes[i]);
        }
        return zeroHashes;
    }

    static keccak256LeftRight(left: Bytes32, right: Bytes32): Bytes32 {
        return solidityKeccak256(["bytes32", "bytes32"], [arrayify(left), arrayify(right)]);
    }

    static fromLeaves(leaves: Bytes32[], height: number): MerkleTree {
        const tree = new MerkleTree(height);
        for (let i = 0; i < leaves.length; i++) {
            tree.insert(leaves[i], i);
        }
        return tree;
    }
}
