"use client";

import { useCallback } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  calculateMinimumOutput,
  type PoolKey,
  type QuoteResponse,
  type SwapExactInSingle,
} from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";

import { usePermit2, type Permit2SignedResult, type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { useToken } from "@/hooks/primitives/useToken";
import type { UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import type { UseHookOptions } from "@/types/hooks";
import { assertSdkInitialized, assertWalletConnected } from "@/utils/assertions";
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
  /** When true, wraps/unwraps native ETH for WETH-denominated pools */
  useNativeETH?: boolean;
}

/**
 * Extended quote data with slippage-adjusted minimum output.
 */
export interface QuoteData extends QuoteResponse {
  /** Minimum output after applying slippage tolerance */
  minAmountOut: bigint;
}

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
 * // Show quote (steps.quote is a UseQueryResult)
 * const { data: quote } = swap.steps.quote;
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
    slippageBps: slippageBpsParam,
    useNativeETH,
  } = params;
  const { enabled = true, refetchInterval = false, chainId: chainIdOverride } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();
  const recipient = recipientOverride ?? connectedAddress;

  const slippageBps = slippageBpsParam ?? sdk.defaultSlippageTolerance;

  const inputToken = (zeroForOne ? poolKey.currency0 : poolKey.currency1) as Address;
  const isNativeInput = inputToken.toLowerCase() === zeroAddress.toLowerCase();

  // When useNativeETH is set, check if the input side is the WETH token
  const isNativeETHInput = useNativeETH ? inputToken.toLowerCase() === sdk.getContractAddress("weth").toLowerCase() : false;

  const hasValidAmount = amountIn > 0n;
  const isWalletReady = !!connectedAddress;
  const isQuoteEnabled = enabled && hasValidAmount && !!sdk;
  const isSwapEnabled = isQuoteEnabled && isWalletReady;

  const universalRouter = sdk.getContractAddress("universalRouter");
  const { query: inputTokenQuery } = useToken(
    {
      tokenAddress: isNativeETHInput ? zeroAddress : inputToken,
    },
    {
      enabled: isSwapEnabled,
      chainId,
    },
  );

  const quoteQuery = useQuery({
    queryKey: swapKeys.quote(poolKey, amountIn, zeroForOne, slippageBps, chainId),
    queryFn: async (): Promise<QuoteData> => {
      assertSdkInitialized(sdk);

      const quoteParams: SwapExactInSingle = {
        poolKey: {
          currency0: poolKey.currency0 as Address,
          currency1: poolKey.currency1 as Address,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks as Address,
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

  // Skip permit2 when paying with native ETH (either native pool or WETH wrapping)
  const skipPermit2 = isNativeInput || isNativeETHInput;

  const permit2 = usePermit2(
    {
      tokens: [
        {
          address: inputToken,
          amount: amountIn,
        },
      ],
      spender: universalRouter,
    },
    {
      enabled: isSwapEnabled && !skipPermit2,
      chainId,
    },
  );

  const swapTransaction = useTransaction();

  const swapExecute = useCallback(
    async (signedPermit2?: Permit2SignedResult): Promise<Hex> => {
      assertSdkInitialized(sdk);
      assertWalletConnected(connectedAddress);

      const quote = quoteQuery.data;
      if (!quote) {
        throw new Error("Quote not available");
      }

      const inputBalanceRaw = inputTokenQuery.data?.balance?.raw;
      if (inputBalanceRaw !== undefined && amountIn > inputBalanceRaw) {
        throw new Error("Insufficient balance for swap amount");
      }

      const permit2Signed = signedPermit2 ?? permit2.permit2.signed;
      if (!permit2Signed && permit2.permit2.isRequired) {
        throw new Error("Permit2 signature required");
      }

      const permit2Signature = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;

      const pool = await sdk.getPool(poolKey);

      const calldata = await sdk.buildSwapCallData({
        pool,
        amountIn,
        amountOutMinimum: quote.minAmountOut,
        zeroForOne,
        recipient: recipient ?? connectedAddress,
        permit2Signature,
        useNativeETH,
      });

      return swapTransaction.sendTransaction({
        to: universalRouter,
        data: calldata,
        value: isNativeInput || isNativeETHInput ? amountIn : 0n,
      });
    },
    [
      sdk,
      connectedAddress,
      quoteQuery.data,
      inputTokenQuery.data?.balance?.raw,
      permit2.permit2,
      poolKey,
      amountIn,
      zeroForOne,
      recipient,
      swapTransaction,
      universalRouter,
      isNativeInput,
      isNativeETHInput,
      useNativeETH,
    ],
  );

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
