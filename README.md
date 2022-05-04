# Cross-Chain Bridge Contracts for Testnet

This repo contains a suite of contracts for a cross-chain message bridge protocol meant to be deployed on a testnet.

There is also code for the Oracle and Relayer agents. Currently, the oracle is a simple server.

## Install dependencies

```shell
yarn install
```

## Test the contracts

```shell
yarn hardhat test
```

## Test the off-chain agents

First open two terminal windows and spin up two development blockchains:

```shell
yarn run chainA
```

```shell
yarn run chainB
```

Then, to test all off-chain agents run:

```shell
yarn run test
```

To run a particular test file, do:

```shell
yarn run test:single src/end-to-end/e2e.test.ts
```
