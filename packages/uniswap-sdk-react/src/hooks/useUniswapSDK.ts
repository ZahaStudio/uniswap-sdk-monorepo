"use client";

import { useContext, useMemo } from "react";

import type { UniswapSDK } from "@zahastudio/uniswap-sdk";

import { useChainId, usePublicClient } from "wagmi";

import { UniswapSDKContext } from "../provider/UniswapSDKProvider";

/**
 * Return type for the useUniswapSDK hook.
 */
export interface UseUniswapSDKReturn {
  /** The SDK instance */
  sdk: UniswapSDK;
  /** The effective chain ID being used */
  chainId: number;
}

/**
 * Options for the useUniswapSDK hook.
 */
export interface UseUniswapSDKOptions {
  /**
   * Chain ID to use. If omitted, uses the currently connected chain.
   * SDK instances are cached by the nearest provider using only this chainId.
   */
  chainId?: number;
}

/**
 * Hook to access a Uniswap SDK instance for a specific chain.
 *
 * SDK instances are cached by the nearest provider using only chainId. The
 * first public client observed for a chain is used until provider config changes
 * or the provider unmounts.
 *
 * @param options - Optional configuration for the hook.
 * @returns The SDK context value containing the SDK instance and resolved chain ID.
 * @throws Error if used outside of UniswapSDKProvider
 *
 * @example Using the connected chain (default)
 * ```tsx
 * function MyComponent() {
 *   const { sdk } = useUniswapSDK();
 *
 *   const fetchData = async () => {
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
 *   // Calls for the same chain under one provider share an SDK instance.
 * }
 * ```
 */
export function useUniswapSDK(options: UseUniswapSDKOptions = {}): UseUniswapSDKReturn {
  const context = useContext(UniswapSDKContext);

  if (!context) {
    throw new Error("useUniswapSDK must be used within UniswapSDKProvider.");
  }

  const connectedChainId = useChainId();
  const resolvedChainId = options.chainId ?? connectedChainId;
  const publicClient = usePublicClient({ chainId: resolvedChainId });

  const sdk = useMemo(() => {
    if (!publicClient) {
      throw new Error(`No public client available for chain ID ${resolvedChainId}`);
    }

    return context.getSdk({
      chainId: resolvedChainId,
      publicClient,
    });
  }, [context, resolvedChainId, publicClient]);

  return {
    sdk,
    chainId: resolvedChainId,
  };
}
