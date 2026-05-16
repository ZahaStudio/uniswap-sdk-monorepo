# Spec: Swap UI for `apps/web-start`

## Assumptions
- This spec covers the swap UI for this monorepo's Uniswap SDK packages: `@zahastudio/uniswap-sdk` and `@zahastudio/uniswap-sdk-react`.
- The UI should live inside the existing TanStack Start app shell in `apps/web-start`.
- The implementation should reuse shadcn components wherever they fit instead of building custom primitives.
- Swap quoting and execution state should come from `@zahastudio/uniswap-sdk-react` whenever wallet/provider setup is available.
- Core SDK APIs from `@zahastudio/uniswap-sdk` define the data semantics for route, quote, slippage, Permit2, Universal Router calldata, and native token handling.
- The app currently has no test setup, ESLint, or Prettier configuration, so verification should use build and typecheck unless that changes.

## Objective
Build a swap screen in `apps/web-start` that demonstrates and exercises this repo's Uniswap SDK. The UI should let a user choose input/output tokens from supported SDK route definitions, enter an exact-input swap amount, review quote details returned by `useSwap`, step through approval/Permit2/swap execution states, configure slippage, and see clear connection, loading, empty, warning, and error states.

The first implementation should be SDK-first, not mock-first. It may use a small local token/route catalog for available pairs, but quote and transaction lifecycle state should be wired to `useSwap` from `@zahastudio/uniswap-sdk-react`.

## Tech Stack
- TanStack Start for routing and app shell integration.
- React 19 with TypeScript.
- Tailwind CSS v4 through the existing shadcn setup.
- shadcn components installed through `pnpm dlx shadcn@latest add ...`.
- `@zahastudio/uniswap-sdk-react` for React hooks and swap lifecycle.
- `@zahastudio/uniswap-sdk` for exported core types and helpers.
- `wagmi`, `viem`, and `@tanstack/react-query` as required React SDK peers.
- Existing app shell components under `apps/web-start/src/components`.

## Commands
- Dev server: `pnpm --filter web-start dev`
- Build: `pnpm --filter web-start build`
- Typecheck: `pnpm --filter web-start typecheck`
- Add shadcn components: `cd apps/web-start && pnpm dlx shadcn@latest add <components>`
- Add SDK dependencies: `pnpm --filter web-start add @zahastudio/uniswap-sdk-react@workspace:* @zahastudio/uniswap-sdk@workspace:* @tanstack/react-query@catalog: wagmi@catalog: viem@catalog:`

## Project Structure
- `apps/web-start/src/routes/swap.tsx`  
  Route entry for `/swap`. Keep this thin and delegate to page/components.

- `apps/web-start/src/components/swap/swap-page.tsx`  
  Page layout, header copy, shell spacing, SDK provider assumptions, and high-level state composition.

- `apps/web-start/src/components/swap/swap-form.tsx`  
  Main swap card: token inputs, switch direction button, quote summary, and SDK lifecycle action controls.

- `apps/web-start/src/components/swap/token-selector.tsx`  
  Token picker dialog/sheet using searchable shadcn primitives and the supported token catalog.

- `apps/web-start/src/components/swap/swap-settings.tsx`  
  Slippage, deadline, and expert-mode controls.

- `apps/web-start/src/components/swap/quote-details.tsx`  
  Price, route, minimum received, fee, gas estimate, price impact, and expandable detail rows.

- `apps/web-start/src/components/swap/types.ts`  
  UI-facing token, route, and form-state types that map cleanly to SDK params.

- `apps/web-start/src/components/swap/routes.ts`  
  Supported token/pool route definitions. Each swap pair must include the SDK `poolKey` shape required by `useSwap`: `currency0`, `currency1`, `fee`, `tickSpacing`, and `hooks`, plus optional `hookData`.

- `apps/web-start/src/components/swap/use-swap-form.ts`  
  Local form state and derived `UseSwapParams` construction. Keep SDK hook invocation in React components/hooks, not in presentational rows.

- `apps/web-start/src/components/providers/web3-provider.tsx`  
  Wagmi, TanStack Query, and `UniswapSDKProvider` setup if these providers are not already present.

## shadcn Component Reuse
Use these existing or newly added shadcn components as the default building blocks:

