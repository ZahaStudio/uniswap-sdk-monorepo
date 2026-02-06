"use client";

import { createContext, useMemo, type ReactNode } from "react";

import { UniswapSDK, type V4Contracts } from "@zahastudio/uniswap-sdk";
import { useChainId, usePublicClient } from "wagmi";

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
 * Internal context value that holds the SDK instance.
 */
export interface UniswapSDKContextValue {
  /** The SDK instance (null until initialized) */
  sdk: UniswapSDK | null;
  /** Promise that resolves to the SDK instance */
  sdkPromise: Promise<UniswapSDK>;
  /** Whether the SDK is initialized */
  isInitialized: boolean;
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
export function UniswapSDKProvider({ children, config }: UniswapSDKProviderProps) {
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });

  // Get contracts for current chain
  const contracts = config?.contracts?.[chainId];

  // Create SDK with public client and chain-specific contracts
  const contextValue = useMemo<UniswapSDKContextValue>(() => {
    let sdk: UniswapSDK | null = null;

    if (!publicClient) {
      // Return a rejected promise if no public client
      const rejectedPromise = Promise.reject(
        new Error("UniswapSDKProvider must be used within WagmiProvider with a configured publicClient"),
      );
      // Prevent unhandled rejection
      rejectedPromise.catch(() => {});

      return {
        get sdk() {
          return null;
        },
        sdkPromise: rejectedPromise,
        get isInitialized() {
          return false;
        },
      };
    }

    const sdkPromise = UniswapSDK.create(publicClient, contracts).then((instance) => {
      sdk = instance;
      return instance;
    });

    return {
      get sdk() {
        return sdk;
      },
      sdkPromise,
      get isInitialized() {
        return sdk !== null;
      },
    };
  }, [publicClient, contracts]);

  return <UniswapSDKContext.Provider value={contextValue}>{children}</UniswapSDKContext.Provider>;
}
