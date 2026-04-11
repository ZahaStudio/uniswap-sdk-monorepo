# Community Uniswap SDK — AI Agent Reference

> This documentation is optimized for AI agents building applications with the Community Uniswap SDK. It covers the current public V4 SDK APIs, decision trees, and copy-paste code patterns.

## Packages

| Package                         | Install                                                                                           | Purpose                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `@zahastudio/uniswap-sdk`       | `pnpm add @zahastudio/uniswap-sdk viem`                                                           | Core SDK — framework-agnostic, works with any viem `PublicClient` |
| `@zahastudio/uniswap-sdk-react` | `pnpm add @zahastudio/uniswap-sdk-react @zahastudio/uniswap-sdk viem wagmi @tanstack/react-query` | React hooks & provider built on wagmi + TanStack Query            |

## When to use which package

- **Building a Node.js script, server, or non-React frontend?** → Use `@zahastudio/uniswap-sdk` (core)
- **Building a React/Next.js app?** → Use `@zahastudio/uniswap-sdk-react` alongside `@zahastudio/uniswap-sdk`

## Documentation Map

| Document                      | Contents                                                            |
| ----------------------------- | ------------------------------------------------------------------- |
| [Core SDK](./core-sdk.md)     | `UniswapSDK` class, all methods, type signatures, standalone usage  |
| [React SDK](./react-sdk.md)   | Provider setup, all hooks, step-based lifecycle patterns            |
| [Recipes](./recipes.md)       | Complete end-to-end code examples for common tasks                  |
| [Types Reference](./types.md) | Core SDK types plus the React hook types used throughout these docs |

These docs focus on the Uniswap V4 SDK packages. The experimental Trading SDK packages live in the same monorepo but are documented in the root `README.md` for now.

## Key Concepts

### Uniswap V4 Pool Keys

Every pool in V4 is identified by a `PoolKey` — a struct of `{ currency0, currency1, fee, tickSpacing, hooks }`. Currency addresses must be sorted (currency0 < currency1). The `hooks` address is `0x0000000000000000000000000000000000000000` for pools without hooks.

### Token Ordering

Tokens in a pool are always sorted by address. Use `sortTokens(addressA, addressB)` from the SDK to get the correct order. Swaps now use `currencyIn + route[]`, so direction is inferred from the current currency and each pool in the ordered route.

### Basis Points (BPS)

Slippage and fees use basis points: 1 bps = 0.01%, 50 bps = 0.5%, 100 bps = 1%, 10000 bps = 100%.

### Permit2

Uniswap V4 uses Permit2 for token approvals. The flow is:

1. ERC-20 `approve()` → Permit2 contract (one-time per token)
2. Off-chain Permit2 signature → spender (per transaction)
3. Transaction execution with permit2 signature attached

Native ETH does not require Permit2.

### Contract Addresses

Contract addresses are resolved automatically via the `hookmate` package for supported chains. You can override them by passing a `V4Contracts` object.

## Supported Chains

Chains are resolved via `hookmate`'s `getSupportedChains()`. Common chain IDs:

- Ethereum Mainnet: `1`
- Arbitrum One: `42161`
- Optimism: `10`
- Polygon: `137`
- Base: `8453`

## Monorepo Structure

```
uniswap-sdk-monorepo/
├── packages/
│   ├── uniswap-sdk/          # Core SDK (src/core/, src/utils/, src/helpers/)
│   ├── uniswap-sdk-react/    # React hooks & provider
│   ├── trading-sdk/          # Experimental Trading API SDK
│   └── trading-sdk-react/    # Experimental React hooks & provider
├── apps/
│   └── example/              # Next.js demo app
└── tooling/
    └── acme-tsconfig/        # Shared TypeScript config
```

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm dev              # Watch mode for all packages + example app
pnpm test             # Run tests
pnpm lint             # Lint
pnpm format           # Format
pnpm format:check     # Check formatting
pnpm typecheck        # TypeScript type checking
```
