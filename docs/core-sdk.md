# Core SDK Reference — `@zahastudio/uniswap-sdk`

## Installation

```bash
pnpm add @zahastudio/uniswap-sdk viem
```

Peer dependency: `viem >= 2.0.0`

## Creating an Instance

```ts
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { UniswapSDK } from "@zahastudio/uniswap-sdk";

const client = createPublicClient({ chain: mainnet, transport: http() });
const sdk = UniswapSDK.create(client, 1); // chainId = 1
```

### `UniswapSDK.create(client, chainId, options?)`

| Parameter | Type                | Required | Description                               |
| --------- | ------------------- | -------- | ----------------------------------------- |
| `client`  | `PublicClient`      | Yes      | A viem public client for the target chain |
| `chainId` | `number`            | Yes      | Chain ID (must be positive integer)       |
| `options` | `UniswapSDKOptions` | No       | See below                                 |

#### `UniswapSDKOptions`

| Field                      | Type           | Default                              | Description                        |
| -------------------------- | -------------- | ------------------------------------ | ---------------------------------- |
| `contracts`                | `V4Contracts`  | Auto-resolved via hookmate           | Override contract addresses        |
| `cache`                    | `CacheAdapter` | LRU cache (1000 entries, 30-day TTL) | Custom cache adapter               |
| `defaultDeadline`          | `number`       | `600` (10 minutes)                   | Default deadline offset in seconds |
| `defaultSlippageTolerance` | `number`       | `50` (0.5%)                          | Default slippage in basis points   |

#### `V4Contracts`

```ts
interface V4Contracts {
  poolManager: Address;
  positionManager: Address;
  quoter: Address;
  stateView: Address;
  universalRouter: Address;
  permit2: Address;
  weth: Address; // Wrapped native token (WETH, WMATIC, etc.)
}
```

---

## Read Methods (RPC calls)

### `sdk.getTokens(args)`

Fetches ERC-20 token metadata via multicall. Caches results. Returns native `Ether` for `0x0000000000000000000000000000000000000000`.

```ts
const tokens = await sdk.getTokens({
  addresses: [
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  ],
});
// Returns: Currency[] (Token or Ether instances from @uniswap/sdk-core)
```

**Args:** `{ addresses: [Address, ...Address[]] }` — at least one address required.

**Returns:** `Promise<Currency[]>` — ordered same as input addresses.

---

### `sdk.getPool(poolKey)`

Fetches real-time pool state (slot0 + liquidity) via multicall from V4StateView.

```ts
const pool = await sdk.getPool({
  currency0: "0x...",
  currency1: "0x...",
  fee: 3000,
  tickSpacing: 60,
  hooks: "0x0000000000000000000000000000000000000000",
});
// Returns: Pool (from @uniswap/v4-sdk)
```

**Args:** `PoolKey` — `{ currency0, currency1, fee, tickSpacing, hooks }`

**Returns:** `Promise<Pool>` — fully initialized V4 SDK Pool instance.

---

### `sdk.getQuote(args)`

Simulates a swap via V4 Quoter contract. No transaction is sent.

```ts
const quote = await sdk.getQuote({
  poolKey: {
    currency0: "0x...",
    currency1: "0x...",
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x0000000000000000000000000000000000000000",
  },
  zeroForOne: true,
  amountIn: 1000000000000000000n, // 1 ETH as bigint or string
});
// Returns: { amountOut: bigint, timestamp: number }
```

**Args:** `SwapExactInSingle`

| Field              | Type               | Required | Description                       |
| ------------------ | ------------------ | -------- | --------------------------------- |
| `poolKey`          | `PoolKey`          | Yes      | Pool to quote through             |
| `zeroForOne`       | `boolean`          | Yes      | `true` = currency0→currency1      |
| `amountIn`         | `bigint \| string` | Yes      | Input amount in smallest unit     |
| `amountOutMinimum` | `bigint \| string` | No       | Min output (default `"0"`)        |
| `hookData`         | `Hex`              | No       | Custom hook data (default `"0x"`) |

**Returns:** `Promise<QuoteResponse>` — `{ amountOut: bigint, timestamp: number }`

---

### `sdk.getPosition(tokenId)`

Fetches a complete position with initialized Pool and Position SDK instances.

```ts
const pos = await sdk.getPosition("12345");
// Returns: { position, pool, currency0, currency1, poolId, tokenId, currentTick }
```

**Returns:** `Promise<GetPositionResponse>`

