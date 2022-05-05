import { expect } from "chai";
import { ethers } from "ethers";
import {
    Endpoint,
    Endpoint__factory,
    NexusOracleMock,
    NexusOracleMock__factory,
    ReceiverMock,
    ReceiverMock__factory,
} from "../../typechain";
import { Oracle } from "../Oracle";
import { Relayer } from "../Relayer";
import { PRIVATE_KEYS, RPC_URL_CHAIN_A, RPC_URL_CHAIN_B } from "../test_utils";
import { abiCoder, sleep } from "../utils";

const SRC_CHAIN_ID = 1;
const DST_CHAIN_ID = 2;

const SRC_RPC_URL = RPC_URL_CHAIN_A;
const DST_RPC_URL = RPC_URL_CHAIN_B;

const POLLING_INTERVAL_SRC_IN_MS = 200;
const POLLING_INTERVAL_DST_IN_MS = 200;

describe("e2e", function () {
    let providerSrc: ethers.providers.JsonRpcProvider;
    let providerDst: ethers.providers.JsonRpcProvider;

    let deployerSrc: ethers.Wallet;
    let deployerDst: ethers.Wallet;

    let EndpointSrc: Endpoint;
    let EndpointDst: Endpoint;
    let NexusOracleSrc: NexusOracleMock;
    let NexusOracleDst: NexusOracleMock;
    let Receiver: ReceiverMock;

    this.beforeAll(async () => {
        providerSrc = new ethers.providers.JsonRpcProvider(SRC_RPC_URL);
        providerDst = new ethers.providers.JsonRpcProvider(DST_RPC_URL);

        providerSrc.pollingInterval = POLLING_INTERVAL_SRC_IN_MS;
        providerDst.pollingInterval = POLLING_INTERVAL_DST_IN_MS;

        deployerSrc = new ethers.Wallet(PRIVATE_KEYS[0], providerSrc);
        deployerDst = new ethers.Wallet(PRIVATE_KEYS[0], providerDst);
    });

    this.beforeEach(async () => {
        NexusOracleSrc = await new NexusOracleMock__factory(deployerSrc).deploy();
        NexusOracleDst = await new NexusOracleMock__factory(deployerDst).deploy();
        EndpointSrc = await new Endpoint__factory(deployerSrc).deploy(SRC_CHAIN_ID, NexusOracleSrc.address);
        EndpointDst = await new Endpoint__factory(deployerDst).deploy(DST_CHAIN_ID, NexusOracleDst.address);
        Receiver = await new ReceiverMock__factory(deployerDst).deploy(EndpointDst.address);
    });

    // it("works for a single message", async function () {
    //     // setup constants
    //     const blockMiningTimeInMs = POLLING_INTERVAL_SRC_IN_MS * 2;
    //     const blockUpdateInterval = 1;
    //     // const blockUpdateEpochs = 2;
    //     // this.timeout(blockUpdateInterval * blockUpdateEpochs * blockMiningTimeInMs + 2000);

    //     // advance blocknumber
    //     while ((await providerSrc.getBlockNumber()) % blockUpdateInterval !== 0) {
    //         await providerSrc.send("evm_mine", []);
    //     }
    //     await providerSrc.send("evm_mine", []);
    //     if (blockUpdateInterval !== 1) {
    //         expect((await providerSrc.getBlockNumber()) % blockUpdateInterval === 1).to.be.true;
    //     }

    //     // create relayer and oracle nodes

    //     const relayer = new Relayer({
    //         rpcURLSrc: SRC_RPC_URL,
    //         rpcURLDst: DST_RPC_URL,
    //         ethPrivateKey: PRIVATE_KEYS[0],
    //         endpointAddressSrc: EndpointSrc.address,
    //         endpointAddressDst: EndpointDst.address,
    //         pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
    //         pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
    //     });
    //     await relayer.init();
    //     const oracle = new Oracle({
    //         rpcURLSrc: SRC_RPC_URL,
    //         rpcURLDst: DST_RPC_URL,
    //         ethPrivateKey: PRIVATE_KEYS[0],
    //         endpointAddressSrc: EndpointSrc.address,
    //         endpointAddressDst: EndpointDst.address,
    //         nexusOracleAddressDst: NexusOracleDst.address,
    //         pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
    //         pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
    //         oracleUpdateBlockInterval: blockUpdateInterval,
    //     });

    //     relayer.listen();
    //     oracle.listen();

    //     const message = `hello`;
    //     const encodedMessage = abiCoder.encode(["string"], [message]);
    //     await EndpointSrc.send(DST_CHAIN_ID, Receiver.address, encodedMessage);
    //     await sleep(blockMiningTimeInMs * 3);

    //     expect((await Receiver.numMessages()).toNumber()).to.equal(1);

    //     // remove listeners
    //     oracle.stopListening();
    //     relayer.stopListening();
    // });
    it("works for a single message", async function () {
        // setup constants
        const blockMiningTimeInMs = POLLING_INTERVAL_SRC_IN_MS * 2;
        const blockUpdateInterval = 1;
        const blockUpdateEpochs = 4;

        this.timeout(blockUpdateEpochs * blockMiningTimeInMs * 3 + 2000);

        // create relayer and oracle nodes

        const relayer = new Relayer({
            rpcURLSrc: SRC_RPC_URL,
            rpcURLDst: DST_RPC_URL,
            ethPrivateKey: PRIVATE_KEYS[0],
            endpointAddressSrc: EndpointSrc.address,
            endpointAddressDst: EndpointDst.address,
            pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
            pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
        });
        await relayer.init();
        const oracle = new Oracle({
            rpcURLSrc: SRC_RPC_URL,
            rpcURLDst: DST_RPC_URL,
            ethPrivateKey: PRIVATE_KEYS[0],
            endpointAddressSrc: EndpointSrc.address,
            endpointAddressDst: EndpointDst.address,
            nexusOracleAddressDst: NexusOracleDst.address,
            pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
            pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
            oracleUpdateBlockInterval: blockUpdateInterval,
        });

        await oracle.listen();
        await relayer.listen();

        for (let i = 0; i < blockUpdateEpochs; i++) {
            const message = `hello`;
            const encodedMessage = abiCoder.encode(["string"], [message]);
            await EndpointSrc.send(DST_CHAIN_ID, Receiver.address, encodedMessage);
            await sleep(blockMiningTimeInMs * 3);
        }

        expect((await Receiver.numMessages()).toNumber()).to.equal(blockUpdateEpochs);

        // remove listeners
        await oracle.stopListening();
        await relayer.stopListening();
    });
});
