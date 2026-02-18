"use client";

import { useCallback, useMemo } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Position, nearestUsableTick, TickMath } from "@zahastudio/uniswap-sdk";
import type { PoolKey, Pool } from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";

import { useAddLiquidityPipeline, type AddLiquidityStep } from "@/hooks/primitives/useAddLiquidityPipeline";
import { type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import type { UseMutationHookOptions } from "@/types/hooks";
import { assertSdkInitialized } from "@/utils/assertions";
import { poolKeys } from "@/utils/queryKeys";

/**
 * Arguments for creating a new position (passed at execution time).
 */
export interface CreatePositionArgs {
  /** Recipient address for the position NFT */
  recipient: Address;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Deadline duration in seconds from current block timestamp (optional) */
  deadlineDuration?: number;
}

/**
 * Calculated position amounts derived from the user-provided input.
 */
export interface CalculatedPosition {
  /** Raw bigint amount of token0 */
  amount0: bigint;
  /** Raw bigint amount of token1 */
  amount1: bigint;
  /** Human-readable amount of token0 */
  formattedAmount0: string;
  /** Human-readable amount of token1 */
  formattedAmount1: string;
}

/**
 * Resolved tick range for the position.
 */
export interface ResolvedTickRange {
  tickLower: number;
  tickUpper: number;
}

/**
 * Parameters for the useCreatePosition hook.
 */
export interface UseCreatePositionParams {
  /** V4 pool key identifying the pool */
  poolKey: PoolKey;
  /** Amount of token0 to add — pass only the user-edited amount, leave the other undefined */
  amount0?: bigint;
  /** Amount of token1 to add — pass only the user-edited amount, leave the other undefined */
  amount1?: bigint;
  /** Lower tick boundary (optional, defaults to full-range) */
  tickLower?: number;
  /** Upper tick boundary (optional, defaults to full-range) */
  tickUpper?: number;
}

/**
 * Options for the useCreatePosition hook.
 */
export interface UseCreatePositionOptions extends UseMutationHookOptions {}

/**
 * Return type for the useCreatePosition hook.
 */
export interface UseCreatePositionReturn {
  /** Pool query result — use for UI display (current price, liquidity, fee tier) */
  pool: UseQueryResult<Pool>;
  /** All pipeline steps with individual state and actions */
  steps: {
    /** ERC-20 → Permit2 approval for token0 */
    approvalToken0: UseTokenApprovalReturn;
    /** ERC-20 → Permit2 approval for token1 */
    approvalToken1: UseTokenApprovalReturn;
    /** Off-chain Permit2 batch signature step */
    permit2: UsePermit2SignStep;
    /** Create position transaction execution step */
    execute: {
      transaction: UseTransactionReturn;
      execute: (args: CreatePositionArgs) => Promise<Hex>;
    };
  };
  /** Calculated position amounts from the user-provided input, null while loading or no input */
  position: CalculatedPosition | null;
  /** Resolved tick range, null while pool is loading */
  tickRange: ResolvedTickRange | null;
  /** The first incomplete required step */
  currentStep: AddLiquidityStep;
  /** Execute all remaining required steps sequentially. Returns tx hash. */
  executeAll: (args: CreatePositionArgs) => Promise<Hex>;
  /** Reset all mutation state (approvals, permit2, transaction) */
  reset: () => void;
}

/**
 * Hook to create a new Uniswap V4 position (mint).
 *
 * Fetches the pool via `sdk.getPool()`, computes the Position from the
 * user-provided amount (using `Position.fromAmount0` or `fromAmount1`),
 * orchestrates ERC-20 approvals (to Permit2), off-chain Permit2 batch
 * signing, and the mint transaction.
 *
 * The caller passes only the user-edited amount (`amount0` or `amount1`),
 * and the hook computes the complementary amount automatically.
 *
 * @param params - Pool key, amounts, and tick range
 * @param options - Configuration: chainId, onSuccess
 * @returns Pool query, calculated position, pipeline steps, current step indicator, executeAll action, and reset
 *
 * @example One-click with executeAll
 * ```tsx
 * const create = useCreatePosition(
 *   {
 *     poolKey: { currency0: ETH, currency1: USDC, fee: 3000, tickSpacing: 60, hooks: ZERO_ADDRESS },
 *     amount0: parseUnits("1", 18),
 *     tickLower: -887220,
 *     tickUpper: 887220,
 *   },
 * );
 *
 * // Computed amounts available via create.position
 * // create.position.formattedAmount1 → auto-calculated token1 amount
 *
 * const txHash = await create.executeAll({ recipient: address });
 * ```
 */
export function useCreatePosition(
  params: UseCreatePositionParams,
  options: UseCreatePositionOptions = {},
): UseCreatePositionReturn {
  const { poolKey, amount0, amount1, tickLower: paramTickLower, tickUpper: paramTickUpper } = params;
  const { chainId: overrideChainId, onSuccess } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });

  const poolQuery = useQuery({
    queryKey: poolKeys.detail(
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
      chainId,
    ),
    queryFn: async (): Promise<Pool> => {
      assertSdkInitialized(sdk);
      return sdk.getPool(poolKey);
    },
    enabled: !!poolKey?.currency0 && !!poolKey?.currency1 && !!sdk,
  });

  const pool = poolQuery.data;

  const tickRange = useMemo((): ResolvedTickRange | null => {
    if (!pool) {
      return null;
    }

    const tickLower = paramTickLower ?? nearestUsableTick(TickMath.MIN_TICK, pool.tickSpacing);
    const tickUpper = paramTickUpper ?? nearestUsableTick(TickMath.MAX_TICK, pool.tickSpacing);

    return {
      tickLower,
      tickUpper,
    };
  }, [pool, paramTickLower, paramTickUpper]);

  const calculatedPosition = useMemo((): CalculatedPosition | null => {
    if (!pool || !tickRange) {
      return null;
    }

    const hasAmount0 = amount0 !== undefined && amount0 > 0n;
    const hasAmount1 = amount1 !== undefined && amount1 > 0n;

    // Need exactly one amount to compute the other
    if (!hasAmount0 && !hasAmount1) {
      return null;
    }

    try {
      let pos: Position;

      if (hasAmount0 && !hasAmount1) {
        pos = Position.fromAmount0({
          pool,
          tickLower: tickRange.tickLower,
          tickUpper: tickRange.tickUpper,
          amount0: amount0!.toString(),
          useFullPrecision: true,
        });
      } else if (hasAmount1 && !hasAmount0) {
        pos = Position.fromAmount1({
          pool,
          tickLower: tickRange.tickLower,
          tickUpper: tickRange.tickUpper,
          amount1: amount1!.toString(),
        });
      } else {
        pos = Position.fromAmounts({
          pool,
          tickLower: tickRange.tickLower,
          tickUpper: tickRange.tickUpper,
          amount0: amount0!.toString(),
          amount1: amount1!.toString(),
          useFullPrecision: true,
        });
      }

      return {
        amount0: BigInt(pos.amount0.quotient.toString()),
        amount1: BigInt(pos.amount1.quotient.toString()),
        formattedAmount0: pos.amount0.toExact(),
        formattedAmount1: pos.amount1.toExact(),
      };
    } catch {
      return null;
    }
  }, [pool, tickRange, amount0, amount1]);

  const buildCalldata = useCallback(
    async ({ batchPermit, args }: { batchPermit: unknown; args: CreatePositionArgs }) => {
      if (!pool) {
        throw new Error("Pool not loaded. Wait for pool query to complete before creating a position.");
      }
      if (!tickRange) {
        throw new Error("Tick range not resolved. Wait for pool query to complete.");
      }
      assertSdkInitialized(sdk);

      return sdk.buildAddLiquidityCallData({
        pool,
        tickLower: tickRange.tickLower,
        tickUpper: tickRange.tickUpper,
        amount0: amount0 !== undefined && amount0 > 0n ? amount0.toString() : undefined,
        amount1: amount1 !== undefined && amount1 > 0n ? amount1.toString() : undefined,
        recipient: args.recipient,
        slippageTolerance: args.slippageTolerance,
        deadlineDuration: args.deadlineDuration,
        permit2BatchSignature: batchPermit as Parameters<
          typeof sdk.buildAddLiquidityCallData
        >[0]["permit2BatchSignature"],
      });
    },
    [pool, tickRange, sdk, amount0, amount1],
  );

  const pipeline = useAddLiquidityPipeline<CreatePositionArgs>({
    currencies: pool ? [pool.currency0, pool.currency1] : undefined,
    permit2Amounts: [calculatedPosition?.amount0 ?? 0n, calculatedPosition?.amount1 ?? 0n],
    enabled: !!pool,
    chainId: overrideChainId,
    onSuccess,
    buildCalldata,
  });

  return {
    pool: poolQuery,
    steps: pipeline.steps,
    position: calculatedPosition,
    tickRange,
    currentStep: pipeline.currentStep,
    executeAll: pipeline.executeAll,
    reset: pipeline.reset,
  };
}
