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
import { random, range } from "lodash";
import { expect } from "chai";

const SRC_CHAIN_ID = 1;
const DST_CHAIN_ID = 2;

const SRC_RPC_URL = RPC_URL_CHAIN_A;
const DST_RPC_URL = RPC_URL_CHAIN_B;

const POLLING_INTERVAL_SRC_IN_MS = 200;
const POLLING_INTERVAL_DST_IN_MS = 200;

const ORACLE_BLOCK_UPDATE_INTERVAL = 3;
const MINING_INTERVAL = 1000;

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
    this.beforeAll(async () => {
        await providerSrc.send("evm_setIntervalMining", [0]);
        await providerSrc.send("evm_setIntervalMining", [0]);
        NexusOracleSrc = await new NexusOracleMock__factory(deployerSrc).deploy();
        NexusOracleDst = await new NexusOracleMock__factory(deployerDst).deploy();
        EndpointSrc = await new Endpoint__factory(deployerSrc).deploy(SRC_CHAIN_ID, NexusOracleSrc.address);
        EndpointDst = await new Endpoint__factory(deployerDst).deploy(DST_CHAIN_ID, NexusOracleDst.address);
        Receiver = await new ReceiverMock__factory(deployerDst).deploy(EndpointDst.address);
    });
    it("works", async function () {
        const numMessages = 5;

        this.timeout(numMessages * MINING_INTERVAL * 2 + 3 * MINING_INTERVAL + 2000);

        // init relayer and oracle nodes
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
            oracleUpdateBlockInterval: ORACLE_BLOCK_UPDATE_INTERVAL,
        });

        // setup hardhat mining mode
        await providerSrc.send("evm_setIntervalMining", [MINING_INTERVAL]);
        await providerSrc.send("evm_setIntervalMining", [MINING_INTERVAL]);

        // oracle / relayer start listening
        await oracle.listen();
        await relayer.listen();

        // send multiple messages
        for (let i = 0; i < numMessages; i++) {
            const message = `hello:${i}`;
            console.log("Sending message:", message);
            const encodedMessage = abiCoder.encode(["string"], [message]);
            const tx = await EndpointSrc.send(DST_CHAIN_ID, Receiver.address, encodedMessage);
            await tx.wait();
            await sleep(MINING_INTERVAL * 2 * random(0, 1, true));
        }

        await sleep(MINING_INTERVAL * 3);

        // test
        expect((await Receiver.numMessages()).toNumber()).to.equal(numMessages);

        const messagesReceived = await Promise.all(
            range(numMessages).map(async (i) => {
                return await Receiver.messages(i);
            })
        );

        const nonceSet = new Set(range(numMessages));
        const noncesSeen: Set<number> = new Set();

        for (const message of messagesReceived) {
            const nonce = message.nonce.toNumber();
            expect(nonce >= 0 && nonce < numMessages).to.be.true;
            expect(nonceSet.has(nonce)).to.be.true;
            expect(noncesSeen.has(nonce)).to.be.false;
            expect(message.message === `hello:${nonce}`);
            noncesSeen.add(nonce);
        }

        // cleanup
        await oracle.stopListening();
        await relayer.stopListening();
        await providerSrc.send("evm_setIntervalMining", [0]);
        await providerSrc.send("evm_setIntervalMining", [0]);
    });
});
