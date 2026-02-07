"use client";

import { createContext, useState, useMemo, type ReactNode } from "react";

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
}

/**
 * Internal context value that holds the shared SDK cache and config.
 * SDK instances are created lazily per chain and cached for deduplication.
 */
export interface UniswapSDKContextValue {
  /** Shared cache of SDK promises, keyed by chainId */
  sdkCache: Map<number, Promise<UniswapSDK>>;
  /** Custom contracts per chain from provider config */
  contracts?: Record<number, V4Contracts>;
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
export function UniswapSDKProvider({ children, config }: UniswapSDKProviderProps) {
  const [sdkCache] = useState(() => new Map<number, Promise<UniswapSDK>>());

  const contextValue = useMemo<UniswapSDKContextValue>(
    () => ({
      sdkCache,
      contracts: config?.contracts,
    }),
    [sdkCache, config?.contracts],
  );

  return <UniswapSDKContext.Provider value={contextValue}>{children}</UniswapSDKContext.Provider>;
}
