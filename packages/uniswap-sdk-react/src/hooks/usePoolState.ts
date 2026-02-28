"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Pool, PoolKey } from "@zahastudio/uniswap-sdk";

import { useUniswapSDK } from "./useUniswapSDK";
import type { UseHookOptions } from "@/types/hooks";
import { assertSdkInitialized } from "@/utils";
import { poolKeys } from "@/utils/queryKeys";

/**
 * Combined query data returned by usePoolState.
 */
export interface UsePoolStateData {
  /** Current pool state for the provided pool key */
  pool: Pool;
}

/**
 * Operation parameters for the usePoolState hook.
 */
export interface UsePoolStateParams {
  /** V4 pool key identifying the pool */
  poolKey: PoolKey;
}

/**
 * Return type for the usePoolState hook.
 */
export interface UsePoolStateReturn {
  /** TanStack Query result with pool state */
  query: UseQueryResult<UsePoolStateData, Error>;
}

/**
 * Hook to fetch a Uniswap V4 pool's current state.
 *
 * Fetches pool state for a given pool key and keeps it in sync via
 * optional polling with `refetchInterval`.
 *
 * @param params - Operation parameters: poolKey
 * @param options - Configuration options for the query
 * @returns Object with query result
 *
 * @example Basic usage
 * ```tsx
 * const { query } = usePoolState({ poolKey });
 *
 * if (query.isLoading) return <div>Loading...</div>;
 * const pool = query.data?.pool;
 * ```
 *
 * @example With polling
 * ```tsx
 * const { query } = usePoolState({ poolKey }, { refetchInterval: 12000 });
 * ```
 */
export function usePoolState(params: UsePoolStateParams, options: UseHookOptions = {}): UsePoolStateReturn {
  const { poolKey } = params;

  const { chainId: overrideChainId, enabled = true, refetchInterval = false } = options;
  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });

  const query = useQuery({
    queryKey: poolKeys.detail(
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
      chainId,
    ),
    queryFn: async (): Promise<UsePoolStateData> => {
      assertSdkInitialized(sdk);
      const pool = await sdk.getPool(poolKey);
      return {
        pool,
      };
    },
    enabled: enabled && !!sdk,
    refetchInterval,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("Rate limit exceeded")) {
        return false;
      }
      return failureCount < 3;
    },
  });

  return { query };
}
