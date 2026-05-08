# Spec: EIP-5792 Batched Wallet Calls

## Objective

Add EIP-5792 Wallet Call API support to the SDK so applications can submit required ERC-20 approvals and the final Uniswap action as one atomic wallet call batch when the connected wallet supports atomic batching.

Primary users are application developers using `@zahastudio/uniswap-sdk` and `@zahastudio/uniswap-sdk-react` for Uniswap v4 swap and liquidity flows.

The first implementation covers swap, create-position, and increase-liquidity flows. Existing sequential execution remains available and unchanged. Batched execution is exposed through separate `executeBatch`-style functions.

Acceptance criteria:

- Swap flows can batch required ERC-20 approvals to Permit2 plus the final Universal Router execution call.
- Create-position and increase-liquidity flows can batch required ERC-20 approvals to Permit2 plus the final Position Manager execution call.
- Permit2 signed permits remain embedded in existing Universal Router / Position Manager calldata builders.
- Atomic wallet capability statuses `supported` and `ready` are accepted for atomic batches.
- If atomic batching is requested but unsupported, no calls are submitted and the caller receives an explicit error.
- EIP-7702 is out of scope for this feature.

## Tech Stack

- TypeScript 6.x
- pnpm 10.x workspace
- `@zahastudio/uniswap-sdk` core package
- `@zahastudio/uniswap-sdk-react` React package
- viem 2.x for Ethereum primitive types and calldata encoding
- wagmi 2.x for React wallet integration
- Vitest 4.x for unit tests in core
- oxlint / oxfmt for lint and formatting

## Commands

- Install: `pnpm install`
- Build all: `pnpm build`
- Build core: `pnpm --filter @zahastudio/uniswap-sdk build`
- Build React: `pnpm --filter @zahastudio/uniswap-sdk-react build`
- Typecheck all: `pnpm typecheck`
- Typecheck core: `pnpm --filter @zahastudio/uniswap-sdk typecheck`
- Typecheck React: `pnpm --filter @zahastudio/uniswap-sdk-react typecheck`
- Test all: `pnpm test`
- Test core: `pnpm --filter @zahastudio/uniswap-sdk test`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Format check: `pnpm format:check`

## Project Structure

```text
packages/uniswap-sdk/src/core/       -> UniswapSDK class and core public API
packages/uniswap-sdk/src/utils/      -> Core calldata, Permit2, and EIP-5792 helpers
packages/uniswap-sdk/src/index.ts    -> Core package exports
packages/uniswap-sdk/test/unit/      -> Core unit tests
packages/uniswap-sdk-react/src/hooks/            -> React workflow hooks
packages/uniswap-sdk-react/src/hooks/primitives/ -> Reusable wallet/transaction primitives
packages/uniswap-sdk-react/src/types/            -> React package public types
packages/uniswap-sdk-react/test/types/           -> React type-level checks
docs/                                -> User and agent documentation
docs/specs/                          -> Living implementation specs
```

## Code Style

Use explicit TypeScript interfaces at public boundaries, discriminated unions for status variants, camelCase names, and additive APIs. Keep batch execution separate from existing sequential functions.

```ts
const result = await swap.steps.swap.executeBatch();

if (result.status.status === "success") {
  console.log(result.id);
}
```

Core batch type shape:

```ts
import type { WalletBatchCall } from "@zahastudio/uniswap-sdk";

const calls: WalletBatchCall[] = [
  { to: tokenAddress, data: approveCalldata, value: 0n },
  { to: universalRouter, data: swapCalldata, value: BigInt(value) },
];
```

Conventions:

- Public EIP-5792 names include `Wallet` or `Batch` for clarity.
- Existing sequential APIs are not renamed or removed.
- React submits calls through wagmi/viem wallet call actions instead of exposing raw `wallet_sendCalls` formatters.
- Throw explicit errors for unsupported atomic batching before submitting calls.

## Testing Strategy

- React typechecks cover `executeBatch` API presence and return types where practical.
- Existing build/typecheck commands verify package integration.
- No live wallet or browser test is required for the first implementation because EIP-5792 support varies by wallet and provider.
- Manual app verification can be added later against a known EIP-5792 wallet.

## Boundaries

- Always: Preserve existing sequential execution behavior.
- Always: Submit calls in approval-then-action order.
- Always: Treat `atomic.status` values `supported` and `ready` as valid for atomic batch execution.
- Always: Fail before submission when atomic batching is required but unsupported.
- Always: Keep Permit2 signed permits embedded in existing Uniswap calldata builders.
- Ask first: Add dependencies.
- Ask first: Change package export paths or remove public APIs.
- Ask first: Add EIP-7702 behavior.
- Never: Submit a partial batch after detecting unsupported atomic capability.
- Never: Commit secrets or wallet private keys.
- Never: Remove failing tests to make verification pass.

## Success Criteria

- `@zahastudio/uniswap-sdk` exports EIP-5792-compatible types and helper functions.
- `@zahastudio/uniswap-sdk-react` exposes `executeBatch` for swap, create-position, and increase-liquidity flows.
- `executeBatch` sends `wallet_sendCalls` only after confirming atomic capability is `supported` or `ready` for the selected chain.
- `executeBatch` returns the EIP-5792 batch ID and status data once available.
- Required ERC-20 approvals are included as wallet calls only when allowance is insufficient.
- The final Uniswap action call uses existing calldata builders and includes existing Permit2 signed permit data.
- Existing `execute` and `executeAll` functions continue to compile and behave as before.
- Relevant typecheck and test commands pass.

## Open Questions

- Should batched execution later support optional wallet capabilities such as paymasters?
- Should remove-liquidity and collect-fees get batch status helpers even though they do not require approval batching in the initial scope?
- Should the example app include a wallet capability indicator after the SDK API lands?
