"use client";

import { useCallback } from "react";

import type { Address, Hex } from "viem";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  TradeType,
  calculateMaximumInput,
  calculateMinimumOutput,
  mapRoute,
  resolveSwapRouteExactInput,
  resolveSwapRouteExactOutput,
  type ExactInputQuoteResponse,
  type ExactOutputQuoteResponse,
  type SwapExactIn,
  type SwapExactOut,
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
interface UseSwapCommonParams {
  /** Ordered route to swap through. A single-hop swap is a route with one entry. */
  route: SwapRoute;
  /** Recipient address for the output tokens (defaults to connected wallet) */
  recipient?: Address;
  /** Slippage tolerance in basis points (default: 50 = 0.5%) */
  slippageBps?: number;
  /** When true, wraps/unwraps native ETH for WETH-denominated pools */
  useNativeETH?: boolean;
}

export interface UseSwapExactInParams extends UseSwapCommonParams {
  /** Trade type for the swap. */
  tradeType: typeof TradeType.ExactInput;
  /** Input currency for the first hop in the route. */
  currencyIn: Address;
  /** Amount of input tokens in base units */
  amountIn: bigint;
  currencyOut?: never;
  amountOut?: never;
}

export interface UseSwapExactOutParams extends UseSwapCommonParams {
  /** Trade type for the swap. */
  tradeType: typeof TradeType.ExactOutput;
  /** Output currency for the final hop in the route. */
  currencyOut: Address;
  /** Amount of output tokens in base units */
  amountOut: bigint;
  currencyIn?: never;
  amountIn?: never;
}

export type UseSwapParams = UseSwapExactInParams | UseSwapExactOutParams;

export interface ExactInputQuoteData extends ExactInputQuoteResponse {
  /** Minimum output after applying slippage tolerance */
  minAmountOut: bigint;
}

export interface ExactOutputQuoteData extends ExactOutputQuoteResponse {
  /** Maximum input after applying slippage tolerance */
  maxAmountIn: bigint;
}

export type QuoteData = ExactInputQuoteData | ExactOutputQuoteData;
export type QuoteDataByTradeType<TTradeType extends typeof TradeType.ExactInput | typeof TradeType.ExactOutput> =
  TTradeType extends typeof TradeType.ExactOutput ? ExactOutputQuoteData : ExactInputQuoteData;

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
export interface UseSwapSteps<
  TTradeType extends typeof TradeType.ExactInput | typeof TradeType.ExactOutput = typeof TradeType.ExactInput,
