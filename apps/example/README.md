# Uniswap SDK Example App

## Overview

This app demonstrates how to build real user flows with `@zahastudio/uniswap-sdk-react` on Uniswap V4.

### Swap demo

- Preset pairs:
  - `ETH -> USDC`
  - `USDC -> USDT`
- Multi-step execution flow handled by the SDK (`quote`, `approval`, `permit2`, `swap`)
- Quote refresh and transaction status tracking

By default, the app runs against `Ethereum mainnet` (chain ID `1`).

## Prerequisites

- Node.js `>= 24`
- `pnpm`
- A browser wallet (for example MetaMask)

## Run locally

From the monorepo root:

1. Install dependencies

   ```bash
   pnpm install
   ```

2. Build and start dev servers

   ```bash
   pnpm build && pnpm dev
   ```

3. Open the example app
   ```text
   http://localhost:3002
   ```

## Environment variables

- `NEXT_PUBLIC_MAINNET_RPC_URL` (optional)
  - Overrides the Ethereum mainnet RPC URL used by the app
  - Useful for running against a local Anvil fork

## Running on Anvil (mainnet fork)

1. Point the app to your local RPC

   ```bash
   export NEXT_PUBLIC_MAINNET_RPC_URL=http://127.0.0.1:8545
   ```

2. Start Anvil from the monorepo root

   ```bash
   pnpm anvil
   ```

3. Configure your wallet
   - Update the `Ethereum mainnet` RPC URL to `http://127.0.0.1:8545`
   - Import one of the private keys printed by Anvil (funded accounts)

4. Start the app

   ```bash
   pnpm build && pnpm dev
   ```

5. Interact with the demos to execute ETH/USDC or USDC/USDT swaps
