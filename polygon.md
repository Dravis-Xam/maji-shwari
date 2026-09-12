> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polygon.technology/llms.txt
> Use this file to discover all available pages before exploring further.

# Smart contracts

> How to work with smart contracts in a dApp Launchpad project, including local deployment, the block explorer, and production deployment.

## Prerequisites

Complete the [environment variable setup in the quickstart](/tools/dApp-development/launchpad/quickstart/#step-3-set-up-environment-variables) before following the steps below.

## Smart contract framework

Contracts are written in [Solidity](https://docs.soliditylang.org/) and run in a [Hardhat](https://hardhat.org/) environment. They live in the `smart-contracts` directory.

* Tests are in the `tests` directory, written in JavaScript or TypeScript. An example test is included.
* Deploy scripts are in the `scripts` directory, also in JavaScript or TypeScript. Required scripts are already in place to get started.

## Deploy to a local test chain

Follow the [start developing instructions](/tools/dApp-development/launchpad/quickstart/#step-4-start-the-development-environment) to spin up a local chain.

The [`dev`](/tools/dApp-development/launchpad/commands/#dev) command runs the `scripts/deploy_localhost` script internally, which deploys all contracts in the correct sequence.

<Warning>
  When working on your own smart contracts, update `scripts/deploy_localhost` to deploy them in the right order.
</Warning>

For all available options:

```bash theme={null}
dapp-launchpad dev -h
```

## Enable a local block explorer with Ethernal

You can optionally start a local blockchain explorer that auto-indexes transactions and provides a dashboard with an overview of the chain.

### Set up Ethernal

1. Create an account and a workspace at [https://app.tryethernal.com/](https://app.tryethernal.com/).
2. Add your login email, password, and workspace name to the `.env` file in the `smart-contracts` directory.

These values can also be passed as flags to the `dev` command: `--ethernal-login-email`, `--ethernal-login-password`, and `--ethernal-workspace`. These flags override the environment variables if both are set.

### Start the block explorer

Run the `dev` command with the `-e` flag:

```bash theme={null}
dapp-launchpad dev -e
```

Access the explorer at [https://app.tryethernal.com/](https://app.tryethernal.com/).

## Deploy to production

The [`deploy`](/tools/dApp-development/launchpad/commands/#deploy) command deploys to any EVM-compatible chain. It runs `scripts/deploy_prod` to deploy all contracts in the correct sequence.

<Warning>
  When working on your own smart contracts, update `scripts/deploy_prod` to deploy them in the right order.
</Warning>

For all available options:

```bash theme={null}
dapp-launchpad deploy -h
```

See the [deploy section of the quickstart](/tools/dApp-development/launchpad/quickstart/#deploy-to-production) for usage examples.
