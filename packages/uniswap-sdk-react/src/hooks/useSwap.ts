"use client";

import { useCallback } from "react";

import type { Address, Hex } from "viem";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  calculateMaximumInput,
  calculateMinimumOutput,
  mapRoute,
  type QuoteResponse,
  resolveSwapCurrencyMeta,
  type SwapMeta,
  type SwapQuoteParams,
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

interface UseSwapCommonParams {
  route: SwapRoute;
  recipient?: Address;
  slippageBps?: number;
  useNativeToken?: boolean;
}

interface UseSwapExactInputParams extends UseSwapCommonParams {
  exactInput: {
    currency: Address;
    amount: bigint;
  };
  exactOutput?: never;
}

interface UseSwapExactOutputParams extends UseSwapCommonParams {
  exactOutput: {
    currency: Address;
    amount: bigint;
  };
  exactInput?: never;
}

export type UseSwapParams = UseSwapExactInputParams | UseSwapExactOutputParams;

type SwapMode = "exactInput" | "exactOutput";

export interface ExactInputQuoteData extends QuoteResponse {
  minAmountOut: bigint;
}

export interface ExactOutputQuoteData extends QuoteResponse {
  maxAmountIn: bigint;
}

export type QuoteData = ExactInputQuoteData | ExactOutputQuoteData;
type QuoteDataByMode<TMode extends SwapMode> = TMode extends "exactOutput" ? ExactOutputQuoteData : ExactInputQuoteData;

export interface UseSwapExecuteStep {
  transaction: UseTransactionReturn;
  execute: () => Promise<Hex>;
}

export interface UseSwapSteps<TMode extends SwapMode = "exactInput"> {
  quote: UseQueryResult<QuoteDataByMode<TMode>, Error>;
  approval: UseTokenApprovalReturn;
  permit2: UsePermit2SignStep;
  swap: UseSwapExecuteStep;
}

export type SwapStep = "quote" | "approval" | "permit2" | "swap" | "completed";

export interface UseSwapReturn<TMode extends SwapMode = "exactInput"> {
  steps: UseSwapSteps<TMode>;
  meta: SwapMeta;
  currentStep: SwapStep;
  executeAll: () => Promise<Hex>;
  reset: () => void;
}

function isExactOutputParams(params: UseSwapParams): params is UseSwapExactOutputParams {
  return "exactOutput" in params;
}

function isExactOutputQuoteData(quote: QuoteData): quote is ExactOutputQuoteData {
  return "maxAmountIn" in quote;
}

function isExactInputQuoteData(quote: QuoteData): quote is ExactInputQuoteData {
  return "minAmountOut" in quote;
}

