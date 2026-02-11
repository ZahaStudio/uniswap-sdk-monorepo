"use client";

import { useCallback, useRef, useState } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  calculateMinimumOutput,
  DEFAULT_SLIPPAGE_TOLERANCE,
  PERMIT2_ADDRESS,
  type FeeTier,
  type PoolKey,
  type PreparePermit2DataResult,
  type QuoteResponse,
  type SwapExactInSingle,
} from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount, useSignTypedData } from "wagmi";

import { useTokenApproval, type UseTokenApprovalReturn } from "@/hooks/useTokenApproval";
import { useTransaction, type UseTransactionReturn } from "@/hooks/useTransaction";
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
 * Permit2 signing step state.
 */
export interface UseSwapPermit2Step {
  /** Whether permit2 signing is required (false for native ETH) */
  isRequired: boolean;
  /** Whether the wallet signature prompt is pending */
  isPending: boolean;
  /** Whether the permit2 has been signed */
  isSigned: boolean;
  /** Error from the signing step */
  error: Error | undefined;
  /** Initiate permit2 preparation and signing */
  sign: () => Promise<void>;
  /** Reset the permit2 step */
  reset: () => void;
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
  permit2: UseSwapPermit2Step;
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

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

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

  // ── SDK & Wallet ────────────────────────────────────────────────────────
  const { sdk, chainId } = useUniswapSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();
  const recipient = recipientOverride ?? connectedAddress;

  // ── Derived Constants ───────────────────────────────────────────────────
  const inputToken = (zeroForOne ? poolKey.currency0 : poolKey.currency1) as Address;
  const isNativeInput = inputToken.toLowerCase() === zeroAddress.toLowerCase();

  const hasValidAmount = amountIn > 0n;
  const isWalletReady = !!connectedAddress;
  const isQuoteEnabled = enabled && hasValidAmount && !!sdk;
  const isSwapEnabled = isQuoteEnabled && isWalletReady;

