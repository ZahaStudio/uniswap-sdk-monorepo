"use client";

import { createContext, useCallback, type ReactNode } from "react";

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
 * Internal context value for creating SDK instances from the provider config.
 */
export interface UniswapSDKContextValue {
  /** Custom contracts per chain from provider config */
  contracts?: Record<number, V4Contracts>;
  /** Create an SDK instance for a chain */
  getSdk: (params: { chainId: number; publicClient: PublicClient }) => UniswapSDK;
}

export const UniswapSDKContext = createContext<UniswapSDKContextValue | null>(null);

export interface UniswapSDKProviderProps {
  children: ReactNode;
  config?: UniswapSDKConfig;
}

/**
 * Provider component for the Uniswap SDK.
 * Must be wrapped inside WagmiProvider and QueryClientProvider.
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
  const getSdk = useCallback(
    ({ chainId, publicClient }: { chainId: number; publicClient: PublicClient }) => {
      const contracts = config.contracts?.[chainId];

      return UniswapSDK.create(publicClient, chainId, {
        contracts,
        defaultDeadline: config.defaultDeadline,
        defaultSlippageTolerance: config.defaultSlippageTolerance,
      });
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
