# @zahastudio/uniswap-sdk

## 1.0.0

### Major Changes

- [`3da283e`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/3da283eed162f36cab5217349cb3d3e36ac0e0d6) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Stable API Release

### Minor Changes

- [`30345c8`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/30345c877941e683ce37bcf2b8ea356662fff44c) Thanks [@akshatmittal](https://github.com/akshatmittal)! - EIP-5792 Atomic Batch Support

### Patch Changes

- [#37](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/37) [`f947bb3`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/f947bb343f1b9f961ed5db07c23b6db315055804) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Fix stable SDK package export metadata and refresh the SDK/Intent documentation so package discovery, examples, and agent guidance match the current public APIs.

## 0.5.0

### Minor Changes

- [#34](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/34) [`884adab`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/884adaba7bf62ef3f9dbe261c8e219e1e78a6ba7) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Exact Out Routing

- [#32](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/32) [`5f5a4e8`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/5f5a4e8cc2e4cbe38c363e6b69ff995ab3e5a81c) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Replace the single-hop swap API with a route-based exact-input API across the core SDK and React hooks.

  `getQuote`, `buildSwapCallData`, and `useSwap` now accept `currencyIn` plus an ordered `route` array, so single-hop swaps are expressed as a one-element route and multi-hop swaps use the same surface.

- [#35](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/35) [`f203fae`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/f203faeb2d4afd9cc6a51e2dcbed80f5808e999e) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Formalize support for hookData

### Patch Changes

- [#36](https://github.com/ZahaStudio/uniswap-sdk-monorepo/pull/36) [`8ab89a9`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/8ab89a9c314156e87f394846183055e3668bc0a2) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Ship TanStack Intent agent skills with the v4 SDK packages.

## 0.4.0

### Minor Changes

- [`ec0ca22`](https://github.com/ZahaStudio/uniswap-sdk-monorepo/commit/ec0ca22884260a211950c1f98007cab3a86c462b) Thanks [@akshatmittal](https://github.com/akshatmittal)! - Normalize transaction flow and global asserts