  // ── Step 1: Quote ───────────────────────────────────────────────────────
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
      // Don't retry on known non-transient errors
      if (error instanceof Error && error.message.includes("insufficient liquidity")) return false;
      return failureCount < 3;
    },
  });

  // ── Step 2: Approval (ERC-20 → Permit2) ────────────────────────────────
  const approval = useTokenApproval(
    {
      token: inputToken,
      spender: PERMIT2_ADDRESS as Address,
      amount: amountIn,
    },
    {
      enabled: isSwapEnabled,
      chainId,
    },
  );

  // ── Step 3: Permit2  ─────────────────────────────────────────────
  const signTypedData = useSignTypedData();
  const permit2DataRef = useRef<ReturnType<PreparePermit2DataResult["buildPermit2DataWithSignature"]> | undefined>(
    undefined,
  );
  const [permit2Error, setPermit2Error] = useState<Error | undefined>(undefined);

  const permit2Sign = useCallback(async () => {
    if (isNativeInput) {
      return;
    }
    if (!isWalletReady) {
      throw new Error("No wallet connected");
    }
    if (!sdk) {
      throw new Error("SDK not initialized");
    }

    try {
      setPermit2Error(undefined);

      const universalRouter = sdk.getContractAddress("universalRouter");

      // Prepare the permit2 data (reads on-chain nonce/expiration)
      const prepareResult = await sdk.preparePermit2Data({
        token: inputToken,
        spender: universalRouter,
        owner: connectedAddress,
        sigDeadline: Math.floor(Date.now() / 1000) + 60 * 15, // 5 minutes from now
      });

      // Sign the typed data via wallet
      const signature = await signTypedData.signTypedDataAsync({
        domain: prepareResult.toSign.domain,
        types: prepareResult.toSign.types,
        primaryType: prepareResult.toSign.primaryType,
        message: prepareResult.toSign.message,
      });

      // Build the final permit2 data with the signature
      permit2DataRef.current = prepareResult.buildPermit2DataWithSignature(signature);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setPermit2Error(error);
      throw error;
    }
  }, [isNativeInput, isWalletReady, sdk, inputToken, connectedAddress, signTypedData]);

  const permit2Reset = useCallback(() => {
    permit2DataRef.current = undefined;
    setPermit2Error(undefined);
    signTypedData.reset();
  }, [signTypedData]);

  const permit2Step: UseSwapPermit2Step = {
    isRequired: !isNativeInput,
    isPending: signTypedData.isPending,
    isSigned: !!permit2DataRef.current,
    error: permit2Error,
    sign: permit2Sign,
    reset: permit2Reset,
  };

  // ── Step 4: Swap execution ──────────────────────────────────────────────
  const swapTransaction = useTransaction();

  const swapExecute = useCallback(async (): Promise<Hex> => {
    if (!isWalletReady) {
      throw new Error("No wallet connected");
    }
    if (!quoteQuery.data) {
      throw new Error("Quote not available");
    }
    if (!sdk) {
      throw new Error("SDK not initialized");
    }
    if (permit2Step.isRequired && !permit2DataRef.current) {
      throw new Error("Permit2 signature required");
    }

    const universalRouter = sdk.getContractAddress("universalRouter");

    // Fetch a fresh pool for the most current on-chain state
    const pool = await sdk.getPool({
      currencyA: poolKey.currency0 as Address,
      currencyB: poolKey.currency1 as Address,
      fee: poolKey.fee as FeeTier,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks as Address,
    });

    // Build calldata
    const calldata = sdk.buildSwapCallData({
      pool,
      amountIn,
      amountOutMinimum: quoteQuery.data.minAmountOut,
      zeroForOne,
      recipient: recipient ?? connectedAddress,
      permit2Signature: permit2DataRef.current,
    });

    // Send the transaction
    return swapTransaction.sendTransaction({
      to: universalRouter,
      data: calldata,
      value: isNativeInput ? amountIn : 0n,
    });
  }, [
    isWalletReady,
    quoteQuery.data,
    sdk,
    permit2Step.isRequired,
    poolKey.currency0,
    poolKey.currency1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks,
    amountIn,
    zeroForOne,
    recipient,
    connectedAddress,
    swapTransaction,
    isNativeInput,
  ]);

  // ── Derived state ───────────────────────────────────────────────────────
  const currentStep: SwapStep = (() => {
    if (!quoteQuery.data || quoteQuery.isLoading || !isWalletReady) {
      return "quote";
    }
    if (approval.isRequired == undefined || approval.isRequired) {
      return "approval";
    }
    if (permit2Step.isRequired && !permit2DataRef.current) {
      return "permit2";
    }
    if (!swapTransaction.isConfirmed) {
      return "swap";
    }
    return "completed";
  })();

  // ── executeAll
  const executeAll = useCallback(async (): Promise<Hex> => {
    if (approval.isRequired === undefined) {
      throw new Error("Awaiting approval status.");
    }

    // Step 1: Approval (if required)
    if (approval.isRequired && !approval.transaction.isConfirmed) {
      await approval.approve();
      await approval.transaction.waitForConfirmation();
    }

    // Step 2: Permit2 sign (if required)
    if (permit2Step.isRequired && !permit2Step.isSigned) {
      await permit2Sign();
    }

    // Step 3: Execute swap
    return swapExecute();
  }, [approval, permit2Step.isRequired, permit2Step.isSigned, permit2Sign, swapExecute]);

  // ── Reset Everything
  const reset = useCallback(() => {
    approval.transaction.reset();
    permit2Reset();
    swapTransaction.reset();
  }, [approval.transaction, permit2Reset, swapTransaction]);

  return {
    steps: {
      quote: quoteQuery,
      approval,
      permit2: permit2Step,
      swap: {
        transaction: swapTransaction,
        execute: swapExecute,
      },
    },
    currentStep,
    executeAll,
    reset,
  };
}
