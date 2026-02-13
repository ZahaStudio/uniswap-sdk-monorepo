# Uniswap SDK Example App

## Overview

This app demonstrates how to build real user flows with `@zahastudio/uniswap-sdk-react` on Uniswap V4. This app includes the following demos:

- **Swap**: Quoting, Approval, Permit2 and Swap execution flow
- **Position Management**: Uniswap v4 Position Management via the Position Manager

By default, the app runs against `Ethereum Mainnet` (Chain ID: `1`).

## Requirements

- Node.js `>= 24`
- `pnpm`
- A browser wallet (We recommend Rabby if you plan on using custom network)

## Running Locally

From the monorepo root:

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Start dev process (internally runs both package builders and the example app)

   ```bash
   pnpm dev
   ```

3. Open the example app
   ```text
   http://localhost:3000
   ```

## Environment variables

- `NEXT_PUBLIC_MAINNET_RPC_URL` (optional)
  - Overrides the Ethereum Mainnet RPC URL used by the app
  - Useful for running against a local Anvil fork

## Running Anvil (Mainnet Fork)

1. Update env with local RPC

   ```bash
   export NEXT_PUBLIC_MAINNET_RPC_URL="http://127.0.0.1:8545"
   ```

2. Start Anvil from the monorepo root

   ```bash
   pnpm anvil
   ```

3. Configure your wallet
   - Update the `Ethereum Mainnet` RPC URL to `http://127.0.0.1:8545`
   - Import one of the private keys printed by Anvil

4. Start the app

   ```bash
   pnpm dev
   ```

5. Interact with the demos to execute ETH/USDC or USDC/USDT swaps
