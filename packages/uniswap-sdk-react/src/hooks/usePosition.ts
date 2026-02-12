"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { GetPositionResponse, GetUncollectedFeesResponse } from "@zahastudio/uniswap-sdk";

import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import type { UseHookOptions } from "@/types/hooks";
import { assertSdkInitialized } from "@/utils/assertions";
import { positionKeys } from "@/utils/queryKeys";

/**
 * Combined query data returned by usePosition.
 * Includes the position itself and uncollected fees.
 */
export interface UsePositionData extends GetPositionResponse {
  /** Uncollected fees for token0 and token1 */
  periphery: {
    uncollectedFees: GetUncollectedFeesResponse;
  };
}

/**
 * Operation parameters for position hooks.
 */
export interface UsePositionParams {
  /** The NFT token ID of the position */
  tokenId: string;
}

/**
 * Return type for the usePosition hook.
 */
export interface UsePositionReturn {
  /** TanStack Query result with position data and uncollected fees */
  query: UseQueryResult<UsePositionData, Error>;
}

/**
 * Hook to fetch a Uniswap V4 position.
 *
 * Fetches the position data and uncollected fees in a single query.
 * Use alongside `usePositionCollectFees`, `usePositionRemoveLiquidity`,
 * or `usePositionIncreaseLiquidity` for mutation actions.
 *
 * @param params - Operation parameters: tokenId
 * @param options - Configuration options for the query
 * @returns Object with query result
 *
 * @example Basic usage
 * ```tsx
 * const { query } = usePosition({ tokenId });
 *
 * if (query.isLoading) return <div>Loading...</div>;
 * const { position, periphery } = query.data!;
 * ```
 *
 * @example With polling
 * ```tsx
 * const { query } = usePosition({ tokenId }, { refetchInterval: 12000 });
 * ```
 */
export function usePosition(params: UsePositionParams, options: UseHookOptions = {}): UsePositionReturn {
  const { tokenId } = params;
  const { chainId: overrideChainId, enabled = true, refetchInterval = false } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });

  const query = useQuery({
    queryKey: positionKeys.detail(tokenId, chainId),
    queryFn: async (): Promise<UsePositionData> => {
      assertSdkInitialized(sdk);
      const [position, uncollectedFees] = await Promise.all([
        sdk.getPosition(tokenId),
        sdk.getUncollectedFees(tokenId),
      ]);
      return {
        ...position,
        periphery: {
          uncollectedFees,
        },
      };
    },
    enabled: !!tokenId && enabled && !!sdk,
    refetchInterval,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("Position has no liquidity")) {
        return false;
      }
      return failureCount < 3;
    },
  });

  return { query };
}
