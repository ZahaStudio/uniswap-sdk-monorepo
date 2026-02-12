"use client";

import { useCallback } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  calculateMinimumOutput,
  DEFAULT_SLIPPAGE_TOLERANCE,
  type FeeTier,
  type PoolKey,
  type QuoteResponse,
  type SwapExactInSingle,
} from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";

import { usePermit2, type Permit2SignedResult, type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import type { UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import type { UseHookOptions } from "@/types/hooks";
import { swapKeys } from "@/utils/queryKeys";

/**
 * Operation parameters for the useSwap hook.
 */
export interface UseSwapParams {
  /** V4 pool key identifying the pool to swap through */
  poolKey: PoolKey;
  /** Amount of input tokens in base units */
  amountIn: bigint;
  /** Swap direction: true = currency0→currency1, false = currency1→currency0 */
  zeroForOne: boolean;
  /** Recipient address for the output tokens (defaults to connected wallet) */
  recipient?: Address;
  /** Slippage tolerance in basis points (default: 50 = 0.5%) */
  slippageBps?: number;
}

/**
 * Extended quote data with slippage-adjusted minimum output.
 */
export interface QuoteData extends QuoteResponse {
  /** Minimum output after applying slippage tolerance */
  minAmountOut: bigint;
}

/**
 * Permit2 signing step state — re-exported from the primitive hook.
 * @see UsePermit2SignStep
 */
export type { UsePermit2SignStep };

/**
 * @deprecated Use `UsePermit2SignStep` instead. This alias exists for backward compatibility.
 */
export type UseSwapPermit2Step = UsePermit2SignStep;

/**
 * Swap execution step state.
 */
export interface UseSwapExecuteStep {
  /** Full transaction lifecycle from useTransaction */
  transaction: UseTransactionReturn;
  /** Build calldata and send the swap transaction. Returns tx hash. */
  execute: () => Promise<Hex>;
}

/**
 * All swap lifecycle steps.
 */
export interface UseSwapSteps {
  /** Auto-fetching quote query with slippage-adjusted minAmountOut */
  quote: UseQueryResult<QuoteData, Error>;
  /** ERC-20 → Permit2 approval step */
  approval: UseTokenApprovalReturn;
  /** Off-chain Permit2 signature step */
  permit2: UsePermit2SignStep;
  /** Swap transaction execution step */
  swap: UseSwapExecuteStep;
}

/**
 * Current step in the swap lifecycle.
 * Represents the first incomplete required step.
 */
export type SwapStep = "quote" | "approval" | "permit2" | "swap" | "completed";

/**
 * Return type for the useSwap hook.
 */
export interface UseSwapReturn {
  /** All swap lifecycle steps with individual state and actions */
  steps: UseSwapSteps;
  /** The first incomplete required step */
  currentStep: SwapStep;
  /** Execute all remaining required steps sequentially. Returns swap tx hash. */
  executeAll: () => Promise<Hex>;
  /** Reset all mutation state (approval, permit2, swap). Quote query persists. */
  reset: () => void;
}

function assertWalletConnected(address: Address | undefined): asserts address is Address {
  if (!address) {
    throw new Error("No wallet connected");
  }
}

function assertQuoteAvailable(quote: QuoteData | undefined): asserts quote is QuoteData {
  if (!quote) {
    throw new Error("Quote not available");
  }
}

function assertPermit2Satisfied(isRequired: boolean, isSigned: boolean): void {
  if (isRequired && !isSigned) {
    throw new Error("Permit2 signature required");
  }
}

/**
 * Hook to manage the full Uniswap V4 swap lifecycle.
 *
 * Orchestrates quoting, ERC-20 approval (to Permit2), off-chain Permit2
 * signing, and swap transaction execution. Automatically detects which
 * steps are required (e.g. native ETH skips approval and permit2).
 *
 * Each step exposes its own state and action function, and a unified
 * `executeAll()` chains them sequentially for single-action UX.
 *
 * @param params - Operation parameters: poolKey, amountIn, zeroForOne, recipient, slippageBps
 * @param options - Configuration: enabled, refetchInterval, staleTime, chainId
 * @returns Swap lifecycle steps, current step indicator, and executeAll action
 *
 * @example Basic usage with individual step control
 * ```tsx
 * const swap = useSwap(
 *   { poolKey, amountIn: 1000000n, zeroForOne: true },
 *   { refetchInterval: 12000 },
 * );
 *
 * // Show quote
 * const { data: quote } = swap.steps.quote.query;
 *
 * // Step through the flow
 * if (swap.steps.approval.isRequired) {
 *   await swap.steps.approval.approve();
 *   await swap.steps.approval.transaction.waitForConfirmation();
 * }
 * await swap.steps.permit2.sign();
 * const txHash = await swap.steps.swap.execute();
 * ```
 *
 * @example One-click swap with executeAll
 * ```tsx
 * const swap = useSwap({ poolKey, amountIn: 1000000n, zeroForOne: true });
 *
 * // Single call handles approve → sign → swap
 * const txHash = await swap.executeAll();
 * ```
 */
export function useSwap(params: UseSwapParams, options: UseHookOptions = {}): UseSwapReturn {
  const {
    poolKey,
    amountIn,
    zeroForOne,
    recipient: recipientOverride,
    slippageBps = DEFAULT_SLIPPAGE_TOLERANCE,
  } = params;
  const { enabled = true, refetchInterval = false, chainId: chainIdOverride } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();
  const recipient = recipientOverride ?? connectedAddress;

  const inputToken = (zeroForOne ? poolKey.currency0 : poolKey.currency1) as Address;
  const isNativeInput = inputToken.toLowerCase() === zeroAddress.toLowerCase();

  const hasValidAmount = amountIn > 0n;
  const isWalletReady = !!connectedAddress;
  const isQuoteEnabled = enabled && hasValidAmount && !!sdk;
  const isSwapEnabled = isQuoteEnabled && isWalletReady;

  const universalRouter = sdk?.getContractAddress("universalRouter") ?? zeroAddress;

  const quoteQuery = useQuery({
    queryKey: swapKeys.quote(poolKey, amountIn, zeroForOne, slippageBps, chainId),
    queryFn: async (): Promise<QuoteData> => {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }

      const quoteParams: SwapExactInSingle = {
        poolKey: {
          currency0: poolKey.currency0 as `0x${string}`,
          currency1: poolKey.currency1 as `0x${string}`,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks as `0x${string}`,
        },
        zeroForOne,
        amountIn: amountIn.toString(),
      };

      const quote = await sdk.getQuote(quoteParams);
      const minAmountOut = calculateMinimumOutput(quote.amountOut, slippageBps);

      return { ...quote, minAmountOut };
    },
    enabled: isQuoteEnabled,
    refetchInterval,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("insufficient liquidity")) return false;
      return failureCount < 3;
    },
  });

  const permit2 = usePermit2(
    {
      tokens: [{ address: inputToken, amount: amountIn }],
      spender: universalRouter,
    },
    {
      enabled: isSwapEnabled,
      chainId,
    },
  );

  const swapTransaction = useTransaction();

  const swapExecute = useCallback(async (signedPermit2?: Permit2SignedResult): Promise<Hex> => {
    assertWalletConnected(connectedAddress);
    const quote = quoteQuery.data;
    assertQuoteAvailable(quote);

    if (!sdk) {
      throw new Error("SDK not initialized");
    }
    const permit2Signed = signedPermit2 ?? permit2.permit2.signed;
    assertPermit2Satisfied(permit2.permit2.isRequired, !!permit2Signed);

    const permit2Signature = permit2Signed?.kind === "single" ? permit2Signed.data : undefined;

    const pool = await sdk.getPool({
      currencyA: poolKey.currency0 as Address,
      currencyB: poolKey.currency1 as Address,
      fee: poolKey.fee as FeeTier,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks as Address,
    });

    const calldata = sdk.buildSwapCallData({
      pool,
      amountIn,
      amountOutMinimum: quote.minAmountOut,
      zeroForOne,
      recipient: recipient ?? connectedAddress,
      permit2Signature,
    });

    return swapTransaction.sendTransaction({
      to: universalRouter,
      data: calldata,
      value: isNativeInput ? amountIn : 0n,
    });
  }, [
    connectedAddress,
    quoteQuery.data,
    sdk,
    permit2.permit2.isRequired,
    permit2.permit2.signed,
    poolKey.currency0,
    poolKey.currency1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks,
    amountIn,
    zeroForOne,
    recipient,
    swapTransaction,
    universalRouter,
    isNativeInput,
  ]);

  const currentStep: SwapStep = (() => {
    if (!quoteQuery.data || quoteQuery.isLoading || !isWalletReady) {
      return "quote";
    }
    if (permit2.approvals[0].isRequired === undefined || permit2.approvals[0].isRequired) {
      return "approval";
    }
    if (permit2.permit2.isRequired && !permit2.permit2.isSigned) {
      return "permit2";
    }
    if (swapTransaction.status !== "confirmed") {
      return "swap";
    }
    return "completed";
  })();

  const executeAll = useCallback(async (): Promise<Hex> => {
    const signedPermit2 = await permit2.approveAndSign();
    return swapExecute(signedPermit2);
  }, [permit2, swapExecute]);

  const reset = useCallback(() => {
    permit2.reset();
    swapTransaction.reset();
  }, [permit2, swapTransaction]);

  return {
    steps: {
      quote: quoteQuery,
      approval: permit2.approvals[0],
      permit2: permit2.permit2,
      swap: {
        transaction: swapTransaction,
        execute: () => swapExecute(),
      },
    },
    currentStep,
    executeAll,
    reset,
  };
}
