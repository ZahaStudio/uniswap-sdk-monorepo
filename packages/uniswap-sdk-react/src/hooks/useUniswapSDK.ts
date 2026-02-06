"use client";

import { useContext } from "react";

import {
  UniswapSDKContext,
  type UniswapSDKContextValue,
} from "../provider/UniswapSDKProvider";

/**
 * Hook to access the Uniswap SDK context.
 *
 * @returns The SDK context value containing the SDK instance and initialization state.
 * @throws Error if used outside of UniswapSDKProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { sdk, sdkPromise, isInitialized } = useUniswapSDK();
 *
 *   // Use sdkPromise for async operations
 *   const fetchData = async () => {
 *     const sdk = await sdkPromise;
 *     const position = await sdk.getPosition(tokenId);
 *   };
 * }
 * ```
 */
export function useUniswapSDK(): UniswapSDKContextValue {
  const context = useContext(UniswapSDKContext);

  if (!context) {
    throw new Error(
      "useUniswapSDK must be used within UniswapSDKProvider. " +
        "Ensure UniswapSDKProvider is wrapped inside WagmiProvider and QueryClientProvider."
    );
  }

  return context;
}
