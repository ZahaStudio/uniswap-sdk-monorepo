# @zahastudio/uniswap-sdk

## 0.5.0

### Minor Changes

- [#32](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/32) [`5f5a4e8`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/5f5a4e8cc2e4cbe38c363e6b69ff995ab3e5a81c) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Replace the single-hop swap API with a route-based exact-input API across the core SDK and React hooks.

  `getQuote`, `buildSwapCallData`, and `useSwap` now accept `currencyIn` plus an ordered `route` array, so single-hop swaps are expressed as a one-element route and multi-hop swaps use the same surface.

## 0.4.0

### Minor Changes

- [`ec0ca22`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/ec0ca22884260a211950c1f98007cab3a86c462b) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Normalize transaction flow and global asserts
