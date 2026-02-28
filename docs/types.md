# Types Reference

All types are exported from `@zahastudio/uniswap-sdk`. The React package re-exports what it needs.

## Core SDK Types

### `V4Contracts`

```ts
interface V4Contracts {
  poolManager: Address; // V4 PoolManager contract
  positionManager: Address; // V4 PositionManager (NFT positions)
  quoter: Address; // V4 Quoter (swap simulation)
  stateView: Address; // V4 StateView (pool state queries)
  universalRouter: Address; // Universal Router (swap execution)
  permit2: Address; // Permit2 contract
  weth: Address; // Wrapped native token (WETH, WMATIC, etc.)
}
```

### `UniswapSDKOptions`

```ts
interface UniswapSDKOptions {
  contracts?: V4Contracts; // Override contract addresses
  cache?: CacheAdapter; // Custom cache (default: LRU)
  defaultDeadline?: number; // Seconds (default: 600)
  defaultSlippageTolerance?: number; // BPS (default: 50 = 0.5%)
}
```

### `CacheAdapter`

```ts
type CacheAdapter = {
  get<T>(key: string): T | undefined | Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs?: number): void | Promise<void>;
};
```

---

## Pool & Token Types

### `PoolKey` (from `@uniswap/v4-sdk`)

```ts
interface PoolKey {
  currency0: string; // Lower address
  currency1: string; // Higher address
  fee: number; // Fee tier (e.g., 500, 3000, 10000)
  tickSpacing: number; // Tick spacing (e.g., 10, 60, 200)
  hooks: string; // Hook contract address (zero address if none)
}
```

### `Pool` (from `@uniswap/v4-sdk`)

Represents a fully initialized V4 pool with current on-chain state. Key properties:

- `pool.sqrtRatioX96` — current price as Q64.96
- `pool.liquidity` — active liquidity
- `pool.tickCurrent` — current tick
- `pool.token0Price` / `pool.token1Price` — human-readable prices
- `pool.poolKey` — the pool key struct
- `pool.currency0` / `pool.currency1` — Currency instances
- `pool.tickSpacing` — tick spacing

### `Currency` (from `@uniswap/sdk-core`)

Base type for tokens. Can be `Token` (ERC-20) or `Ether` (native).

- `currency.symbol` — e.g., "WETH"
- `currency.name` — e.g., "Wrapped Ether"
- `currency.decimals` — e.g., 18
- `currency.isNative` — true for ETH
- `currency.address` — contract address (only for Token)
- `currency.chainId` — chain ID

### `Position` (from `@uniswap/v4-sdk`)

Represents a liquidity position. Key properties:

- `position.liquidity` — position liquidity
- `position.tickLower` / `position.tickUpper` — tick range
- `position.amount0` / `position.amount1` — token amounts as CurrencyAmount
- `position.pool` — the Pool instance

---

## Quote Types

### `SwapExactInSingle`

```ts
interface SwapExactInSingle {
  poolKey: PoolKey; // Pool to quote through
  zeroForOne: boolean; // true = currency0 → currency1
  amountIn: bigint | string; // Input amount (smallest unit)
  amountOutMinimum?: bigint | string; // Min output (default: "0")
  hookData?: Hex; // Custom hook data (default: "0x")
}
```

### `QuoteResponse`

```ts
interface QuoteResponse {
  amountOut: bigint; // Estimated output amount
  timestamp: number; // Unix timestamp (ms) when quote was fetched
}
```

---

## Swap Types

### `BuildSwapCallDataArgs`

```ts
interface BuildSwapCallDataArgs {
  amountIn: bigint; // Input amount (must be > 0)
  amountOutMinimum: bigint; // Min output after slippage
  pool: Pool; // V4 SDK Pool instance
  zeroForOne: boolean; // Swap direction
  recipient: Address; // Output recipient
  deadlineDuration?: number; // Seconds from now (default: 300)
  permit2Signature?: BatchPermitOptions; // Permit2 batch signature
  customActions?: Array<{
    // Override default swap actions
    action: Actions;
    parameters: unknown[];
  }>;
  useNativeETH?: boolean; // Wrap/unwrap ETH for WETH pools
}
```

---

## Liquidity Types

### `BuildAddLiquidityArgs`

```ts
interface BuildAddLiquidityArgs {
  pool: Pool; // V4 SDK Pool instance
  amount0?: string; // Token0 amount (smallest unit)
  amount1?: string; // Token1 amount (smallest unit)
  recipient: Address; // Position NFT recipient
  tickLower?: number; // Default: full range MIN_TICK
  tickUpper?: number; // Default: full range MAX_TICK
  slippageTolerance?: number; // BPS (default: SDK default)
  deadlineDuration?: number; // Seconds from now
  permit2BatchSignature?: BatchPermitOptions; // Permit2 batch signature
}
```

