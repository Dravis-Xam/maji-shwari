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

> SOLIDITY: https://docs.soliditylang.org/en/v0.8.37

> HARDHUT: https://hardhat.org/docs/getting-started


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.polygon.technology/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Build and run your first dApp Launchpad project from installation to a live local development environment.

By the end of this tutorial, you will have a dApp project running locally with a local test blockchain, deployed smart contracts, and a Next.js frontend that updates automatically when you change code.

## Prerequisites

* Node.js version 18.x.x (recommended). Versions above 16.14.x are supported.
* Use [nvm](https://github.com/nvm-sh/nvm) to manage Node installations if you need multiple versions.

## Step 1: Install the CLI

Open a terminal and install dApp Launchpad globally:

```bash theme={null}
npm install -g @polygonlabs/dapp-launchpad
```

## Step 2: Initialize a new project

```bash theme={null}
dapp-launchpad init <PROJECT-NAME>
```

This creates a new directory, scaffolds a minimal dApp project, and installs the required packages.

### Choose a template

By default, the project uses JavaScript. For TypeScript, pass the `--template` flag:

```bash theme={null}
dapp-launchpad init <PROJECT-NAME> --template typescript
```

To see all available templates:

```bash theme={null}
dapp-launchpad list scaffold-templates
```

## Step 3: Set up environment variables

Both the `frontend` and `smart-contracts` directories require environment variables before you can start the dev environment.

1. Change into your project directory:

   ```bash theme={null}
   cd <PROJECT-NAME>
   ```

2. Copy the frontend environment file:

   ```bash theme={null}
   cd frontend
   cp .env.example .env
   ```

3. Open the frontend `.env` file and add your `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

   To get a WalletConnect project ID:

   1. Create an account at [WalletConnect Cloud](https://cloud.walletconnect.com/) and sign in.
   2. Select **Create a new project**.
   3. Give it a name and select **Continue**. You can leave the URL empty for now.
   4. Select **AppKit** and continue.
   5. Select **Next.js** and then select **Create** in the bottom right of the pop-up window.
   6. Copy the project ID from the sidebar and paste it into the frontend `.env` file.

4. Copy the smart contracts environment file:

   ```bash theme={null}
   cd ../smart-contracts
   cp .env.example .env
   ```

5. Open the smart-contracts `.env` file and set the `PRIVATE_KEY_DEPLOYER` variable to a private key from any wallet account you control. The other variables in this file are optional.

## Step 4: Start the development environment

Run the following from your project root:

```bash theme={null}
dapp-launchpad dev
```

You will see the local test blockchain start, contracts deploy, and pre-funded wallets listed in the terminal output:

<img src="https://mintcdn.com/polygon-labs/PnA6B0XDAD7POEHb/img/tools/launchpad/running-example.png?fit=max&auto=format&n=PnA6B0XDAD7POEHb&q=85&s=c9423751994cdbcb1444a471856765f1" alt="Local test environment running" width="2682" height="1434" data-path="img/tools/launchpad/running-example.png" />

Open [http://localhost:3000](http://localhost:3000) in a browser:

<img src="https://mintcdn.com/polygon-labs/PnA6B0XDAD7POEHb/img/tools/launchpad/dev-startup.png?fit=max&auto=format&n=PnA6B0XDAD7POEHb&q=85&s=25f863f3fc996790e349211fbd49080d" alt="Web application running" width="3024" height="1644" data-path="img/tools/launchpad/dev-startup.png" />

You now have a fully integrated dev environment. Changes to smart contract code or frontend code update automatically. No manual reload is needed.

## Developing against a forked chain

To fork an existing network instead of starting from genesis, pass the `-n` flag:

```bash theme={null}
dapp-launchpad dev -n polygonZkevm
```

Available network names: `ethereum`, `goerli`, `polygonPos`, `polygonAmoy`, `polygonZkevm`, `polygonZkevmTestnet`

To fork at a specific block number:

```bash theme={null}
dapp-launchpad dev -n polygonZkevm -b [BLOCK_NUMBER_TO_FORK_AT]
```

To see all options:

```bash theme={null}
dapp-launchpad dev -h
```

## Deploy to production

To deploy both your smart contracts and frontend to production:

```bash theme={null}
dapp-launchpad deploy -n <CHAIN-NAME>
```

This deploys all smart contracts to the selected chain, then deploys your frontend to Vercel, and logs the deployment URL for each.

To deploy only smart contracts:

```bash theme={null}
dapp-launchpad deploy -n CHAIN_NAME --only-smart-contracts
```

To deploy only the frontend:

```bash theme={null}
dapp-launchpad deploy -n CHAIN_NAME --only-frontend
```

<Note>
  Frontend deployment requires that smart contracts are already deployed. If you are deploying only the frontend, either run the smart contracts deploy first, or manually generate the smart contracts config:

  ```
  generate smart-contracts-config -e production -n CHAIN_NAME
  ```
</Note>


> ETHERNAL requires RPC server URL: https://app.tryethernal.com/auth
