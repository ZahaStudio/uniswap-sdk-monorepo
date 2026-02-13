# Swap Example

## Overview
This example demonstrates how to use the Uniswap V4 react and typescript SDK to swap between ETH and USDC

## Usage
To run this example, follow these steps:

1. Install dependencies from the root directory
   ```bash
   pnpm install
   ```

2. Start the development server from the root directory
   ```bash
   pnpm build && pnpm dev
   ```

Note: By default, the example app runs on `Ethereum mainnet` 

## Running on Anvil

1. Set the environment variable
  ```bash
  export NEXT_PUBLIC_MAINNET_RPC_URL=http://127.0.0.1:8545
  ```
2. Start anvil

  ```bash
   pnpm anvil
   ```
   
   After starting anvil, change the `Ethereum mainnet` rpc of your browser wallet to point to  `http://127.0.0.1:8545` and 
   import one of the private keys mentioned in the anvil logs. By default those private keys should have around 10000 ETH
   
3. Start the development server from the root directory
  ```bash
  pnpm build && pnpm dev
  ```

Interact with the app by swapping ETH for USDC or vice versa.
