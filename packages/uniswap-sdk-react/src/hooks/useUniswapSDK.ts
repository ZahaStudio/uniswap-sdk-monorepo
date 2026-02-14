"use client";

import { useContext, useMemo } from "react";

import { UniswapSDK } from "@zahastudio/uniswap-sdk";
import { useChainId, usePublicClient } from "wagmi";

import { UniswapSDKContext } from "../provider/UniswapSDKProvider";

/**
 * Return type for the useUniswapSDK hook.
 */
export interface UseUniswapSDKReturn {
  /** The SDK instance */
  sdk: UniswapSDK;
  /** Whether the SDK is initialized */
  isInitialized: boolean;
  /** The effective chain ID being used */
  chainId: number;
}

/**
 * Options for the useUniswapSDK hook.
 */
export interface UseUniswapSDKOptions {
  /**
   * Chain ID to use. If omitted, uses the currently connected chain.
   * The SDK instance is cached per chain, so passing the same chainId
   * across multiple hooks reuses the same instance.
   */
  chainId?: number;
}

/**
 * Hook to access a Uniswap SDK instance for a specific chain.
 *
 * SDK instances are cached and deduped — calling this hook multiple times
 * with the same chainId (or no chainId) returns the same instance.
 *
 * @param options - Optional configuration for the hook.
 * @returns The SDK context value containing the SDK instance and initialization state.
 * @throws Error if used outside of UniswapSDKProvider
 *
 * @example Using the connected chain (default)
 * ```tsx
 * function MyComponent() {
 *   const { sdk, isInitialized } = useUniswapSDK();
 *
 *   const fetchData = async () => {
 *     if (!sdk) return;
 *     const position = await sdk.getPosition(tokenId);
 *   };
 * }
 * ```
 *
 * @example Using a specific chain
 * ```tsx
 * function CrossChainComponent() {
 *   const mainnet = useUniswapSDK({ chainId: 1 });
 *   const arbitrum = useUniswapSDK({ chainId: 42161 });
 *
 *   // Both are cached — no duplicate instances
 * }
 * ```
 */
export function useUniswapSDK(options: UseUniswapSDKOptions = {}): UseUniswapSDKReturn {
  const context = useContext(UniswapSDKContext);

  if (!context) {
    throw new Error(
      "useUniswapSDK must be used within UniswapSDKProvider. " +
        "Ensure UniswapSDKProvider is wrapped inside WagmiProvider and QueryClientProvider.",
    );
  }

  const connectedChainId = useChainId();
  const effectiveChainId = options.chainId ?? connectedChainId;
  const publicClient = usePublicClient({ chainId: effectiveChainId });

  const sdk = useMemo(() => {
    if (!publicClient) {
      throw new Error(`No public client available for chain ID ${effectiveChainId}`);
    }

    const instance = context.getSdk({
      chainId: effectiveChainId,
      publicClient,
    });
    return instance;
  }, [context, effectiveChainId, publicClient]);

  return {
    sdk,
    isInitialized: sdk !== null,
    chainId: effectiveChainId,
  };
}