### `BuildCallDataResult`

```ts
interface BuildCallDataResult {
  calldata: string; // Encoded calldata
  value: string; // Native currency to send (stringified bigint)
}
```

### `BuildRemoveLiquidityCallDataArgs`

```ts
interface BuildRemoveLiquidityCallDataArgs {
  liquidityPercentage: number; // BPS (10000 = 100%)
  tokenId: string; // Position NFT ID
  slippageTolerance?: number; // BPS (default: SDK default)
  deadlineDuration?: number; // Seconds from now
}
```

### `BuildCollectFeesCallDataArgs`

```ts
interface BuildCollectFeesCallDataArgs {
  tokenId: string; // Position NFT ID
  recipient: Address; // Fee recipient
  deadlineDuration?: number; // Seconds from now
}
```

---

## Position Types

### `GetPositionResponse`

```ts
interface GetPositionResponse {
  position: Position; // V4 SDK Position instance
  pool: Pool; // V4 SDK Pool with current state
  currency0: Currency; // First token
  currency1: Currency; // Second token
  poolId: `0x${string}`; // Pool identifier
  tokenId: string; // Position NFT ID
  currentTick: number; // Current pool tick
}
```

### `GetPositionInfoResponse`

Lightweight position metadata (no SDK instances). Fields include:

- `poolKey` — the pool key
- `liquidity` — position liquidity (bigint)
- `tickLower` / `tickUpper` — tick range
- `slot0` — current pool slot0 data
- `poolLiquidity` — current pool liquidity

### `GetUncollectedFeesResponse`

```ts
interface GetUncollectedFeesResponse {
  amount0: bigint; // Uncollected fees in token0
  amount1: bigint; // Uncollected fees in token1
}
```

---

## Permit2 Types

### `PreparePermit2BatchDataArgs`

```ts
interface PreparePermit2BatchDataArgs {
  tokens: Address[]; // Token addresses to permit
  spender: Address; // Contract that will spend
  owner: Address; // User's wallet
  deadlineDuration?: number; // Seconds from now
}
```

### `PreparePermit2BatchDataResult`

```ts
interface PreparePermit2BatchDataResult {
  owner: Address;
  permitBatch: PermitBatch;
  toSign: {
    domain: { name; version; chainId; verifyingContract };
    types: PermitBatchData["types"];
    values: PermitBatch;
    primaryType: "PermitBatch";
    message: PermitBatch; // Use with wagmi signTypedData
  };
  buildPermit2BatchDataWithSignature: (signature: string | Hex) => BatchPermitOptions;
}
```

### Signing Permit2

**With viem:**

```ts
const sig = await walletClient.signTypedData({
  domain: result.toSign.domain,
  types: result.toSign.types,
  primaryType: result.toSign.primaryType,
  message: result.toSign.message,
});
```

**With ethers:**

```ts
const sig = await signer.signTypedData(result.toSign.domain, result.toSign.types, result.toSign.values);
```

---

## React-Specific Types

### `UseHookOptions`

```ts
interface UseHookOptions {
  chainId?: number; // Override chain (default: connected)
  enabled?: boolean; // Enable query (default: true)
  refetchInterval?: number | false; // Polling ms (recommend: 12000)
}
```

### `UseMutationHookOptions`

```ts
interface UseMutationHookOptions {
  chainId?: number;
  onSuccess?: () => void; // Fires on tx confirmation
}
```

### `UseSwapParams`

```ts
interface UseSwapParams {
  poolKey: PoolKey;
  amountIn: bigint;
  zeroForOne: boolean;
  recipient?: Address;
  slippageBps?: number;
  useNativeETH?: boolean;
}
```

### `UseCreatePositionParams`

```ts
interface UseCreatePositionParams {
  poolKey: PoolKey;
  amount0?: bigint;
  amount1?: bigint;
  tickLower?: number;
  tickUpper?: number;
}
```

### `CreatePositionArgs` (passed to `executeAll`)

```ts
interface CreatePositionArgs {
  recipient: Address;
  slippageTolerance?: number; // BPS
  deadlineDuration?: number; // Seconds
}
```

### Step Types

```ts
type SwapStep = "quote" | "approval" | "permit2" | "swap" | "completed";
type AddLiquidityStep = "approvalToken0" | "approvalToken1" | "permit2" | "execute" | "completed";
```

### `QuoteData` (extends QuoteResponse)

```ts
interface QuoteData extends QuoteResponse {
  minAmountOut: bigint; // After slippage adjustment
}
```

### `CalculatedPosition`

```ts
interface CalculatedPosition {
  amount0: bigint; // Raw token0 amount
  amount1: bigint; // Raw token1 amount
  formattedAmount0: string; // Human-readable token0
  formattedAmount1: string; // Human-readable token1
}
```
