import 'dotenv/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-ethernal'
import type { HardhatUserConfig } from 'hardhat/config'

const PRIVATE_KEY_DEPLOYER = process.env.PRIVATE_KEY_DEPLOYER
const deployerAccounts = PRIVATE_KEY_DEPLOYER ? [PRIVATE_KEY_DEPLOYER] : []

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // Local in-memory chain used for tests and `npx hardhat node`.
    },
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC_URL ?? 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      accounts: deployerAccounts,
    },
    polygonPos: {
      url: process.env.POLYGON_POS_RPC_URL ?? 'https://polygon-rpc.com',
      chainId: 137,
      accounts: deployerAccounts,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY ?? '',
      polygon: process.env.POLYGONSCAN_API_KEY ?? '',
    },
  },
  ethernal: {
    disabled: !process.env.ETHERNAL_EMAIL,
    disableSync: !process.env.ETHERNAL_EMAIL,
    email: process.env.ETHERNAL_EMAIL,
    password: process.env.ETHERNAL_PASSWORD,
    workspace: process.env.ETHERNAL_WORKSPACE ?? 'MajiShwari',
    uploadAst: true,
  },
  paths: {
    sources: './contracts',
    tests: './tests',
  },
}

export default config