- `Card`: outer swap container and quote detail panels.
- `Field`, `FieldGroup`, `FieldLabel`, `FieldDescription`: form layout and accessible labels.
- `Input` and `InputGroup`: amount entry and recipient entry.
- `Button`: primary action, direction switch, token selector trigger, retry actions.
- `Badge`: network status, token tags, warning labels, price impact severity.
- `Dialog` or `Sheet`: token selector on desktop/mobile. Prefer `Sheet` for mobile token search if the viewport is narrow.
- `Command`: searchable token list with keyboard support.
- `ScrollArea`: token results and route details when lists overflow.
- `Avatar`: token icons with fallback initials.
- `Separator`: visual grouping between quote rows and form sections.
- `Tooltip`: help text for price impact, minimum received, route, and slippage.
- `Popover`: compact swap settings panel from the card header.
- `Select` or `ToggleGroup`: slippage presets and network selection if needed.
- `Alert`: insufficient balance, high price impact, wallet/network mismatch, quote failure.
- `Skeleton`: quote loading state and token list loading state.
- `DropdownMenu`: optional recent tokens or wallet/account menu actions.
- `Tabs`: optional split between `Swap`, `Limit`, or future swap modes. Do not add tabs until a second mode exists.

Preferred install command for missing components:

```bash
cd apps/web-start && pnpm dlx shadcn@latest add card field input-group badge dialog sheet command scroll-area popover select toggle-group alert skeleton
```

## UX Requirements
- The `/swap` route appears in the app sidebar as `Swap` and is marked active on that route.
- The swap card has two token amount panels: `You pay` and `You receive`.
- Token selection opens a searchable list with token symbol, name, icon/fallback, balance, and optional chain badge.
- Token pairs are limited to routes that the SDK can quote with known Uniswap v4 `PoolKey` data.
- The direction switch swaps input/output token selections and amounts where safe.
- The primary action reflects state:
  - `Connect wallet` when no wallet is connected.
  - `Enter an amount` when amount is empty.
  - `Select token` when either token is missing.
  - `Unsupported pair` when no SDK route definition exists for the selected pair.
  - `Insufficient balance` when amount exceeds balance.
  - `Approve token` when `useSwap().currentStep === "approval"`.
  - `Sign Permit2` when `useSwap().currentStep === "permit2"`.
  - `Swap` when `useSwap().currentStep === "swap"`.
  - `Swap complete` when `useSwap().currentStep === "completed"`.
  - `Swap unavailable` when quote fails.
- Quote details are visible only after a valid amount, token pair, and route are selected.
- Loading quote state uses `useSwap().steps.quote` status and shadcn `Skeleton`, not a custom spinner-only layout.
- Warnings use shadcn `Alert` and must include text, not color alone.
- Settings should include slippage presets plus a custom value input.
- The UI should expose both one-click `executeAll()` and, when supported by the connected wallet, atomic EIP-5792 `executeBatch()` as a clearly labeled advanced action.

## State Model
Use simple controlled React state for user input and derive SDK params from it. Do not duplicate SDK lifecycle state into local state.

```ts
export type SwapToken = {
  chainId: number
  address: string
  symbol: string
  name: string
  decimals: number
  logoUrl?: string
  balance?: string
}

export type SwapRouteDefinition = {
  inputCurrency: `0x${string}`
  outputCurrency: `0x${string}`
  poolKey: {
    currency0: `0x${string}`
    currency1: `0x${string}`
    fee: number
    tickSpacing: number
    hooks: `0x${string}`
  }
  hookData?: `0x${string}`
}

export type SwapFormState = {
  inputToken: SwapToken | null
  outputToken: SwapToken | null
  inputAmount: string
  slippageBps: number
  recipient?: string
}
```

Derived SDK params should follow the React SDK contract:

```ts
const swap = useSwap(
  {
    route: [{ poolKey: route.poolKey, hookData: route.hookData }],
    exactInput: {
      currency: form.inputToken.address,
      amount: parsedInputAmount,
    },
    slippageBps: form.slippageBps,
    recipient,
    useNativeToken,
  },
  {
    enabled: canQuote,
    refetchInterval: 12000,
  },
)
```