| Field         | Type                | Description                |
| ------------- | ------------------- | -------------------------- |
| `position`    | `Position` (V4 SDK) | Fully initialized position |
| `pool`        | `Pool` (V4 SDK)     | Pool with current state    |
| `currency0`   | `Currency`          | First token                |
| `currency1`   | `Currency`          | Second token               |
| `poolId`      | `0x${string}`       | Pool identifier            |
| `tokenId`     | `string`            | Position NFT ID            |
| `currentTick` | `number`            | Current pool tick          |

**Throws** if position has zero liquidity.

---

### `sdk.getPositionInfo(tokenId)`

Lightweight position metadata without creating SDK instances. More efficient for display-only use cases.

```ts
const info = await sdk.getPositionInfo("12345");
// Returns raw position data: poolKey, liquidity, tickLower, tickUpper, slot0, poolLiquidity
```

---

### `sdk.getUncollectedFees(tokenId)`

Calculates accrued but uncollected fees for a position.

```ts
const fees = await sdk.getUncollectedFees("12345");
// Returns: { amount0: bigint, amount1: bigint }
```

---

### `sdk.getTickInfo(args)`

Queries tick data from V4 StateView.

```ts
const tick = await sdk.getTickInfo({ poolKey, tick: 0 });
```

---

## Build Methods (Calldata generation)

These methods generate encoded transaction calldata. They do NOT send transactions.

### `sdk.buildSwapCallData(args)`

Builds Universal Router calldata for a swap.

```ts
const calldata = await sdk.buildSwapCallData({
  pool, // Pool instance (from getPool)
  amountIn: 1000000000000000000n,
  amountOutMinimum: 950000000000000000n,
  zeroForOne: true,
  recipient: "0xYourAddress",
  permit2Signature, // optional: from preparePermit2BatchData
  useNativeETH: false,
  deadlineDuration: 300, // optional: seconds
});
// Returns: Hex (encoded calldata)
```

**Args:** `BuildSwapCallDataArgs`

| Field              | Type                          | Required | Description                    |
| ------------------ | ----------------------------- | -------- | ------------------------------ |
| `pool`             | `Pool`                        | Yes      | V4 SDK Pool instance           |
| `amountIn`         | `bigint`                      | Yes      | Input amount (must be > 0)     |
| `amountOutMinimum` | `bigint`                      | Yes      | Min output after slippage      |
| `zeroForOne`       | `boolean`                     | Yes      | Swap direction                 |
| `recipient`        | `Address`                     | Yes      | Output token recipient         |
| `permit2Signature` | `BatchPermitOptions`          | No       | Permit2 batch signature        |
| `deadlineDuration` | `number`                      | No       | Seconds from now (default 300) |
| `useNativeETH`     | `boolean`                     | No       | Wrap/unwrap ETH for WETH pools |
| `customActions`    | `Array<{action, parameters}>` | No       | Override default swap actions  |

**Returns:** `Promise<Hex>` — encoded `execute()` calldata for Universal Router.

---

### `sdk.buildAddLiquidityCallData(args)`

Builds PositionManager calldata for minting a new position.

```ts
const { calldata, value } = await sdk.buildAddLiquidityCallData({
  pool,
  amount0: "100000000", // token0 amount as string
  amount1: "50000000000000000", // token1 amount as string
  recipient: "0xYourAddress",
  tickLower: -887220, // optional, defaults to full range
  tickUpper: 887220, // optional, defaults to full range
  slippageTolerance: 50, // optional, 0.5%
  permit2BatchSignature, // optional
});
```

**Args:** `BuildAddLiquidityArgs`

| Field                   | Type                 | Required     | Description                               |
| ----------------------- | -------------------- | ------------ | ----------------------------------------- |
| `pool`                  | `Pool`               | Yes          | V4 SDK Pool instance                      |
| `amount0`               | `string`             | One required | Amount of currency0 (smallest unit)       |
| `amount1`               | `string`             | One required | Amount of currency1 (smallest unit)       |
| `recipient`             | `Address`            | Yes          | Position NFT recipient                    |
| `tickLower`             | `number`             | No           | Lower tick (default: full range MIN_TICK) |
| `tickUpper`             | `number`             | No           | Upper tick (default: full range MAX_TICK) |
| `slippageTolerance`     | `number`             | No           | BPS (default: SDK default, 50)            |
| `deadlineDuration`      | `number`             | No           | Seconds from now                          |
| `permit2BatchSignature` | `BatchPermitOptions` | No           | Permit2 batch signature                   |

**Rules:**

- Existing pool with liquidity: only one of amount0/amount1 needed (other computed from price)
- New pool (zero liquidity): both amount0 AND amount1 required (used to set initial price)
- Tick values must be multiples of `pool.tickSpacing`
- `tickLower` must be < `tickUpper`

