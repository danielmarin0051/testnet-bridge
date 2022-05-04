import { ethers } from "ethers";
import { EventEmitter } from "events";
import { Mutex, withTimeout, MutexInterface } from "async-mutex";

export class Queue<T> {
    items: T[] = [];

    enqueue(item: T): void {
        this.items.push(item);
    }

    dequeue(): T {
        const item = this.items.shift();
        if (item === undefined) throw new Error("Queue is empty");
        return item;
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }
}

export type TxManagerConfig = {
    txTimeoutInMs: number;
    signer: ethers.Signer;
};

export class TxManager {
    private queue = new Queue<ethers.PopulatedTransaction>();
    private emitter = new EventEmitter();
    private signer: ethers.Signer;
    private mutex: MutexInterface;

    constructor(config: TxManagerConfig) {
        this.signer = config.signer;
        this.mutex = withTimeout(new Mutex(), config.txTimeoutInMs);
    }

    enqueue(tx: ethers.PopulatedTransaction) {
        console.log("[TxManager] Tx enqueued, pinging");
        this.queue.enqueue(tx);
        this.emitter.emit("ping");
    }

    async start(): Promise<void> {
        this.emitter.on("ping", async () => {
            await this.mutex.runExclusive(async () => {
                if (this.queue.isEmpty()) return;
                const tx = this.queue.dequeue();
                console.log("[TxManager] Attempting to execute a transaction");
                try {
                    const txResponse = await this.signer.sendTransaction(tx);
                    await txResponse.wait();
                    console.log("[TxManager] Tx submission successful");
                } catch (err) {
                    console.warn("[TxManager] Err sending transaction", err);
                }
                this.emitter.emit("txProcessed");
            });
        });
    }

    async stop() {
        console.log("[TxManager] Stop called");
        await Promise.resolve(
            new Promise<void>(async (resolve) => {
                if (this.queue.isEmpty()) {
                    this.mutex.waitForUnlock();
                    return resolve();
                }
                const self = this;
                this.emitter.on("txProcessed", async function listener() {
                    if (self.queue.isEmpty()) {
                        await self.mutex.waitForUnlock();
                        self.emitter.removeListener("txProcessed", listener);
                        resolve();
                    }
                });
            })
        );
        this.emitter.removeAllListeners();
    }
}
