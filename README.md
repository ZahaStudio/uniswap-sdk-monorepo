# uniswap-dev-kit
[![CI](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/BootNodeDev/uni-dev-kit/branch/main/graph/badge.svg)](https://codecov.io/gh/BootNodeDev/uni-dev-kit)
[![Release](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/release.yml/badge.svg)](https://github.com/BootNodeDev/uni-dev-kit/actions/workflows/release.yml)
[![Docs](https://img.shields.io/badge/docs-typedoc-blue)](https://bootnodedev.github.io/uni-dev-kit)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/BootNodeDev/uni-dev-kit)

> Modern TypeScript SDK for integrating Uniswap V4 into your dapp.  
> **Early version:** API may change rapidly.

An abstraction layer built on top of the official Uniswap V4 SDK that simplifies integration by providing high-level methods for common operations. This library maintains compatibility with the official SDK's interfaces while reducing boilerplate and bundling related contract interactions.

While the official SDK provides primitives for pool creation, position management, and swap execution, this SDK abstracts away the complexity of composing these primitives. Common workflows like adding liquidity or executing swaps are reduced to single method calls.

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
  currencyA: "0xTokenA",
  currencyB: "0xTokenB",
  fee: 3000
});

const quote = await uniDevKit.getQuote({
  poolKey: pool.poolKey,
  amountIn: "1000000000000000000",
  zeroForOne: true
});
```

## Documentation
Full API documentation with TypeDoc: [https://bootnodedev.github.io/uni-dev-kit](https://bootnodedev.github.io/uni-dev-kit)

## Core Operations

### Pool Management

#### `getPool`
Fetches live pool state from the blockchain and instantiates a fully configured Pool object. Uses multicall to batch `V4StateView.getSlot0()` and `V4StateView.getLiquidity()` calls, and handles sorting token pairs to match the official SDK's conventions.

**Without this SDK:** Manually call V4StateView.getSlot0() and V4StateView.getLiquidity(), construct PoolKey, sort tokens, then instantiate Pool with the fetched data. This method encapsulates all of that logic.

```ts
const pool = await uniDevKit.getPool({
  currencyA: "0xTokenA",
  currencyB: "0xTokenB",
  fee: 3000
});
```

#### `getTokens`
Fetches ERC20 metadata for multiple tokens and returns Currency instances. Uses multicall to batch `symbol()`, `name()`, and `decimals()` calls across all tokens, and automatically handles native currency by instantiating Ether based on the chain ID.

**Without this SDK:** Call erc20Abi.symbol(), name(), and decimals() for each token, handle native currency separately, construct Token or Ether instances manually. This method handles all of that logic.

```ts
const tokens = await uniDevKit.getTokens({
  addresses: ["0xTokenA", "0xTokenB"]
});
```

#### `getQuote`
Simulates a swap through V4Quoter to get the expected amountOut and gas estimate. Returns structured data ready to use in your application.

**Without this SDK:** Manually construct quote parameters with poolKey, encode swap details, call V4Quoter contract, decode and structure the results yourself.

```ts
const quote = await uniDevKit.getQuote({
  poolKey: pool.poolKey,
  amountIn: "1000000000000000000",
  zeroForOne: true
});
// Returns { amountOut, estimatedGasUsed, timestamp }
```

#### `getPositionDetails`
Fetches position state from the PositionManager and decodes the tick range, liquidity, and pool key. Uses multicall to batch `V4PositionManager.getPoolAndPositionInfo()` and `V4PositionManager.getPositionLiquidity()` calls, and handles data decoding.

**Without this SDK:** Call getPoolAndPositionInfo() and getPositionLiquidity() separately, decode packed position data, extract tick bounds and pool key manually.

```ts
const position = await uniDevKit.getPositionDetails("123");
// Returns { tokenId, tickLower, tickUpper, liquidity, poolKey }
```

### Swap Operations

#### `buildSwapCallData`
Generates Universal Router calldata for executing swaps. Encapsulates V4Planner usage to build swap actions, settle operations, and take operations. Supports Permit2 integration for gasless approvals.

**Without this SDK:** Instantiate V4Planner, call addAction(), addSettle(), and addTake() in sequence, manually encode Permit2 data if needed, construct command array and inputs array, encode Universal Router execute() call. This method wraps all of that complexity.

```ts
// Basic swap
const { calldata, value } = uniDevKit.buildSwapCallData({
  pool,
  amountIn: "1000000000000000000",
  zeroForOne: true,
  recipient: "0x...",
  amountOutMinimum: "900000000000000000"
});

// With Permit2
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

const { calldata, value } = uniDevKit.buildSwapCallData({
  pool,
  amountIn,
  zeroForOne: true,
  recipient,
  amountOutMinimum,
  permit2Signature: permitWithSignature
});
```

### Liquidity Operations

#### `buildAddLiquidityCallData`
Generates V4PositionManager.mint() calldata with intelligent handling of pool creation vs. existing pools. Automatically constructs Position instances, calculates sqrtPriceX96 for new pools, handles native currency wrapping/unwrapping, and integrates with Permit2 for batch approvals.

**Without this SDK:** Check pool liquidity to determine if creating new pool, calculate sqrtPriceX96 manually for new pools, choose between Position.fromAmounts/fromAmount0/fromAmount1, handle native currency, construct V4PositionManager.addCallParameters with all edge cases, optionally prepare Permit2 batch data. This method handles all that complexity.

```ts
// Adding to existing pool
const { calldata, value } = await uniDevKit.buildAddLiquidityCallData({
  pool,
  amount0: "100000000",
  recipient: "0x...",
  slippageTolerance: 50
});

// Creating new pool (both amounts required)
const { calldata, value } = await uniDevKit.buildAddLiquidityCallData({
  pool,
  amount0: "100000000",
  amount1: "50000000000000000",
  recipient: "0x...",
  slippageTolerance: 50
});
```

#### `buildRemoveLiquidityCallData`
Generates V4PositionManager.burn() calldata for removing liquidity from positions. Automatically fetches current position state, handles liquidity percentage calculations, and applies slippage tolerance.

**Without this SDK:** Fetch position details from PositionManager, decode position data, calculate liquidity percentage, construct Position instance, call V4PositionManager.removeCallParameters with all parameters. This method encapsulates that workflow.

```ts
const { calldata, value } = await uniDevKit.buildRemoveLiquidityCallData({
  liquidityPercentage: 10000, // 100%
  tokenId: '123',
  slippageTolerance: 50
});
```

#### `buildCollectFeesCallData`
Generates V4PositionManager.collect() calldata for collecting accrued fees from positions. Automatically fetches position details and constructs the collect parameters with proper recipient and hook data handling.

**Without this SDK:** Fetch position details from PositionManager, decode position data, construct Position instance, manually set up collect parameters with recipient and hook data, call V4PositionManager.collectCallParameters.

```ts
const { calldata, value } = await uniDevKit.buildCollectFeesCallData({
  tokenId: '123',
  recipient: "0x...",
});
```

### Permit2 Integration

#### `preparePermit2Data`
Prepares single-token Permit2 approval data for swaps. Returns structured data ready for EIP-712 signing.

```ts
const permitData = await uniDevKit.preparePermit2Data({
  token: tokenIn,
  spender: uniDevKit.getContractAddress('universalRouter'),
  owner: userAddress
});
```

#### `preparePermit2BatchData`
Prepares batch Permit2 approval data for multiple tokens. Uses multicall to batch `Permit2.allowance()` calls across all tokens and returns structured data ready for EIP-712 signing. Used for adding liquidity to pools requiring multiple token approvals.

**Without this SDK:** Call Permit2.allowance() for each token, construct PermitBatch struct manually, fetch current block timestamp to calculate sigDeadline, use Permit2 SDK to prepare typed data with correct domain and values. This method handles all of that setup.

```ts
const permitData = await uniDevKit.preparePermit2BatchData({
  tokens: [tokenA.address, tokenB.address],
  spender: uniDevKit.getContractAddress('positionManager'),
  owner: userAddress
});

const signature = await signer._signTypedData(
  permitData.toSign.domain,
  permitData.toSign.types,
  permitData.toSign.values
);

const permitWithSignature = permitData.buildPermit2BatchDataWithSignature(signature);
```

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