**Returns:** `Promise<{ calldata: string, value: string }>` — calldata for PositionManager, value is native currency to send (stringified bigint).

---

### `sdk.buildRemoveLiquidityCallData(args)`

Builds calldata to remove liquidity from a position. Fetches position data internally.

```ts
const { calldata, value } = await sdk.buildRemoveLiquidityCallData({
  tokenId: "12345",
  liquidityPercentage: 100_00, // 100% removal (in BPS)
  slippageTolerance: 50, // optional
});
```

**Args:** `BuildRemoveLiquidityCallDataArgs`

| Field                 | Type     | Required | Description                  |
| --------------------- | -------- | -------- | ---------------------------- |
| `tokenId`             | `string` | Yes      | Position NFT token ID        |
| `liquidityPercentage` | `number` | Yes      | BPS to remove (10000 = 100%) |
| `slippageTolerance`   | `number` | No       | BPS (default: SDK default)   |
| `deadlineDuration`    | `number` | No       | Seconds from now             |

**Returns:** `Promise<{ calldata: string, value: string }>`

---

### `sdk.buildCollectFeesCallData(args)`

Builds calldata to collect accrued fees from a position. Fetches position data internally.

```ts
const { calldata, value } = await sdk.buildCollectFeesCallData({
  tokenId: "12345",
  recipient: "0xYourAddress",
});
```

**Args:** `BuildCollectFeesCallDataArgs`

| Field              | Type      | Required | Description           |
| ------------------ | --------- | -------- | --------------------- |
| `tokenId`          | `string`  | Yes      | Position NFT token ID |
| `recipient`        | `Address` | Yes      | Fee recipient address |
| `deadlineDuration` | `number`  | No       | Seconds from now      |

**Returns:** `Promise<{ calldata: string, value: string }>`

---

## Permit2

### `sdk.preparePermit2BatchData(args)`

Prepares Permit2 batch approval data for multiple tokens. Use this before building swap or liquidity calldata.

```ts
const permitData = await sdk.preparePermit2BatchData({
  tokens: [currency0Address, currency1Address],
  spender: positionManagerAddress,
  owner: userWalletAddress,
});

// Sign with viem wallet client:
const signature = await walletClient.signTypedData({
  domain: permitData.toSign.domain,
  types: permitData.toSign.types,
  primaryType: permitData.toSign.primaryType,
  message: permitData.toSign.message,
});

// Build the final permit object:
const permit2Signature = permitData.buildPermit2BatchDataWithSignature(signature);

// Pass to buildSwapCallData or buildAddLiquidityCallData
```

**Args:** `PreparePermit2BatchDataArgs`

| Field              | Type        | Required | Description                     |
| ------------------ | ----------- | -------- | ------------------------------- |
| `tokens`           | `Address[]` | Yes      | Token addresses to permit       |
| `spender`          | `Address`   | Yes      | Contract that will spend tokens |
| `owner`            | `Address`   | Yes      | User's wallet address           |
| `deadlineDuration` | `number`    | No       | Seconds from now                |

---

## Helper Functions

### `calculateMinimumOutput(expectedOutput, slippageBps)`

```ts
import { calculateMinimumOutput } from "@zahastudio/uniswap-sdk";
const minOut = calculateMinimumOutput(1_000_000n, 50); // 995_000n (0.5% slippage)
```

### `sortTokens(address0, address1)`

```ts
import { sortTokens } from "@zahastudio/uniswap-sdk";
const [currency0, currency1] = sortTokens(tokenA, tokenB);
```

### `percentFromBips(bps)`

```ts
import { percentFromBips } from "@zahastudio/uniswap-sdk";
const slippage = percentFromBips(50); // Percent instance representing 0.5%
```

### `CacheAdapter` Interface

```ts
interface CacheAdapter {
  get<T>(key: string): T | undefined | Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs?: number): void | Promise<void>;
}
```

Supply a custom cache (e.g., Redis) via `UniswapSDK.create(client, chainId, { cache: myAdapter })`.

---

## Accessor Properties

| Property                       | Type     | Description                       |
| ------------------------------ | -------- | --------------------------------- |
| `sdk.defaultDeadline`          | `number` | Default deadline offset (seconds) |
| `sdk.defaultSlippageTolerance` | `number` | Default slippage (BPS)            |

### `sdk.getContractAddress(name)`

Returns the address of a specific V4 contract.

```ts
const router = sdk.getContractAddress("universalRouter");
const pm = sdk.getContractAddress("positionManager");
// Valid names: poolManager, positionManager, quoter, stateView, universalRouter, permit2, weth
```
