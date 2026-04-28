# @zahastudio/uniswap-sdk-react

## 0.5.0

### Minor Changes

- [#34](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/34) [`884adab`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/884adaba7bf62ef3f9dbe261c8e219e1e78a6ba7) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Exact Out Routing

- [#32](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/32) [`5f5a4e8`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/5f5a4e8cc2e4cbe38c363e6b69ff995ab3e5a81c) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Replace the single-hop swap API with a route-based exact-input API across the core SDK and React hooks.

  `getQuote`, `buildSwapCallData`, and `useSwap` now accept `currencyIn` plus an ordered `route` array, so single-hop swaps are expressed as a one-element route and multi-hop swaps use the same surface.

- [#35](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/35) [`f203fae`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/f203faeb2d4afd9cc6a51e2dcbed80f5808e999e) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Formalize support for hookData

### Patch Changes

- [#36](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/36) [`8ab89a9`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/8ab89a9c314156e87f394846183055e3668bc0a2) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Ship TanStack Intent agent skills with the v4 SDK packages.

- Updated dependencies [[`884adab`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/884adaba7bf62ef3f9dbe261c8e219e1e78a6ba7), [`5f5a4e8`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/5f5a4e8cc2e4cbe38c363e6b69ff995ab3e5a81c), [`8ab89a9`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/8ab89a9c314156e87f394846183055e3668bc0a2), [`f203fae`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/f203faeb2d4afd9cc6a51e2dcbed80f5808e999e)]:
  - @zahastudio/uniswap-sdk@0.5.0

## 0.4.0

### Minor Changes

- [`ec0ca22`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/ec0ca22884260a211950c1f98007cab3a86c462b) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Normalize transaction flow and global asserts

### Patch Changes

- Updated dependencies [[`ec0ca22`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/ec0ca22884260a211950c1f98007cab3a86c462b)]:
  - @zahastudio/uniswap-sdk@0.4.0