Quote detail rows should read from `swap.steps.quote.data`. Execution controls should call `swap.steps.approval.approve()`, `swap.steps.permit2.sign()`, `swap.steps.swap.execute()`, `swap.executeAll()`, or `swap.executeBatch()` according to the selected flow.

## Code Style
Prefer small presentational components with explicit props. Use shadcn composition directly instead of custom wrapper abstractions until duplication is proven.

```tsx
<Field>
  <FieldLabel>You pay</FieldLabel>
  <InputGroup>
    <Input
      inputMode="decimal"
      placeholder="0"
      value={inputAmount}
      onChange={(event) => onInputAmountChange(event.target.value)}
    />
    <Button type="button" variant="outline" onClick={onSelectInputToken}>
      {inputToken?.symbol ?? "Select token"}
    </Button>
  </InputGroup>
  <FieldDescription>
    Balance: {inputToken?.balance ?? "0"}
  </FieldDescription>
</Field>
```

Conventions:
- Use `@/components/...` and `@/lib/...` aliases.
- Use semantic Tailwind tokens like `bg-background`, `text-muted-foreground`, `border-border`.
- Use `gap-*`, not `space-*`.
- Use shadcn components before adding custom styled markup.
- Keep SDK route derivation and `useSwap` orchestration out of presentational components.
- Treat `bigint` amounts as raw token units and format them at display boundaries.
- Use SDK slippage fields from the quote response instead of recalculating minimum output in the component when available.

## Testing Strategy
No test framework is currently configured in `apps/web-start`.

For the first implementation:
- Type safety is the primary automated check: `pnpm --filter web-start typecheck`.
- Build verification: `pnpm --filter web-start build`.
- Manual browser verification should cover desktop and mobile widths, disconnected wallet state, connected wallet state, quote loading, quote error, approval required, Permit2 required, and swap ready states.

If test infrastructure is reintroduced later:
- Component tests should cover token selection, disabled action states, direction switching, and quote detail rendering.
- Hook tests should cover quote loading, quote error, stale quote, and high price impact states.

## Boundaries
- Always: use shadcn components for form controls, overlays, alerts, loading states, and navigation primitives when available.
- Always: use `@zahastudio/uniswap-sdk-react` for quote and execution lifecycle in the React UI.
- Always: use `@zahastudio/uniswap-sdk` exported types/helpers when building route and amount plumbing.
- Always: keep the swap route accessible by keyboard.
- Always: show text labels for error and warning states.
- Always: keep SDK/wallet calls behind hooks or service functions.
- Always: require known route definitions before invoking `useSwap`.
- Ask first: adding wallet dependencies, new data-fetching libraries, or test tooling.
- Ask first: changing workspace scripts or reintroducing lint/format tooling.
- Ask first: adding support for exact-output swaps in the UI.
- Ask first: adding route discovery or external token-list fetching.
- Never: hardcode private RPC URLs, API keys, or wallet secrets.
- Never: make swaps execute from mocked quotes or locally fabricated calldata.
- Never: hide high-price-impact warnings behind color-only UI.

## Success Criteria
- `/swap` renders inside the existing app shell.
- Sidebar navigation includes a `Swap` item with active-state behavior.
- `apps/web-start` depends on the local workspace SDK packages, not published npm versions.
- The app has provider setup for wagmi, TanStack Query, and `UniswapSDKProvider`.
- User can select input and output tokens through a shadcn-powered searchable selector constrained to supported SDK route definitions.
- User can enter an exact-input amount and see quote detail rows from `useSwap().steps.quote`.
- Primary action changes label and disabled state based on form validity and `useSwap().currentStep`.
- Approval, Permit2 signature, swap execution, and batch execution states are represented in the UI.
- Slippage settings are available through a shadcn overlay.
- Loading, empty, warning, and error states use shadcn primitives.
- `pnpm --filter web-start typecheck` passes.
- `pnpm --filter web-start build` passes.

## Open Questions
- Should `/` redirect to `/swap`, or should swap remain a separate sidebar item?
- Which wagmi connector setup should the demo app use?
- Which chains and Uniswap v4 pool route definitions should be available by default?
- Should quote fetching call `useSwap` directly in the route component tree, or should we add a thin app-specific wrapper hook around it?
- Should the first implementation include only exact-input swaps, or also exact-output swaps?
- Should EIP-5792 batch execution be shown by default or hidden behind advanced settings?
