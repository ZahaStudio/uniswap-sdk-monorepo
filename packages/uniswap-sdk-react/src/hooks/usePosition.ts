"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { GetPositionResponse } from "@zahastudio/uniswap-sdk";

import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { positionKeys } from "@/utils/queryKeys";

/**
 * Options for the usePosition hook.
 */
export interface UsePositionOptions {
  /**
   * Chain ID to use. If omitted, uses the currently connected chain.
   * The SDK instance is cached per chain, so passing the same chainId
   * across multiple hooks reuses the same instance.
   */
  chainId?: number;

  /** Whether the query is enabled (default: true if tokenId is provided) */
  enabled?: boolean;

  /**
   * Refetch interval in milliseconds.
   * Set to a number to poll, or false to disable.
   * Recommend: 12000 (12 seconds, ~1 Ethereum block)
   */
  refetchInterval?: number | false;

  /** Stale time in milliseconds (default: 10000) */
  staleTime?: number;
}

/**
 * Getter functions for additional position data.
 */
export interface UsePositionGetters {
  /**
   * Get uncollected fees for this position.
   * @returns Promise with amount0 and amount1 as bigints
   */
  getUncollectedFees: () => Promise<{ amount0: bigint; amount1: bigint }>;
}

/**
 * Arguments for the removeLiquidity action.
 */
export interface RemoveLiquidityArgs {
  /** Percentage of liquidity to remove (0-10000 in basis points, e.g., 5000 = 50%) */
  liquidityPercentage: number;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Unix timestamp deadline (optional, default: 30 minutes from now) */
  deadline?: string;
}

/**
 * Arguments for the addLiquidity action.
 */
export interface AddLiquidityArgs {
  /** Amount of token0 to add (as string) */
  amount0?: string;
  /** Amount of token1 to add (as string) */
  amount1?: string;
  /** Recipient address for the position NFT */
  recipient: string;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Unix timestamp deadline (optional, default: 30 minutes from now) */
  deadline?: string;
}

/**
 * Action functions for position operations.
 */
export interface UsePositionActions {
  /**
   * Build calldata for collecting fees from this position.
   * @param recipient - Address to receive the collected fees
   * @returns Promise with calldata and value for the transaction
   */
  collectFees: (recipient: string) => Promise<{ calldata: string; value: string }>;

  /**
   * Build calldata for removing liquidity from this position.
   * @param args - Remove liquidity parameters
   * @returns Promise with calldata and value for the transaction
   */
  removeLiquidity: (args: RemoveLiquidityArgs) => Promise<{ calldata: string; value: string }>;

  /**
   * Build calldata for adding more liquidity to this position.
   * @param args - Add liquidity parameters
   * @returns Promise with calldata and value for the transaction
   */
  addLiquidity: (args: AddLiquidityArgs) => Promise<{ calldata: string; value: string }>;
}

/**
 * Return type for the usePosition hook.
 */
export interface UsePositionReturn {
  /** TanStack Query result with position data */
  query: UseQueryResult<GetPositionResponse, Error>;

  /** Getter functions for additional data */
  getters: UsePositionGetters;

  /** Action functions for position operations */
  actions: UsePositionActions;
}

/**
 * Hook to fetch and manage a Uniswap V4 position.
 *
 * @param tokenId - The NFT token ID of the position
 * @param options - Configuration options for the query
 * @returns Object with query result, getters, and actions
 *
 * @example Basic usage
 * ```tsx
 * function PositionDisplay({ tokenId }: { tokenId: string }) {
 *   const { query, actions } = usePosition(tokenId);
 *
 *   if (query.isLoading) return <div>Loading...</div>;
 *   if (query.error) return <div>Error: {query.error.message}</div>;
 *
 *   const position = query.data!;
 *   return (
 *     <div>
 *       <p>Liquidity: {position.position.liquidity.toString()}</p>
 *       <button onClick={() => actions.collectFees('0x...')}>
 *         Collect Fees
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With polling
 * ```tsx
 * const { query } = usePosition(tokenId, {
 *   refetchInterval: 12000, // Refetch every 12 seconds
 * });
 * ```
 */
export function usePosition(tokenId: string | undefined, options: UsePositionOptions = {}): UsePositionReturn {
  const { chainId: overrideChainId, enabled = true, refetchInterval = false, staleTime = 10000 } = options;

  const { sdkPromise, chainId } = useUniswapSDK({ chainId: overrideChainId });

  // Main query for position data
  const query = useQuery({
    queryKey: positionKeys.detail(tokenId ?? "", chainId),
    queryFn: async (): Promise<GetPositionResponse> => {
      if (!tokenId) {
        throw new Error("Token ID is required");
      }
      const sdk = await sdkPromise;
      return sdk.getPosition(tokenId);
    },
    enabled: !!tokenId && enabled,
    refetchInterval,
    staleTime,
    retry: (failureCount, error) => {
      // Don't retry on "position doesn't exist" errors
      if (error instanceof Error && error.message.includes("Position has no liquidity")) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Getters for additional data
  const getters: UsePositionGetters = {
    getUncollectedFees: async () => {
      if (!tokenId) {
        throw new Error("Token ID is required");
      }
      const sdk = await sdkPromise;
      return sdk.getUncollectedFees(tokenId);
    },
  };

  // Actions for position operations
  const actions: UsePositionActions = {
    collectFees: async (recipient: string) => {
      if (!tokenId) {
        throw new Error("Token ID is required");
      }
      const sdk = await sdkPromise;
      return sdk.buildCollectFeesCallData({
        tokenId,
        recipient,
      });
    },

    removeLiquidity: async (args: RemoveLiquidityArgs) => {
      if (!tokenId) {
        throw new Error("Token ID is required");
      }
      const sdk = await sdkPromise;
      return sdk.buildRemoveLiquidityCallData({
        tokenId,
        liquidityPercentage: args.liquidityPercentage,
        slippageTolerance: args.slippageTolerance,
        deadline: args.deadline,
      });
    },

    addLiquidity: async (args: AddLiquidityArgs) => {
      if (!tokenId) {
        throw new Error("Token ID is required");
      }
      const position = query.data;
      if (!position) {
        throw new Error("Position not loaded. Wait for query to complete before adding liquidity.");
      }

      const sdk = await sdkPromise;
      return sdk.buildAddLiquidityCallData({
        pool: position.pool,
        tickLower: position.position.tickLower,
        tickUpper: position.position.tickUpper,
        amount0: args.amount0,
        amount1: args.amount1,
        recipient: args.recipient,
        slippageTolerance: args.slippageTolerance,
        deadline: args.deadline,
      });
    },
  };

  return { query, getters, actions };
}
