"use client";

import { createContext, useCallback, useRef, type ReactNode } from "react";

import type { PublicClient } from "viem";

import { UniswapSDK, type V4Contracts } from "@zahastudio/uniswap-sdk";

/**
 * Configuration for the Uniswap SDK React provider.
 */
export interface UniswapSDKConfig {
  /**
   * Custom contracts per chain.
   * Key is chainId, value is contract addresses to override defaults.
   */
  contracts?: Record<number, V4Contracts>;
  /**
   * Default deadline offset in seconds (default: 600 = 10 minutes).
   */
  defaultDeadline?: number;
  /**
   * Default slippage tolerance in basis points (default: 50 = 0.5%).
   */
  defaultSlippageTolerance?: number;
}

/**
 * Internal context value that holds the shared SDK cache and config.
 * SDK instances are created lazily per chain and cached for deduplication.
 */
export interface UniswapSDKContextValue {
  /** Custom contracts per chain from provider config */
  contracts?: Record<number, V4Contracts>;
  /** Retrieve or create a cached SDK instance for a chain */
  getSdk: (params: { chainId: number; publicClient: PublicClient }) => UniswapSDK;
}

export const UniswapSDKContext = createContext<UniswapSDKContextValue | null>(null);

export interface UniswapSDKProviderProps {
  children: ReactNode;
  config?: UniswapSDKConfig;
}

interface CachedSDKEntry {
  sdk: UniswapSDK;
  publicClient: PublicClient;
  contracts: V4Contracts | undefined;
  defaultDeadline: number | undefined;
  defaultSlippageTolerance: number | undefined;
}

/**
 * Provider component for the Uniswap SDK.
 * Must be wrapped inside WagmiProvider and QueryClientProvider.
 *
 * Stores a shared SDK instance cache so that multiple calls to `useUniswapSDK`
 * with the same chainId return the same SDK instance.
 *
 * @example
 * ```tsx
 * import { WagmiProvider } from 'wagmi';
 * import { QueryClientProvider } from '@tanstack/react-query';
 * import { UniswapSDKProvider } from '@zahastudio/uniswap-sdk-react';
 *
 * function App() {
 *   return (
 *     <WagmiProvider config={wagmiConfig}>
 *       <QueryClientProvider client={queryClient}>
 *         <UniswapSDKProvider>
 *           <YourApp />
 *         </UniswapSDKProvider>
 *       </QueryClientProvider>
 *     </WagmiProvider>
 *   );
 * }
 * ```
 */

export function UniswapSDKProvider({ children, config = {} }: UniswapSDKProviderProps) {
  const sdkCache = useRef(new Map<number, CachedSDKEntry>());

  const getSdk = useCallback(
    ({ chainId, publicClient }: { chainId: number; publicClient: PublicClient }) => {
      const contracts = config.contracts?.[chainId];
      const cached = sdkCache.current.get(chainId);
      if (
        cached &&
        cached.publicClient === publicClient &&
        cached.contracts === contracts &&
        cached.defaultDeadline === config.defaultDeadline &&
        cached.defaultSlippageTolerance === config.defaultSlippageTolerance
      ) {
        return cached.sdk;
      }

      const instance = UniswapSDK.create(publicClient, chainId, {
        contracts,
        defaultDeadline: config.defaultDeadline,
        defaultSlippageTolerance: config.defaultSlippageTolerance,
      });
      sdkCache.current.set(chainId, {
        sdk: instance,
        publicClient,
        contracts,
        defaultDeadline: config.defaultDeadline,
        defaultSlippageTolerance: config.defaultSlippageTolerance,
      });

      return instance;
    },
    [config.contracts, config.defaultDeadline, config.defaultSlippageTolerance],
  );

  return (
    <UniswapSDKContext.Provider
      value={{
        getSdk,
      }}
    >
      {children}
    </UniswapSDKContext.Provider>
  );
}
