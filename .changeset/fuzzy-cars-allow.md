---
"@zahastudio/uniswap-sdk": minor
"@zahastudio/uniswap-sdk-react": minor
---

Replace the single-hop swap API with a route-based exact-input API across the core SDK and React hooks.

`getQuote`, `buildSwapCallData`, and `useSwap` now accept `currencyIn` plus an ordered `route` array, so single-hop swaps are expressed as a one-element route and multi-hop swaps use the same surface.
