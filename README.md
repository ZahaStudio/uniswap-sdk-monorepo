# uniswap-dev-kit
[![CI](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/BootNodeDev/uni-dev-kit/branch/main/graph/badge.svg)](https://codecov.io/gh/BootNodeDev/uni-dev-kit)
[![Release](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/release.yml/badge.svg)](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/release.yml)
[![Docs](https://img.shields.io/badge/docs-typedoc-blue)](https://bootnodedev.github.io/uni-dev-kit)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/BootNodeDev/uni-dev-kit)

> Modern TypeScript SDK for integrating Uniswap V4 into your dapp.  
> **Early version:** API may change rapidly.

A developer-friendly library for interacting with Uniswap V4 contracts. This library provides a simple and flexible interface for common operations like adding liquidity, swapping tokens, and managing positions.

## Features

- 🚀 Simple and intuitive API
- 🔄 Support for all major Uniswap V4 operations
- 💰 Native token support
- 🔒 Permit2 integration for gasless approvals
- 📊 Flexible liquidity management
- 🔍 Built-in quote simulation
- 🛠 TypeScript support

## Installation

```bash
npm install uniswap-dev-kit
# or
yarn add uniswap-dev-kit
```

## Quick Start

```ts
import { UniDevKitV4 } from 'uniswap-dev-kit';

const uniDevKit = new UniDevKitV4({
  chainId: 1,
  contracts: {
    poolManager: "0x...",
    positionManager: "0x...",
    positionDescriptor: "0x...",
    quoter: "0x...",
    stateView: "0x...",
    universalRouter: "0x..."
  }
});

const pool = await uniDevKit.getPool({
  tokens: ["0xTokenA", "0xTokenB"],
  fee: 3000
});

const quote = await uniDevKit.getQuote({
  pool,
  amountIn: "1000000000000000000"
});
```

## Documentation
Full API documentation with TypeDoc: [https://bootnodedev.github.io/uni-dev-kit](https://bootnodedev.github.io/uni-dev-kit)

## API Reference

### Index
- [uniswap-dev-kit](#uniswap-dev-kit)
  - [Features](#features)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Documentation](#documentation)
  - [API Reference](#api-reference)
    - [Index](#index)
    - [`getPool`](#getpool)
    - [`getQuote`](#getquote)
    - [`getTokens`](#gettokens)
    - [`getPosition`](#getposition)
    - [`getPoolKeyFromPoolId`](#getpoolkeyfrompoolid)
    - [`buildSwapCallData`](#buildswapcalldata)
    - [`buildAddLiquidityCallData`](#buildaddliquiditycalldata)
    - [`preparePermit2BatchCallData`](#preparepermit2batchcalldata)
    - [`buildRemoveLiquidityCallData`](#buildremoveliquiditycalldata)
      - [Basis Points Reference](#basis-points-reference)
  - [Useful Links](#useful-links)
  - [Development](#development)
    - [Scripts](#scripts)
  - [Contributing](#contributing)
  - [Release](#release)
  - [License](#license)

### `getPool`
Retrieve a pool object from two tokens and a fee tier.
```ts
const pool = await uniDevKit.getPool({
  tokens: [tokenA, tokenB],
  fee: 3000
});
```

### `getQuote`
Simulate a swap to get `amountOut` and `sqrtPriceLimitX96`.
```ts
const quote = await uniDevKit.getQuote({
  pool,
  amountIn: "1000000000000000000"
});
```

### `getTokens`
Retrieve token metadata.
```ts
const tokens = await uniDevKit.getTokens({
  addresses: ["0x...", "0x..."]
});
```

### `getPosition`
Get details about a Uniswap V4 LP position.
```ts
const position = await uniDevKit.getPosition({
  tokenId: 123
});
```

### `getPoolKeyFromPoolId`
Retrieve the `PoolKey` object for a given pool ID.
```ts
const poolKey = await uniDevKit.getPoolKeyFromPoolId({
  poolId: "0x..."
});
```

### `buildSwapCallData`
Construct calldata for a Universal Router swap.

```ts
// Basic swap
const { calldata, value } = await uniDevKit.buildSwapCallData({
  tokenIn: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  amountIn: parseUnits("100", 6), // 100 USDC
  pool: pool,
  slippageTolerance: 50, // 0.5%
  recipient: "0x..."
});

// Swap with permit2
const permitData = await uniDevKit.preparePermit2Data({
  token: tokenIn,
  spender: uniDevKit.getContractAddress('universalRouter'),
  owner: userAddress
});

const signature = await signer._signTypedData(
  permitData.toSign.domain,
  { PermitSingle: permitData.toSign.types.PermitSingle },
  permitData.toSign.values
);

const permitWithSignature = permitData.buildPermit2DataWithSignature(signature);

const { calldata, value } = await uniDevKit.buildSwapCallData({
  tokenIn,
  amountIn,
  pool,
  slippageTolerance: 50,
  recipient,
  permit2Signature: permitWithSignature
});
```

### `buildAddLiquidityCallData`
Build calldata to add liquidity to a pool.
```ts
// Without permit
const { calldata, value } = await uniDevKit.buildAddLiquidityCallData({
  pool,
  amount0: "100000000",
  amount1: "50000000000000000",
  recipient: "0x...",
  slippageTolerance: 50
});

// With Permit2 batch approval
const permitData = await uniDevKit.preparePermit2BatchData({
  tokens: [pool.token0.address, pool.token1.address],
  spender: uniDevKit.getContractAddress('positionManager'),
  owner: userAddress
});

const signature = await signer.signTypedData(
  permitData.toSign.domain,
  permitData.toSign.types,
  permitData.toSign.values
);

const permitWithSignature = permitData.buildPermit2BatchDataWithSignature(signature);

const { calldata, value } = await uniDevKit.buildAddLiquidityCallData({
  pool,
  amount0: parseUnits("100", 6),
  recipient: "0x...",
  permit2BatchSignature: permitWithSignature
});

const tx = await sendTransaction({
  to: uniDevKit.getContractAddress('positionManager'),
  data: calldata,
  value
});
```

### `preparePermit2BatchCallData`
Construct a Permit2 batch approval for gasless interactions.
```ts
const permitData = await uniDevKit.preparePermit2BatchCallData({
  tokens: [tokenA.address, tokenB.address],
  spender: uniDevKit.getContractAddress('positionManager'),
  owner: userAddress
});
```

### `buildRemoveLiquidityCallData`
Build calldata to remove liquidity from a pool.
```ts
const { calldata, value } = await uniDevKit.buildRemoveLiquidityCallData({
  liquidityPercentage: 10_000, // 100%
  tokenId: '123',
  slippageTolerance: 50, // 0.5%
});

const tx = await sendTransaction({
  to: uniDevKit.getContractAddress('positionManager'),
  data: calldata,
  value
});
```

#### Basis Points Reference

Throughout the library, percentages are represented in basis points (bps). For example, when setting a slippage tolerance of 0.5%, you would use `50` bps. Here's a quick reference:

| Basis Points (bps) | Fraction | Percentage |
|:------------------:|:--------:|:----------:|
| 1 | 1/10_000 | 0.01% |
| 10 | 10/10_000 | 0.1% |
| 100 | 100/10_000 | 1% |
| 500 | 500/10_000 | 5% |
| 1000 | 1000/10_000 | 10% |
| 10_000 | 10_000/10_000 | 100% |

## Useful Links
- [Uniswap V4 Docs](https://docs.uniswap.org/contracts/v4/overview)

## Development

### Scripts
- `pnpm build` — Build the library
- `pnpm test` — Run all tests
- `pnpm lint` — Lint code with Biome
- `pnpm format` — Format code with Biome
- `pnpm docs` — Generate API docs with TypeDoc

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Release

- Releases are automated with [semantic-release](https://semantic-release.gitbook.io/semantic-release/).

## License
MIT
