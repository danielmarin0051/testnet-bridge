import { ethers } from "ethers";
import { Endpoint__factory } from "../../typechain";
import { MUMBAI_URL, PRIVATE_KEY, RINKEBY_URL } from "../keys";
import { Oracle } from "../Oracle";
import { Relayer } from "../Relayer";

const SRC_RPC_URL = RINKEBY_URL;
const DST_RPC_URL = MUMBAI_URL;

const POLLING_INTERVAL_SRC_IN_MS = 1000;
const POLLING_INTERVAL_DST_IN_MS = 1000;

const ENDPOINT_SRC_ADDRESS = "0xCf3A5386c54712E11d62D994f8a0a3B40195b2f7";
const ENDPOINT_DST_ADDRESS = "0xD19F1ad3539e845a7a8A37827788309A08E53402";
const ORACLE_ADDRESS_DST = "0x4F3cf5E11828B460b7Fae5Ed7c9226DEbDf56d62";

const blockUpdateInterval = 4;

async function main() {
    const providerSrc = new ethers.providers.JsonRpcProvider(SRC_RPC_URL);
    const providerDst = new ethers.providers.JsonRpcProvider(DST_RPC_URL);

    const { chainId: srcChainId } = await providerSrc.getNetwork();
    const { chainId: dstChainId } = await providerDst.getNetwork();

    console.log(`Running oracle ${srcChainId} -> ${dstChainId}, blockUpdateInterval: ${blockUpdateInterval}`);
    console.log(`Running relayer ${srcChainId} -> ${dstChainId}`);

    const oracle = new Oracle({
        rpcURLSrc: SRC_RPC_URL,
        rpcURLDst: DST_RPC_URL,
        ethPrivateKey: PRIVATE_KEY,
        endpointAddressSrc: ENDPOINT_SRC_ADDRESS,
        endpointAddressDst: ENDPOINT_DST_ADDRESS,
        nexusOracleAddressDst: ORACLE_ADDRESS_DST,
        pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
        pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
        oracleUpdateBlockInterval: blockUpdateInterval,
    });

    const relayer = new Relayer({
        rpcURLSrc: SRC_RPC_URL,
        rpcURLDst: DST_RPC_URL,
        ethPrivateKey: PRIVATE_KEY,
        endpointAddressSrc: ENDPOINT_SRC_ADDRESS,
        endpointAddressDst: ENDPOINT_DST_ADDRESS,
        pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
        pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
    });

    await relayer.init();

    await oracle.listen();

    await relayer.listen();
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
