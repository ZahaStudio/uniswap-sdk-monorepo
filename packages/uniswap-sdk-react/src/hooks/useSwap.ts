"use client";

import { useCallback } from "react";

import type { Address, Hex } from "viem";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  calculateMinimumOutput,
  mapRoute,
  type QuoteResponse,
  type SwapExactIn,
  type SwapRoute,
} from "@zahastudio/uniswap-sdk";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { hashFn } from "wagmi/query";

import type { UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import type { UseHookOptions } from "@/types/hooks";

import { usePermit2, type Permit2SignedResult, type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { useToken } from "@/hooks/primitives/useToken";
import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { assertSdkInitialized, assertWalletConnected } from "@/utils/assertions";
import { swapKeys } from "@/utils/queryKeys";

/**
 * Operation parameters for the useSwap hook.
 */
export interface UseSwapParams {
  /** Input currency for the first hop in the route. */
  currencyIn: Address;
  /** Ordered route to swap through. A single-hop swap is a route with one entry. */
  route: SwapRoute;
  /** Amount of input tokens in base units */
  amountIn: bigint;
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
 * @param params - Operation parameters: currencyIn, route, amountIn, recipient, slippageBps
 * @param options - Configuration: enabled, refetchInterval, staleTime, chainId
 * @returns Swap lifecycle steps, current step indicator, and executeAll action
 *
 * @example Basic usage with individual step control
 * ```tsx
 * const swap = useSwap(
 *   { currencyIn, route, amountIn: 1000000n },
 *   { refetchInterval: 12000 },
 * );
 *
 * // Show quote (steps.quote is a UseQueryResult)
 * const { data: quote } = swap.steps.quote;
 *
 * // Step through the flow
 * if (swap.steps.approval.isRequired) {
 *   await swap.steps.approval.approve();
 * }
 * await swap.steps.permit2.sign();
 * const txHash = await swap.steps.swap.execute();
 * ```
 *
 * @example One-click swap with executeAll
 * ```tsx
 * const swap = useSwap({ currencyIn, route, amountIn: 1000000n });
 *
 * // Single call handles approve → sign → swap
 * const txHash = await swap.executeAll();
 * ```
 */
export function useSwap(params: UseSwapParams, options: UseHookOptions = {}): UseSwapReturn {
  const {
    currencyIn,
    route,
    amountIn,
    recipient: recipientOverride,
    slippageBps: slippageBpsParam,
    useNativeETH,
  } = params;
  const { enabled = true, refetchInterval = false, chainId: chainIdOverride } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();
  const recipient = recipientOverride ?? connectedAddress;

  const slippageBps = slippageBpsParam ?? sdk.defaultSlippageTolerance;

  const isNativeInput = currencyIn.toLowerCase() === zeroAddress.toLowerCase();

  // When useNativeETH is set, check if the input side is the WETH token
  const isNativeEthInput = useNativeETH
    ? currencyIn.toLowerCase() === sdk.getContractAddress("weth").toLowerCase()
    : false;

  const quoteEnabled = enabled && amountIn > 0n;
  const swapEnabled = quoteEnabled && !!connectedAddress;
  const requiresPermit2 = !isNativeInput && !isNativeEthInput;

  const universalRouter = sdk.getContractAddress("universalRouter");
  const { query: inputTokenQuery } = useToken(
    {
      tokenAddress: isNativeEthInput ? zeroAddress : currencyIn,
    },
    {
      enabled: swapEnabled,
      chainId,
    },
  );

  const quoteQuery = useQuery({
    queryKey: swapKeys.quote(currencyIn, route, amountIn, slippageBps, chainId),
    queryFn: async (): Promise<QuoteData> => {
      assertSdkInitialized(sdk);

      if (amountIn == 0n) {
        throw new Error("Input amount must be greater than zero");
      }

      const quoteParams: SwapExactIn = {
        currencyIn,
        route: mapRoute(route, ({ poolKey, hookData }) => ({
          poolKey: {
            currency0: poolKey.currency0 as Address,
            currency1: poolKey.currency1 as Address,
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks as Address,
          },
          hookData,
        })),
        amountIn: amountIn.toString(),
      };

      const quote = await sdk.getQuote(quoteParams);
      const minAmountOut = calculateMinimumOutput(quote.amountOut, slippageBps);

      return { ...quote, minAmountOut };
    },
    enabled: quoteEnabled && amountIn !== 0n,
    queryKeyHashFn: hashFn,
    refetchInterval,
  });

  const permit2 = usePermit2(
    {
      tokens: [
        {
          address: currencyIn,
          amount: amountIn,
        },
      ],
      spender: universalRouter,
    },
    {
      enabled: swapEnabled && requiresPermit2,
      chainId,
    },
  );

  const swapTransaction = useTransaction({ chainId });
  const quote = quoteQuery.data;
  const inputBalance = inputTokenQuery.data?.balance?.raw;

  const swapExecute = useCallback(
    async (signedPermit2?: Permit2SignedResult): Promise<Hex> => {
      assertSdkInitialized(sdk);
      assertWalletConnected(connectedAddress);

      if (!quote) {
        throw new Error("Quote not available");
      }

      if (inputBalance !== undefined && amountIn > inputBalance) {
        throw new Error("Insufficient balance for swap amount");
      }

      const permit2Signed = signedPermit2 ?? permit2.permit2.signed;
      if (!permit2Signed && permit2.permit2.isRequired) {
        throw new Error("Permit2 signature required");
      }

      const permit2Signature = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;

      const pools = await Promise.all(route.map(({ poolKey }) => sdk.getPool(poolKey)));

      const calldata = await sdk.buildSwapCallData({
        currencyIn,
        route: mapRoute(route, (hop, index) => ({ pool: pools[index]!, hookData: hop.hookData })),
        amountIn,
        amountOutMinimum: quote.minAmountOut,
        recipient: recipient ?? connectedAddress,
        permit2Signature,
        useNativeETH,
      });

      return swapTransaction.sendTransaction({
        to: universalRouter,
        data: calldata,
        value: isNativeInput || isNativeEthInput ? amountIn : 0n,
      });
    },
    [
      sdk,
      connectedAddress,
      currencyIn,
      quote,
      inputBalance,
      permit2.permit2,
      route,
      amountIn,
      recipient,
      swapTransaction,
      universalRouter,
      isNativeInput,
      isNativeEthInput,
      useNativeETH,
    ],
  );

  const currentStep: SwapStep = (() => {
    if (!quote || quoteQuery.isLoading || !connectedAddress) {
      return "quote";
    }

    if (requiresPermit2) {
      if (permit2.approvals[0].isRequired === undefined || permit2.approvals[0].isRequired) {
        return "approval";
      }
      if (permit2.permit2.isRequired && !permit2.permit2.isSigned) {
        return "permit2";
      }
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
