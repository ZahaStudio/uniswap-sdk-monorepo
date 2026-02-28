# Community Uniswap SDK — AI Agent Reference

> This documentation is optimized for AI agents building applications with the Community Uniswap SDK. It contains complete type signatures, decision trees, and copy-paste code patterns.

## Packages

| Package                         | Install                                                                                           | Purpose                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `@zahastudio/uniswap-sdk`       | `pnpm add @zahastudio/uniswap-sdk viem`                                                           | Core SDK — framework-agnostic, works with any viem `PublicClient` |
| `@zahastudio/uniswap-sdk-react` | `pnpm add @zahastudio/uniswap-sdk-react @zahastudio/uniswap-sdk viem wagmi @tanstack/react-query` | React hooks & provider built on wagmi + TanStack Query            |

## When to use which package

- **Building a Node.js script, server, or non-React frontend?** → Use `@zahastudio/uniswap-sdk` (core)
- **Building a React/Next.js app?** → Use `@zahastudio/uniswap-sdk-react` (it re-exports core types you need)

## Documentation Map

| Document                      | Contents                                                           |
| ----------------------------- | ------------------------------------------------------------------ |
| [Core SDK](./core-sdk.md)     | `UniswapSDK` class, all methods, type signatures, standalone usage |
| [React SDK](./react-sdk.md)   | Provider setup, all hooks, step-based lifecycle patterns           |
| [Recipes](./recipes.md)       | Complete end-to-end code examples for common tasks                 |
| [Types Reference](./types.md) | Every exported type/interface with field descriptions              |

## Key Concepts

### Uniswap V4 Pool Keys

Every pool in V4 is identified by a `PoolKey` — a struct of `{ currency0, currency1, fee, tickSpacing, hooks }`. Currency addresses must be sorted (currency0 < currency1). The `hooks` address is `0x0000000000000000000000000000000000000000` for pools without hooks.

### Token Ordering

Tokens in a pool are always sorted by address. Use `sortTokens(addressA, addressB)` from the SDK to get the correct order. The "zero for one" direction (`zeroForOne: true`) means swapping currency0 → currency1.

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
│   └── uniswap-sdk-react/    # React hooks & provider
├── apps/
│   └── example/              # Next.js demo app
└── tooling/
    ├── acme-eslint/          # Shared ESLint config
    └── acme-tsconfig/        # Shared TypeScript config
```

## Development Commands

```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm dev              # Watch mode for all packages + example app
pnpm test             # Run tests
pnpm lint             # Lint
pnpm typecheck        # TypeScript type checking
```
