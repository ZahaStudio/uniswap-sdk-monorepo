"use client";

import { useCallback } from "react";

import type { Hex } from "viem";

import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { usePosition, type UsePositionParams } from "@/hooks/usePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { assertSdkInitialized } from "@/utils/assertions";

/**
 * Arguments for removing liquidity from a position.
 */
export interface RemoveLiquidityArgs {
  /** Percentage of liquidity to remove (0-10000 in basis points, e.g., 5000 = 50%) */
  liquidityPercentage: number;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Deadline duration in seconds from current block timestamp (optional) */
  deadlineDuration?: number;
}

/**
 * Options for the usePositionRemoveLiquidity hook.
 */
export interface UsePositionRemoveLiquidityOptions {
  /** Override chain ID */
  chainId?: number;
  /** Callback fired when the transaction is confirmed */
  onSuccess?: () => void;
}

/**
 * Return type for the usePositionRemoveLiquidity hook.
 */
export interface UsePositionRemoveLiquidityReturn {
  /** Build calldata and send the remove liquidity transaction. Returns tx hash. */
  execute: (args: RemoveLiquidityArgs) => Promise<Hex>;
  /** Full transaction lifecycle state */
  transaction: UseTransactionReturn;
}

/**
 * Hook to remove liquidity from a Uniswap V4 position.
 *
 * Internally loads the position via `usePosition` and automatically
 * refetches position data when the transaction confirms.
 *
 * @param params - Operation parameters: tokenId
 * @param options - Configuration options
 * @returns Execute function and transaction lifecycle state
 *
 * @example
 * ```tsx
 * const removeLiquidity = usePositionRemoveLiquidity({ tokenId });
 *
 * await removeLiquidity.execute({ liquidityPercentage: 5000 }); // 50%
 * // removeLiquidity.transaction.status === "confirming"
 * ```
 */
export function usePositionRemoveLiquidity(
  params: UsePositionParams,
  options: UsePositionRemoveLiquidityOptions = {},
): UsePositionRemoveLiquidityReturn {
  const { tokenId } = params;
  const { chainId: overrideChainId, onSuccess } = options;

  const { sdk } = useUniswapSDK({ chainId: overrideChainId });
  const { query } = usePosition(params, { chainId: overrideChainId });

  const transaction = useTransaction({
    onSuccess: () => {
      query.refetch();
      onSuccess?.();
    },
  });

  const execute = useCallback(
    async (args: RemoveLiquidityArgs): Promise<Hex> => {
      assertSdkInitialized(sdk);

      const positionManager = sdk.getContractAddress("positionManager");
      const { calldata, value } = await sdk.buildRemoveLiquidityCallData({
        tokenId,
        liquidityPercentage: args.liquidityPercentage,
        slippageTolerance: args.slippageTolerance,
        deadlineDuration: args.deadlineDuration,
      });

      return transaction.sendTransaction({
        to: positionManager,
        data: calldata as Hex,
        value: BigInt(value),
      });
    },
    [sdk, tokenId, transaction],
  );

  return { execute, transaction };
}