> {
  /** Auto-fetching quote query with slippage-adjusted minAmountOut */
  quote: UseQueryResult<QuoteDataByTradeType<TTradeType>, Error>;
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
export interface UseSwapReturn<
  TTradeType extends typeof TradeType.ExactInput | typeof TradeType.ExactOutput = typeof TradeType.ExactInput,
> {
  /** All swap lifecycle steps with individual state and actions */
  steps: UseSwapSteps<TTradeType>;
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
 * @param options - Configuration: enabled, refetchInterval, chainId
 * @returns Swap lifecycle steps, current step indicator, and executeAll action
 *
 * @example Basic usage with individual step control
 * ```tsx
 * const swap = useSwap(
 *   { tradeType: TradeType.ExactInput, currencyIn, route, amountIn: 1000000n },
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
 * const swap = useSwap({ tradeType: TradeType.ExactInput, currencyIn, route, amountIn: 1000000n });
 *
 * // Single call handles approve → sign → swap
 * const txHash = await swap.executeAll();
 * ```
 */
function isExactOutputParams(params: UseSwapParams): params is UseSwapExactOutParams {
  return params.tradeType === TradeType.ExactOutput;
}

export function useSwap(
  params: UseSwapExactInParams,
  options?: UseHookOptions,
): UseSwapReturn<typeof TradeType.ExactInput>;
export function useSwap(
  params: UseSwapExactOutParams,
  options?: UseHookOptions,
): UseSwapReturn<typeof TradeType.ExactOutput>;
export function useSwap(
  params: UseSwapParams,
  options: UseHookOptions = {},
): UseSwapReturn<typeof TradeType.ExactInput | typeof TradeType.ExactOutput> {
  const { route, recipient: recipientOverride, slippageBps: slippageBpsParam, useNativeETH } = params;
  const { enabled = true, refetchInterval = false, chainId: chainIdOverride } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();
  const recipient = recipientOverride ?? connectedAddress;
  const exactOutput = isExactOutputParams(params);

  const slippageBps = slippageBpsParam ?? sdk.defaultSlippageTolerance;

  const wethAddress = sdk.getContractAddress("weth");
  const mappedRoute = mapRoute(route, ({ poolKey, hookData }) => ({
    poolKey: {
      currency0: poolKey.currency0 as Address,
      currency1: poolKey.currency1 as Address,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks as Address,
    },
    hookData,
  }));

  const firstHopPoolKey = route[0].poolKey;
  const lastHopPoolKey = route[route.length - 1]!.poolKey;
  const firstHopSupportsNativeInput =
    firstHopPoolKey.currency0.toLowerCase() === zeroAddress.toLowerCase() ||
    firstHopPoolKey.currency1.toLowerCase() === zeroAddress.toLowerCase();
  const lastHopSupportsNativeOutput =
    lastHopPoolKey.currency0.toLowerCase() === zeroAddress.toLowerCase() ||
    lastHopPoolKey.currency1.toLowerCase() === zeroAddress.toLowerCase();

  let resolvedCurrencyIn: Address;
  let resolvedCurrencyOut: Address;

  if (exactOutput) {
    const shouldTreatNativeOutputAsWeth =
      !!useNativeETH && params.currencyOut.toLowerCase() === zeroAddress.toLowerCase() && !lastHopSupportsNativeOutput;
    const resolvedRequestedOutputCurrency = shouldTreatNativeOutputAsWeth ? wethAddress : params.currencyOut;
    const routeResolution = resolveSwapRouteExactOutput(resolvedRequestedOutputCurrency, mappedRoute);

    resolvedCurrencyIn = routeResolution.inputCurrency;
    resolvedCurrencyOut = resolvedRequestedOutputCurrency;
  } else {
    const shouldTreatNativeInputAsWeth =
      !!useNativeETH && params.currencyIn.toLowerCase() === zeroAddress.toLowerCase() && !firstHopSupportsNativeInput;
    const resolvedRequestedInputCurrency = shouldTreatNativeInputAsWeth ? wethAddress : params.currencyIn;
    const routeResolution = resolveSwapRouteExactInput(resolvedRequestedInputCurrency, mappedRoute);

    resolvedCurrencyIn = resolvedRequestedInputCurrency;
    resolvedCurrencyOut = routeResolution.outputCurrency;
  }

  const isNativeInput = resolvedCurrencyIn.toLowerCase() === zeroAddress.toLowerCase();
  const exactAmount = exactOutput ? params.amountOut : params.amountIn;

  // When useNativeETH is set, treat WETH-denominated input as native ETH for balance checks and permit handling.
  const isNativeEthInput = !!useNativeETH && resolvedCurrencyIn.toLowerCase() === wethAddress.toLowerCase();

  const quoteEnabled = enabled && exactAmount > 0n;
  const swapEnabled = quoteEnabled && !!connectedAddress;
  const requiresPermit2 = !isNativeInput && !isNativeEthInput;

  const universalRouter = sdk.getContractAddress("universalRouter");
  const { query: inputTokenQuery } = useToken(
    {
      tokenAddress: isNativeEthInput ? zeroAddress : resolvedCurrencyIn,
    },
    {
      enabled: swapEnabled,
      chainId,
    },
  );

  const quoteQuery = useQuery({
    queryKey: swapKeys.quote(
      exactOutput ? TradeType.ExactOutput : TradeType.ExactInput,
      exactOutput ? resolvedCurrencyOut : resolvedCurrencyIn,
      route,
      exactAmount,
      slippageBps,
      chainId,
    ),
    queryFn: async (): Promise<QuoteData> => {
      assertSdkInitialized(sdk);

      if (exactAmount == 0n) {
        throw new Error(`${exactOutput ? "Output" : "Input"} amount must be greater than zero`);
      }

      if (exactOutput) {
        const quoteParams: SwapExactOut = {
          tradeType: TradeType.ExactOutput,
          currencyOut: resolvedCurrencyOut,
          route: mappedRoute,
          amountOut: params.amountOut.toString(),
        };

        const quote = await sdk.getQuote(quoteParams);
        const maxAmountIn = calculateMaximumInput(quote.amountIn, slippageBps);

        return { ...quote, maxAmountIn };
      }

      const quoteParams: SwapExactIn = {
        tradeType: TradeType.ExactInput,
        currencyIn: resolvedCurrencyIn,
        route: mappedRoute,
        amountIn: params.amountIn.toString(),
      };

      const quote = await sdk.getQuote(quoteParams);
      const minAmountOut = calculateMinimumOutput(quote.amountOut, slippageBps);

      return { ...quote, minAmountOut };
    },
    enabled: quoteEnabled && exactAmount !== 0n,
    queryKeyHashFn: hashFn,
    refetchInterval,
  });

  const quote = quoteQuery.data;
  const permit2Amount = exactOutput
    ? quote?.tradeType === TradeType.ExactOutput
      ? quote.maxAmountIn
      : 0n
    : params.amountIn;

  const permit2 = usePermit2(
    {
      tokens: [
        {
          address: resolvedCurrencyIn,
          amount: permit2Amount,
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
  const inputBalance = inputTokenQuery.data?.balance?.raw;

  const swapExecute = useCallback(
    async (signedPermit2?: Permit2SignedResult): Promise<Hex> => {
      assertSdkInitialized(sdk);
      assertWalletConnected(connectedAddress);

      if (!quote) {
        throw new Error("Quote not available");
      }

      if (exactOutput) {
        if (quote.tradeType !== TradeType.ExactOutput) {
          throw new Error("Exact-output quote not available");
        }

        const maxSpendAmount = quote.maxAmountIn;

        if (inputBalance !== undefined && maxSpendAmount > inputBalance) {
          throw new Error("Insufficient balance for swap amount");
        }

        const permit2Signed = signedPermit2 ?? permit2.permit2.signed;
        if (!permit2Signed && permit2.permit2.isRequired) {
          throw new Error("Permit2 signature required");
        }

        const permit2Signature = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;
        const pools = await Promise.all(route.map(({ poolKey }) => sdk.getPool(poolKey)));
        const resolvedRoute = mapRoute(route, (hop, index) => ({ pool: pools[index]!, hookData: hop.hookData }));

        const calldata = await sdk.buildSwapCallData({
          tradeType: TradeType.ExactOutput,
          currencyOut: resolvedCurrencyOut,
          route: resolvedRoute,
          amountOut: quote.amountOut,
          amountInMaximum: quote.maxAmountIn,
          recipient: recipient ?? connectedAddress,
          permit2Signature,
          useNativeETH,
        });

        return swapTransaction.sendTransaction({
          to: universalRouter,
          data: calldata,
          value: isNativeInput || isNativeEthInput ? maxSpendAmount : 0n,
        });
      }

      if (quote.tradeType !== TradeType.ExactInput) {
        throw new Error("Exact-input quote not available");
      }

      const maxSpendAmount = params.amountIn;

      if (inputBalance !== undefined && maxSpendAmount > inputBalance) {
        throw new Error("Insufficient balance for swap amount");
      }

      const permit2Signed = signedPermit2 ?? permit2.permit2.signed;
      if (!permit2Signed && permit2.permit2.isRequired) {
        throw new Error("Permit2 signature required");
      }

      const permit2Signature = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;

      const pools = await Promise.all(route.map(({ poolKey }) => sdk.getPool(poolKey)));
      const resolvedRoute = mapRoute(route, (hop, index) => ({ pool: pools[index]!, hookData: hop.hookData }));
      const calldata = await sdk.buildSwapCallData({
        tradeType: TradeType.ExactInput,
        currencyIn: resolvedCurrencyIn,
        route: resolvedRoute,
        amountIn: params.amountIn,
        amountOutMinimum: quote.minAmountOut,
        recipient: recipient ?? connectedAddress,
        permit2Signature,
        useNativeETH,
      });

      return swapTransaction.sendTransaction({
        to: universalRouter,
        data: calldata,
        value: isNativeInput || isNativeEthInput ? maxSpendAmount : 0n,
      });
    },
    [
	sdk,
	connectedAddress,
	resolvedCurrencyIn,
	resolvedCurrencyOut,
	quote,
	inputBalance,
	permit2.permit2,
	route,
	recipient,
	swapTransaction,
	universalRouter,
	isNativeInput,
	isNativeEthInput,
	useNativeETH,
	params,
	exactOutput
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
      quote: quoteQuery as UseQueryResult<
        QuoteDataByTradeType<typeof TradeType.ExactInput | typeof TradeType.ExactOutput>,
        Error
      >,
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
