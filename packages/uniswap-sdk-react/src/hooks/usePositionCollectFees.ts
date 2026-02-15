"use client";

import { useCallback } from "react";

import type { Hex } from "viem";

import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { usePosition, type UsePositionParams } from "@/hooks/usePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { assertSdkInitialized } from "@/utils/assertions";

/**
 * Arguments for collecting fees from a position.
 */
export interface CollectFeesArgs {
  /** Address to receive the collected fees */
  recipient: string;
  /** Deadline duration in seconds from current block timestamp (optional) */
  deadlineDuration?: number;
}

/**
 * Options for the usePositionCollectFees hook.
 */
export interface UsePositionCollectFeesOptions {
  /** Override chain ID */
  chainId?: number;
  /** Callback fired when the transaction is confirmed */
  onSuccess?: () => void;
}

/**
 * Return type for the usePositionCollectFees hook.
 */
export interface UsePositionCollectFeesReturn {
  /** Build calldata and send the collect fees transaction. Returns tx hash. */
  execute: (args: CollectFeesArgs) => Promise<Hex>;
  /** Full transaction lifecycle state */
  transaction: UseTransactionReturn;
}

/**
 * Hook to collect uncollected fees from a Uniswap V4 position.
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
 * const collectFees = usePositionCollectFees({ tokenId });
 *
 * await collectFees.execute({ recipient: address });
 * // collectFees.transaction.status === "confirming"
 * ```
 */
export function usePositionCollectFees(
  params: UsePositionParams,
  options: UsePositionCollectFeesOptions = {},
): UsePositionCollectFeesReturn {
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
    async (args: CollectFeesArgs): Promise<Hex> => {
      assertSdkInitialized(sdk);

      const positionManager = sdk.getContractAddress("positionManager");
      const { calldata, value } = await sdk.buildCollectFeesCallData({
        tokenId,
        recipient: args.recipient,
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
