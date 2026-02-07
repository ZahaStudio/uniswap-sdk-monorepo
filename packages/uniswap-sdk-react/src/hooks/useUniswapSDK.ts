"use client";

import { useContext, useEffect, useMemo, useState } from "react";

import { UniswapSDK } from "@zahastudio/uniswap-sdk";
import { useChainId, usePublicClient } from "wagmi";

import { UniswapSDKContext } from "../provider/UniswapSDKProvider";

/**
 * Return type for the useUniswapSDK hook.
 */
export interface UseUniswapSDKReturn {
  /** The SDK instance (null until initialized) */
  sdk: UniswapSDK | null;
  /** Promise that resolves to the SDK instance */
  sdkPromise: Promise<UniswapSDK>;
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
 *   const { sdk, sdkPromise, isInitialized } = useUniswapSDK();
 *
 *   const fetchData = async () => {
 *     const sdk = await sdkPromise;
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
  const contracts = context.contracts?.[effectiveChainId];

  const [sdk, setSDK] = useState<UniswapSDK | null>(null);
  const [trackedPromise, setTrackedPromise] = useState<Promise<UniswapSDK> | null>(null);

  // Create or retrieve cached SDK promise for the effective chain
  const sdkPromise = useMemo(() => {
    // Return cached promise if one exists for this chain
    const cached = context.sdkCache.get(effectiveChainId);
    if (cached) return cached;

    if (!publicClient) {
      // Don't cache rejected promises — the client may become available later
      const rejected = Promise.reject(
        new Error(
          `No public client available for chain ${effectiveChainId}. ` +
            "Ensure the chain is configured in your WagmiProvider.",
        ),
      );
      rejected.catch(() => {}); // Prevent unhandled rejection
      return rejected;
    }

    const promise = UniswapSDK.create(publicClient, contracts);
    context.sdkCache.set(effectiveChainId, promise);
    return promise;
  }, [context.sdkCache, effectiveChainId, publicClient, contracts]);

  // Reset SDK synchronously during render when the promise changes
  if (sdkPromise !== trackedPromise) {
    setTrackedPromise(sdkPromise);
    setSDK(null);
  }

  // Track initialization reactively
  useEffect(() => {
    let cancelled = false;

    sdkPromise
      .then((instance) => {
        if (!cancelled) setSDK(instance);
      })
      .catch(() => {
        // SDK creation failed — sdk stays null
      });

    return () => {
      cancelled = true;
    };
  }, [sdkPromise]);

  return {
    sdk,
    sdkPromise,
    isInitialized: sdk !== null,
    chainId: effectiveChainId,
  };
}
