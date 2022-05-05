import { expect } from "chai";
import { ethers } from "ethers";
import { Endpoint, Endpoint__factory, NexusOracleMock, NexusOracleMock__factory } from "../typechain";
import { Oracle } from "./Oracle";
import { PRIVATE_KEYS, RPC_URL_CHAIN_A, RPC_URL_CHAIN_B } from "./test_utils";
import { sleep } from "./utils";

const SRC_CHAIN_ID = 1;
const DST_CHAIN_ID = 2;

const SRC_RPC_URL = RPC_URL_CHAIN_A;
const DST_RPC_URL = RPC_URL_CHAIN_B;

const POLLING_INTERVAL_SRC_IN_MS = 200;
const POLLING_INTERVAL_DST_IN_MS = 200;

describe("Oracle", function () {
    let providerSrc: ethers.providers.JsonRpcProvider;
    let providerDst: ethers.providers.JsonRpcProvider;

    let deployerSrc: ethers.Wallet;
    let deployerDst: ethers.Wallet;

    let EndpointSrc: Endpoint;
    let EndpointDst: Endpoint;
    let NexusOracleSrc: NexusOracleMock;
    let NexusOracleDst: NexusOracleMock;

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
    });

    it("works for one update", async () => {
        const oracle = new Oracle({
            rpcURLSrc: SRC_RPC_URL,
            rpcURLDst: DST_RPC_URL,
            ethPrivateKey: PRIVATE_KEYS[0],
            endpointAddressSrc: EndpointSrc.address,
            endpointAddressDst: EndpointDst.address,
            nexusOracleAddressDst: NexusOracleDst.address,
            pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
            pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
            oracleUpdateBlockInterval: 2,
        });
        if ((await providerSrc.getBlockNumber()) % 2 === 0) {
            await providerSrc.send("evm_mine", []);
        }
        expect((await providerSrc.getBlockNumber()) % 2 === 1).to.be.true;

        // setup listener
        const promise = new Promise<void>((resolve) => {
            EndpointDst.on(EndpointDst.filters.RootUpdated(), function listener() {
                EndpointDst.removeListener(EndpointDst.filters.RootUpdated(), listener);
                resolve();
            });
        });

        await oracle.listen();

        await providerSrc.send("evm_mine", []);

        await promise;

        await oracle.stopListening();
    });
    it("works for multiple updates", async function () {
        const blockMiningTimeInMs = POLLING_INTERVAL_SRC_IN_MS * 2;
        const blockUpdateInterval = 3;
        const blockUpdateEpochs = 5;
        this.timeout(blockUpdateInterval * blockUpdateEpochs * blockMiningTimeInMs + 2000);
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
        while ((await providerSrc.getBlockNumber()) % blockUpdateInterval !== 0) {
            await providerSrc.send("evm_mine", []);
        }
        await providerSrc.send("evm_mine", []);
        expect((await providerSrc.getBlockNumber()) % blockUpdateInterval === 1).to.be.true;

        // setup listener
        let numberOfUpdates = 0;
        EndpointDst.on(EndpointDst.filters.RootUpdated(), function () {
            numberOfUpdates += 1;
        });

        await oracle.listen();

        for (let i = 0; i < blockUpdateInterval * blockUpdateEpochs; i++) {
            await providerSrc.send("evm_mine", []);
            await sleep(blockMiningTimeInMs);
        }

        expect(numberOfUpdates).to.be.equal(blockUpdateEpochs);

        // remove listeners
        await oracle.stopListening();
        EndpointDst.removeAllListeners();
    });
});
