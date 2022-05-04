import { expect } from "chai";
import { ethers } from "ethers";
import {
    Endpoint,
    Endpoint__factory,
    NexusOracleMock,
    NexusOracleMock__factory,
    ReceiverMock,
    ReceiverMock__factory,
} from "../typechain";
import { PRIVATE_KEYS, RPC_URL_CHAIN_A, RPC_URL_CHAIN_B } from "./test_utils";
import { abiCoder } from "./utils";
import { Relayer } from "./Relayer";
import { keccak256, solidityKeccak256 } from "ethers/lib/utils";

const SRC_CHAIN_ID = 1;
const DST_CHAIN_ID = 2;

const SRC_RPC_URL = RPC_URL_CHAIN_A;
const DST_RPC_URL = RPC_URL_CHAIN_B;

const POLLING_INTERVAL_SRC_IN_MS = 1000;
const POLLING_INTERVAL_DST_IN_MS = 1000;

describe("Relayer", function () {
    let providerSrc: ethers.providers.JsonRpcProvider;
    let providerDst: ethers.providers.JsonRpcProvider;

    let deployerSrc: ethers.Wallet;
    let deployerDst: ethers.Wallet;

    let EndpointSrc: Endpoint;
    let EndpointDst: Endpoint;
    let Receiver: ReceiverMock;
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
        Receiver = await new ReceiverMock__factory(deployerDst).deploy(EndpointDst.address);
    });
    it("relays a message", async function () {
        this.timeout(3 * 1000);

        const relayer = new Relayer({
            rpcURLSrc: SRC_RPC_URL,
            rpcURLDst: DST_RPC_URL,
            ethPrivateKey: PRIVATE_KEYS[1],
            endpointAddressSrc: EndpointSrc.address,
            endpointAddressDst: EndpointDst.address,
            pollingIntervalSrcInMs: POLLING_INTERVAL_SRC_IN_MS,
            pollingIntervalDstInMs: POLLING_INTERVAL_DST_IN_MS,
        });
        await relayer.init();
        await relayer.listen();

        // setup message
        const message = "hello";
        const encodedMessage = abiCoder.encode(["string"], [message]);

        // setup MessageRelayed promise
        const promise = new Promise<void>((resolve) => {
            Receiver.once(Receiver.filters.MessageReceived(), (_message) => {
                if (_message === message) resolve();
            });
        });

        // send message
        await EndpointSrc.send(DST_CHAIN_ID, Receiver.address, encodedMessage);

        // let Oracle relay root
        const calldata = EndpointDst.interface.encodeFunctionData("updateRoot", [
            abiCoder.encode(
                ["uint256", "uint256", "bytes32"],
                [await EndpointSrc.chainId(), await EndpointSrc.provider.getBlockNumber(), await EndpointSrc.treeRoot()]
            ),
        ]);
        await NexusOracleDst.execute(EndpointDst.address, calldata);

        // expect promise to be resolved
        await promise;

        // expect Receiver to have received message
        const messageReceived = await Receiver.messages(0);
        expect(messageReceived.srcChainId.toNumber()).to.equal(SRC_CHAIN_ID);
        expect(messageReceived.srcAddress).to.equal(deployerSrc.address);
        expect(messageReceived.nonce.toNumber()).to.equal(0);
        expect(messageReceived.message).to.equal(message);

        // cleanup
        await relayer.stopListening();
    });
    it("relays multiple messages", async function () {
        this.timeout(3 * 1000);

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
        await relayer.listen();

        // setup message
        const message1 = "Message 1";
        const encodedMessage1 = abiCoder.encode(["string"], [message1]);
        const message2 = "Message 2";
        const encodedMessage2 = abiCoder.encode(["string"], [message2]);

        // setup MessageRelayed promises
        const promiseMessage1 = new Promise<void>((resolve) => {
            Receiver.on(Receiver.filters.MessageReceived(), (_message) => {
                if (_message === message1) resolve();
            });
        });
        const promiseMessage2 = new Promise<void>((resolve) => {
            Receiver.on(Receiver.filters.MessageReceived(), (_message) => {
                if (_message === message2) resolve();
            });
        });

        // send messages
        await EndpointSrc.send(DST_CHAIN_ID, Receiver.address, encodedMessage1);
        await EndpointSrc.send(DST_CHAIN_ID, Receiver.address, encodedMessage2);

        // let Oracle relay root
        const calldata = EndpointDst.interface.encodeFunctionData("updateRoot", [
            abiCoder.encode(
                ["uint256", "uint256", "bytes32"],
                [await EndpointSrc.chainId(), await EndpointSrc.provider.getBlockNumber(), await EndpointSrc.treeRoot()]
            ),
        ]);
        await NexusOracleDst.execute(EndpointDst.address, calldata);

        // expect promises to be resolved
        await Promise.all([promiseMessage1, promiseMessage2]);

        // expect Receiver to have received the correct messages
        const messageReceived1 = await Receiver.messages(0);
        expect(messageReceived1.srcChainId.toNumber()).to.equal(SRC_CHAIN_ID);
        expect(messageReceived1.srcAddress).to.equal(deployerSrc.address);
        expect(messageReceived1.nonce.toNumber()).to.equal(0);
        expect(messageReceived1.message).to.equal(message1);

        const messageReceived2 = await Receiver.messages(1);
        expect(messageReceived2.srcChainId.toNumber()).to.equal(SRC_CHAIN_ID);
        expect(messageReceived1.srcAddress).to.equal(deployerSrc.address);
        expect(messageReceived2.nonce.toNumber()).to.equal(1);
        expect(messageReceived2.message).to.equal(message2);

        // cleanup
        await relayer.stopListening();
        Receiver.removeAllListeners();
    });
});