export function useSwap(params: UseSwapExactInputParams, options?: UseHookOptions): UseSwapReturn<"exactInput">;
export function useSwap(params: UseSwapExactOutputParams, options?: UseHookOptions): UseSwapReturn<"exactOutput">;
export function useSwap(params: UseSwapParams, options?: UseHookOptions): UseSwapReturn<"exactInput" | "exactOutput">;
export function useSwap(
  params: UseSwapParams,
  options: UseHookOptions = {},
): UseSwapReturn<"exactInput" | "exactOutput"> {
  const { route, recipient: recipientOverride, slippageBps: slippageBpsParam, useNativeToken } = params;
  const { enabled = true, refetchInterval = false, chainId: chainIdOverride } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();
  const recipient = recipientOverride ?? connectedAddress;
  const exactOutput = isExactOutputParams(params);
  const mode: SwapMode = exactOutput ? "exactOutput" : "exactInput";
  const exactAmount = exactOutput ? params.exactOutput.amount : params.exactInput.amount;
  const exactCurrency = exactOutput ? params.exactOutput.currency : params.exactInput.currency;
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
  const currencyMeta = resolveSwapCurrencyMeta({ ...params, wethAddress });
  const meta: SwapMeta = {
    resolvedCurrencyIn: currencyMeta.resolvedCurrencyIn,
    resolvedCurrencyOut: currencyMeta.resolvedCurrencyOut,
  };

  const quoteEnabled = enabled && exactAmount > 0n;
  const swapEnabled = quoteEnabled && !!connectedAddress;
  const universalRouter = sdk.getContractAddress("universalRouter");

  const quoteQuery = useQuery({
    queryKey: swapKeys.quote(mode, exactCurrency, route, exactAmount, slippageBps, !!useNativeToken, chainId),
    queryFn: async (): Promise<QuoteData> => {
      assertSdkInitialized(sdk);

      if (exactAmount === 0n) {
        throw new Error(`${exactOutput ? "Output" : "Input"} amount must be greater than zero`);
      }

      const quoteParams: SwapQuoteParams = exactOutput
        ? {
            route: mappedRoute,
            exactOutput: {
              currency: params.exactOutput.currency,
              amount: params.exactOutput.amount.toString(),
            },
            useNativeToken,
          }
        : {
            route: mappedRoute,
            exactInput: {
              currency: params.exactInput.currency,
              amount: params.exactInput.amount.toString(),
            },
            useNativeToken,
          };

      const quote = await sdk.getQuote(quoteParams);

      if (exactOutput) {
        return {
          ...quote,
          maxAmountIn: calculateMaximumInput(quote.amountIn, slippageBps),
        };
      }

      return {
        ...quote,
        minAmountOut: calculateMinimumOutput(quote.amountOut, slippageBps),
      };
    },
    enabled: quoteEnabled,
    queryKeyHashFn: hashFn,
    refetchInterval,
  });

  const quote = quoteQuery.data;
  const inputCurrencyForSteps = meta.resolvedCurrencyIn;
  const isNativeInput = inputCurrencyForSteps.toLowerCase() === zeroAddress.toLowerCase();
  const requiresPermit2 = !isNativeInput;

  const { query: inputTokenQuery } = useToken(
    {
      tokenAddress: inputCurrencyForSteps,
    },
    {
      enabled: swapEnabled,
      chainId,
    },
  );

  const permit2Amount = exactOutput
    ? quote && isExactOutputQuoteData(quote)
      ? quote.maxAmountIn
      : 0n
    : params.exactInput.amount;

  const permit2 = usePermit2(
    {
      tokens: [
        {
          address: inputCurrencyForSteps,
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

      if (exactOutput && !isExactOutputQuoteData(quote)) {
        throw new Error("Exact-output quote not available");
      }

      if (!exactOutput && !isExactInputQuoteData(quote)) {
        throw new Error("Exact-input quote not available");
      }

      const maxSpendAmount = exactOutput ? (quote as ExactOutputQuoteData).maxAmountIn : params.exactInput.amount;

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

      const calldata = exactOutput
        ? await (() => {
            const exactOutputQuote = quote as ExactOutputQuoteData;

            return sdk.buildSwapCallData({
              route: resolvedRoute,
              exactOutput: {
                currency: params.exactOutput.currency,
                amount: exactOutputQuote.amountOut,
              },
              maxAmountIn: exactOutputQuote.maxAmountIn,
              recipient: recipient ?? connectedAddress,
              permit2Signature,
              useNativeToken,
            });
          })()
        : await (() => {
            const exactInputQuote = quote as ExactInputQuoteData;

            return sdk.buildSwapCallData({
              route: resolvedRoute,
              exactInput: {
                currency: params.exactInput.currency,
                amount: params.exactInput.amount,
              },
              minAmountOut: exactInputQuote.minAmountOut,
              recipient: recipient ?? connectedAddress,
              permit2Signature,
              useNativeToken,
            });
          })();

      return swapTransaction.sendTransaction({
        to: universalRouter,
        data: calldata,
        value: isNativeInput ? maxSpendAmount : 0n,
      });
    },
    [
      connectedAddress,
      exactOutput,
      inputBalance,
      isNativeInput,
      params,
      permit2.permit2,
      quote,
      recipient,
      route,
      sdk,
      swapTransaction,
      universalRouter,
      useNativeToken,
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
      quote: quoteQuery as UseQueryResult<QuoteDataByMode<"exactInput" | "exactOutput">, Error>,
      approval: permit2.approvals[0],
      permit2: permit2.permit2,
      swap: {
        transaction: swapTransaction,
        execute: () => swapExecute(),
      },
    },
    meta,
    currentStep,
    executeAll,
    reset,
  };
}
