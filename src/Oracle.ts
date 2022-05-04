import { ethers } from "ethers";
import { Endpoint, Endpoint__factory, NexusOracleMock, NexusOracleMock__factory } from "../typechain";
import { abiCoder } from "./utils";

export type OracleConfig = {
    rpcURLSrc: string;
    rpcURLDst: string;
    pollingIntervalSrcInMs: number;
    pollingIntervalDstInMs: number;
    endpointAddressSrc: string;
    endpointAddressDst: string;
    ethPrivateKey: string;
    // oracle
    nexusOracleAddressDst: string;
    oracleUpdateBlockInterval: number;
};

export class Oracle {
    config: OracleConfig;
    EndpointSrc: Endpoint;
    EndpointDst: Endpoint;
    NexusOracleDst: NexusOracleMock;

    constructor(config: OracleConfig) {
        this.config = config;
        const providerSrc = new ethers.providers.JsonRpcProvider(config.rpcURLSrc);
        const providerDst = new ethers.providers.JsonRpcProvider(config.rpcURLDst);
        providerSrc.pollingInterval = config.pollingIntervalSrcInMs;
        providerDst.pollingInterval = config.pollingIntervalDstInMs;
        const signerDst = new ethers.Wallet(config.ethPrivateKey, providerDst);
        this.EndpointSrc = Endpoint__factory.connect(config.endpointAddressSrc, providerSrc);
        this.EndpointDst = Endpoint__factory.connect(config.endpointAddressDst, signerDst); // provider?
        this.NexusOracleDst = NexusOracleMock__factory.connect(config.nexusOracleAddressDst, signerDst);
    }

    listen() {
        this.EndpointSrc.provider.on("block", async (blocknumber: number) => {
            console.log("[Oracle] Listened to new block", blocknumber);
            if (blocknumber % this.config.oracleUpdateBlockInterval !== 0) {
                return;
            }
            console.log("[Oracle] Updating the root");
            const srcBlockNumber = await this.EndpointSrc.provider.getBlockNumber();
            const root = await this.EndpointSrc.treeRoot({ blockTag: srcBlockNumber });
            const calldata = this.EndpointDst.interface.encodeFunctionData("updateRoot", [
                abiCoder.encode(
                    ["uint256", "uint256", "bytes32"],
                    [await this.EndpointSrc.chainId(), srcBlockNumber, root]
                ),
            ]);
            const tx = await this.NexusOracleDst.execute(this.EndpointDst.address, calldata);
            await tx.wait();
            console.log(`[Oracle] Root updated blocknumber: ${blocknumber}, root: ${root}`);
        });
    }

    stopListening() {
        this.EndpointSrc.provider.removeAllListeners();
    }
}
