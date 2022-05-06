import { ethers } from "ethers";
import { Endpoint, Endpoint__factory, NexusOracleMock, NexusOracleMock__factory } from "../typechain";
import { TxManager } from "./TxManager";
import { abiCoder } from "./utils";

export type OracleConfig = {
    rpcURLSrc: string;
    rpcURLDst: string;
    pollingIntervalSrcInMs: number;
    pollingIntervalDstInMs: number;
    endpointAddressSrc: string;
    endpointAddressDst: string;
    nexusOracleAddressDst: string;
    ethPrivateKey: string;
    oracleUpdateBlockInterval: number;
};

export class Oracle {
    config: OracleConfig;
    EndpointSrc: Endpoint;
    EndpointDst: Endpoint;
    NexusOracleDst: NexusOracleMock;
    private txManager: TxManager;

    constructor(config: OracleConfig) {
        this.config = config;
        const providerSrc = new ethers.providers.JsonRpcProvider(config.rpcURLSrc);
        const providerDst = new ethers.providers.JsonRpcProvider(config.rpcURLDst);
        providerSrc.pollingInterval = config.pollingIntervalSrcInMs;
        providerDst.pollingInterval = config.pollingIntervalDstInMs;
        const signerDst = new ethers.Wallet(config.ethPrivateKey, providerDst);
        this.EndpointSrc = Endpoint__factory.connect(config.endpointAddressSrc, providerSrc);
        this.EndpointDst = Endpoint__factory.connect(config.endpointAddressDst, providerDst);
        this.NexusOracleDst = NexusOracleMock__factory.connect(config.nexusOracleAddressDst, signerDst);
        this.txManager = new TxManager({
            signer: signerDst,
            txTimeoutInMs: 15 * 1000,
        });
    }

    async listen() {
        await this.txManager.start();
        this.EndpointSrc.provider.on("block", async (blocknumber: number) => {
            console.log("[Oracle] Listened to new block", blocknumber);
            if (blocknumber % this.config.oracleUpdateBlockInterval !== 0) {
                return;
            }
            const dstBalance = await this.NexusOracleDst.provider.getBalance(
                await this.NexusOracleDst.signer.getAddress()
            );
            console.log(`[Oracle] Updating the root, dstBalance: ${dstBalance}`);
            const srcBlockNumber = await this.EndpointSrc.provider.getBlockNumber();
            const root = await this.EndpointSrc.treeRoot({ blockTag: srcBlockNumber });
            const calldata = this.EndpointDst.interface.encodeFunctionData("updateRoot", [
                abiCoder.encode(
                    ["uint256", "uint256", "bytes32"],
                    [await this.EndpointSrc.chainId(), srcBlockNumber, root]
                ),
            ]);

            const populatedTx = await this.NexusOracleDst.populateTransaction.execute(
                this.EndpointDst.address,
                calldata
            );
            this.txManager.enqueue(populatedTx);

            console.log(`[Oracle] Root updated blocknumber: ${blocknumber}, root: ${root}`);
        });
    }

    async stopListening() {
        await this.txManager.stop();
        this.EndpointSrc.provider.removeAllListeners();
    }
}
