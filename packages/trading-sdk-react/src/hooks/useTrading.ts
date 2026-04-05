"use client";

import { useCallback } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  type AutoSlippage,
  type RoutingPreference,
  type TradingApprovalResponse,
  type TradingQuoteResponse,
  type Urgency,
} from "@zahastudio/trading-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { hashFn } from "wagmi/query";

import {
  useTradingApproval,
  useTradingPermit,
  useTransaction,
  type UseTradingPermitStep,
  type UseTransactionReturn,
} from "@/hooks/primitives";
import { useTradingSDK } from "@/hooks/useTradingSDK";
import { assertConnectedSwapper, tradingKeys } from "@/utils";

export interface UseTradingParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  swapper?: Address;
  slippageTolerance?: number;
  autoSlippage?: AutoSlippage;
  urgency?: Urgency;
  routingPreference?: RoutingPreference;
  permit2Disabled?: boolean;
}

export interface UseTradingOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
  chainId?: number;
}

export interface UseTradingSwapStep {
  transaction: UseTransactionReturn;
  execute: () => Promise<Hex>;
}

interface UseTradingApprovalBaseStep {
  isRequired: boolean;
  data: TradingApprovalResponse | undefined;
  query: UseQueryResult<TradingApprovalResponse, Error>;
  transaction: UseTransactionReturn;
  execute: () => Promise<Hex>;
}

export interface UseTradingApprovalResetStep extends UseTradingApprovalBaseStep {}

export interface UseTradingApprovalStep extends UseTradingApprovalBaseStep {}

export interface UseTradingSteps {
  quote: UseQueryResult<TradingQuoteResponse, Error>;
  approvalReset: UseTradingApprovalResetStep;
  approval: UseTradingApprovalStep;
  permit2: UseTradingPermitStep;
  swap: UseTradingSwapStep;
}

export type TradingStep = "quote" | "approval-reset" | "approval" | "permit2" | "swap" | "completed";

export interface UseTradingReturn {
  steps: UseTradingSteps;
  currentStep: TradingStep;
  executeAll: () => Promise<Hex>;
  reset: () => void;
}

export function useTrading(params: UseTradingParams, options: UseTradingOptions = {}): UseTradingReturn {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    swapper: swapperOverride,
    slippageTolerance,
    autoSlippage,
    urgency,
    routingPreference,
    permit2Disabled = false,
  } = params;
  const { enabled = true, refetchInterval = false, chainId: chainIdOverride } = options;

  const { sdk, chainId } = useTradingSDK({ chainId: chainIdOverride });
  const { address: connectedAddress } = useAccount();

  const swapper = swapperOverride ?? connectedAddress;
  const isNativeInput = tokenIn.toLowerCase() === zeroAddress.toLowerCase();
  const quoteEnabled = enabled && amountIn > 0n && !!swapper;
  const approvalEnabled = quoteEnabled && !isNativeInput;

  const quoteQuery = useQuery({
    queryKey: tradingKeys.quote({
      tokenIn,
      tokenOut,
      amountIn,
      chainId,
      swapper,
      permit2Disabled,
      slippageTolerance,
      autoSlippage,
      urgency,
      routingPreference,
    }),
    queryFn: async ({ signal }): Promise<TradingQuoteResponse> => {
      if (!swapper) {
        throw new Error("Swapper address is required to request a quote.");
      }

      return sdk.getQuote(
        {
          type: "EXACT_INPUT",
          amount: amountIn,
          tokenIn,
          tokenOut,
          chainId,
          swapper,
          slippageTolerance,
          autoSlippage,
          urgency,
          routingPreference,
        },
        { permit2Disabled, signal },
      );
    },
    enabled: quoteEnabled,
    queryKeyHashFn: hashFn,
    refetchInterval,
  });

  const approval = useTradingApproval({
    sdk,
    tokenIn,
    tokenOut,
    amountIn,
    swapper,
    chainId,
    connectedAddress,
    permit2Disabled,
    urgency,
    enabled: approvalEnabled,
  });
  const swapTransaction = useTransaction({ chainId });

  const quote = quoteQuery.data;
  const permit = useTradingPermit({
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    swapper,
    connectedAddress,
    permit2Disabled,
    permitData: quote?.permitData,
    requestId: quoteQuery.data?.requestId,
  });

  const executeSwap = useCallback(
    async (signatureOverride?: Hex): Promise<Hex> => {
      assertConnectedSwapper(swapper, connectedAddress);

      if (!quote) {
        throw new Error("Quote not available.");
      }

      const signature = signatureOverride ?? permit.signature;
      const response = await sdk.createSwap(
        {
          quote: quote.quote,
          signature,
          permitData: signature ? quote.permitData : undefined,
          urgency,
        },
        { permit2Disabled },
      );

      const { hash } = await swapTransaction.sendAndConfirm(response.swap);
      return hash;
    },
    [connectedAddress, permit.signature, permit2Disabled, quote, sdk, swapTransaction, swapper, urgency],
  );

  const currentStep: TradingStep = (() => {
    if (!quote || quoteQuery.isLoading || approval.isDecisionPending || !swapper) {
      return "quote";
    }

    if (approval.approvalReset.isRequired) {
      return "approval-reset";
    }

    if (approval.approval.isRequired) {
      return "approval";
    }

    if (permit.isRequired && !permit.signature) {
      return "permit2";
    }

    if (swapTransaction.status !== "confirmed") {
      return "swap";
    }

    return "completed";
  })();

  const executeAll = useCallback(async (): Promise<Hex> => {
    const approvalState = await approval.resolve();
    if (approvalState?.cancel || approvalState?.approval) {
      await approval.execute();
    }

    const signature = permit.isRequired ? await permit.sign() : undefined;
    return executeSwap(signature);
  }, [approval, executeSwap, permit]);

  const reset = useCallback(() => {
    swapTransaction.reset();
    approval.approvalReset.transaction.reset();
    approval.approval.transaction.reset();
    permit.reset();
  }, [approval.approval.transaction, approval.approvalReset.transaction, permit, swapTransaction]);

  const steps: UseTradingSteps = {
    quote: quoteQuery,
    approvalReset: approval.approvalReset,
    approval: approval.approval,
    permit2: permit,
    swap: {
      transaction: swapTransaction,
      execute: () => executeSwap(),
    },
  };

  return {
    steps,
    currentStep,
    executeAll,
    reset,
  };
}
