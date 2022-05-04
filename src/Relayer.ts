import { ethers } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import EventEmitter from "events";
import { Endpoint, Endpoint__factory } from "../typechain";
import { abiCoder } from "./utils";
import { TREE_HEIGHT } from "./constants";
import { MerkleTree } from "./MerkleTree";
import { MerkleProof32 } from "./types";
import { TxManager } from "./TxManager";

export type RelayerConfig = {
    rpcURLSrc: string;
    rpcURLDst: string;
    ethPrivateKey: string;
    endpointAddressSrc: string;
    endpointAddressDst: string;
    pollingIntervalSrcInMs: number;
    pollingIntervalDstInMs: number;
};

export type Packet = {
    srcChainId: ethers.BigNumber;
    dstChainId: ethers.BigNumber;
    srcAddress: string;
    dstAddress: string;
    nonce: ethers.BigNumber;
    fee: ethers.BigNumber;
    message: string;
};

export class Relayer {
    public config: RelayerConfig;
    public EndpointSrc: Endpoint;
    public EndpointDst: Endpoint;

    private srcChainId: ethers.BigNumber;

    private isInitialized: boolean = false;

    private txManager: TxManager;

    constructor(config: RelayerConfig) {
        this.config = config;
        const providerSrc = new ethers.providers.JsonRpcProvider(config.rpcURLSrc);
        const providerDst = new ethers.providers.JsonRpcProvider(config.rpcURLDst);
        providerSrc.pollingInterval = config.pollingIntervalSrcInMs;
        providerDst.pollingInterval = config.pollingIntervalDstInMs;
        const signerDst = new ethers.Wallet(config.ethPrivateKey, providerDst);
        this.EndpointSrc = Endpoint__factory.connect(config.endpointAddressSrc, providerSrc);
        this.EndpointDst = Endpoint__factory.connect(config.endpointAddressDst, signerDst);
        this.srcChainId = ethers.BigNumber.from(0);

        this.txManager = new TxManager({
            signer: this.EndpointDst.signer,
            txTimeoutInMs: 15 * 1000,
        });
    }

    async init() {
        this.srcChainId = await this.EndpointSrc.chainId();
        this.isInitialized = true;
    }

    async listen() {
        if (!this.isInitialized) throw new Error("[Relayer] Not initialized");
        await this.txManager.start();

        this.EndpointSrc.on(
            this.EndpointSrc.filters.MessageSent(),
            async (dstChainId, srcAddress, dstAddress, nonce, fee, message, packetHash, event) => {
                const { blockNumber: messageBlocknumber } = event;

                const decodedPacket: Packet = {
                    srcChainId: this.srcChainId,
                    dstChainId,
                    srcAddress,
                    dstAddress,
                    nonce,
                    fee,
                    message,
                };

                console.log("[Relayer] Listened to message:", decodedPacket, { packetHash, messageBlocknumber });

                // wait for Oracle to relay root
                console.log("[Relayer] Waiting for oracle");

                await Promise.resolve(
                    new Promise<void>(async (resolve) => {
                        const latestRootBlocknumber = await this.EndpointDst.getRootBlocknumber(this.srcChainId);
                        if (latestRootBlocknumber.toNumber() >= messageBlocknumber) resolve();
                        const self = this;
                        this.EndpointDst.on(
                            this.EndpointDst.filters.RootUpdated(),
                            function listener(srcChainId, blocknumber, root) {
                                if (blocknumber.toNumber() >= messageBlocknumber) {
                                    self.EndpointDst.removeListener(
                                        self.EndpointDst.filters.RootUpdated(),
                                        listener as any
                                    );
                                    resolve();
                                }
                            }
                        );
                    })
                );

                console.log(`[Relayer] Generating proof for message ${nonce}`);

                // generate proof
                const latestRootBlocknumber = await this.EndpointDst.getRootBlocknumber(this.srcChainId);
                const packet = this.encodeMessage(decodedPacket);
                const { proof, index } = await this.generateProof(decodedPacket, latestRootBlocknumber.toNumber());

                // TODO: If not profitable return

                // await this.EndpointDst.process(packet, proof, index);
                const populatedTx = await this.EndpointDst.populateTransaction.process(packet, proof, index);
                // console.log("[Relayer]", { populatedTx, signer: this.EndpointDst.signer });
                // const tx = await this.EndpointDst.signer.sendTransaction(populatedTx);
                // await tx.wait();
                this.txManager.enqueue(populatedTx);

                console.log(`[Relayer] Message ${nonce} added to tx queue`);
            }
        );
    }

    async stopListening() {
        console.log("[Relayer] Waiting for txManager to stop");
        await this.txManager.stop();
        console.log("[Relayer] TxManager stopped");
        this.EndpointSrc.removeAllListeners();
    }

    // -- Helpers --

    private encodeMessage(packet: Packet): string {
        const { srcChainId, dstChainId, srcAddress, dstAddress, nonce, fee, message } = packet;
        return abiCoder.encode(
            ["uint", "uint", "address", "address", "uint", "uint", "bytes"],
            [srcChainId, dstChainId, srcAddress, dstAddress, nonce, fee, message]
        );
    }

    private async generateProof(
        packet: Packet,
        messageBlocknumber: number
    ): Promise<{ proof: MerkleProof32; index: number }> {
        const index = packet.nonce.toNumber();

        const events = await this.EndpointSrc.queryFilter(
            this.EndpointSrc.filters.MessageSent(),
            0,
            messageBlocknumber
        );

        const leaves = events.map((event) => {
            const { dstChainId, srcAddress, dstAddress, nonce, fee, message } = event.args;
            const decodedPacket: Packet = {
                srcChainId: this.srcChainId,
                dstChainId,
                srcAddress,
                dstAddress,
                nonce,
                fee,
                message,
            };
            const packet = this.encodeMessage(decodedPacket);
            const packetHash = keccak256(packet);
            return packetHash;
        });

        // generate tree
        const tree = MerkleTree.fromLeaves(leaves, TREE_HEIGHT);

        // get proof
        const proof = tree.getProofByIndex(index);

        console.log({ leaves, root: tree.getRoot() });

        return { proof: proof as MerkleProof32, index };
    }
}
