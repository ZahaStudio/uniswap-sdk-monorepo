"use client";

import { useCallback, useMemo, useState } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  type AutoSlippage,
  type RoutingPreference,
  type TradingApprovalResponse,
  type TradingPermitData,
  type TradingQuoteResponse,
  type Urgency,
} from "@zahastudio/trading-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { useAccount, useSignTypedData } from "wagmi";

import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { useTradingSDK } from "@/hooks/useTradingSDK";
import { assertSameAddress, assertWalletConnected } from "@/utils/assertions";
import { tradingKeys } from "@/utils/queryKeys";

interface KeyedState<T> {
  key: string;
  value: T;
}

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

export interface UseTradingApprovalStep {
  isRequired: boolean;
  resetRequired: boolean;
  approveRequired: boolean;
  data: TradingApprovalResponse | undefined;
  query: UseQueryResult<TradingApprovalResponse, Error>;
  transaction: UseTransactionReturn;
  executeReset: () => Promise<Hex>;
  executeApprove: () => Promise<Hex>;
  execute: () => Promise<Hex>;
}

export interface UseTradingPermitStep {
  isRequired: boolean;
  isPending: boolean;
  isSigned: boolean;
  error: Error | undefined;
  signature: Hex | undefined;
  sign: () => Promise<Hex | undefined>;
  reset: () => void;
}

export interface UseTradingSwapStep {
  transaction: UseTransactionReturn;
  execute: () => Promise<Hex>;
}

export interface UseTradingSteps {
  quote: UseQueryResult<TradingQuoteResponse, Error>;
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

function createPermitKey(params: {
  chainId: number;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  swapper?: Address;
  permit2Disabled: boolean;
  requestId?: string;
}): string {
  return [
    params.chainId,
    params.tokenIn,
    params.tokenOut,
    params.amountIn.toString(),
    params.swapper ?? zeroAddress,
    params.permit2Disabled,
    params.requestId ?? "",
  ].join(":");
}

function getPrimaryType(types: TradingPermitData["types"]): string {
  const primaryTypes = Object.keys(types).filter((typeName) => typeName !== "EIP712Domain");
  if (primaryTypes.length !== 1) {
    throw new Error("Unable to determine Permit2 primary type from Trading API response.");
  }

  return primaryTypes[0]!;
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
  const signTypedData = useSignTypedData();

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
    refetchInterval,
  });

  const approvalQuery = useQuery({
    queryKey: tradingKeys.approval({
      walletAddress: swapper,
      tokenIn,
      tokenOut,
      amountIn,
      chainId,
      permit2Disabled,
      urgency,
    }),
    queryFn: async ({ signal }): Promise<TradingApprovalResponse> => {
      if (!swapper) {
        throw new Error("Swapper address is required to check approval.");
      }

      return sdk.checkApproval(
        {
          walletAddress: swapper,
          token: tokenIn,
          amount: amountIn,
          chainId,
          urgency,
          tokenOut,
          tokenOutChainId: chainId,
        },
        { permit2Disabled, signal },
      );
    },
    enabled: approvalEnabled,
  });

  const approvalTransaction = useTransaction({ chainId });
  const swapTransaction = useTransaction({ chainId });

  const permitKey = useMemo(
    () =>
      createPermitKey({
        chainId,
        tokenIn,
        tokenOut,
        amountIn,
        swapper,
        permit2Disabled,
        requestId: quoteQuery.data?.requestId,
      }),
    [amountIn, chainId, permit2Disabled, quoteQuery.data?.requestId, swapper, tokenIn, tokenOut],
  );

  const [signatureState, setSignatureState] = useState<KeyedState<Hex | undefined> | undefined>(undefined);
  const [permitErrorState, setPermitErrorState] = useState<KeyedState<Error> | undefined>(undefined);
  const [pendingPermitKey, setPendingPermitKey] = useState<string | undefined>(undefined);

  const permitSignature = signatureState?.key === permitKey ? signatureState.value : undefined;
  const permitError = permitErrorState?.key === permitKey ? permitErrorState.value : undefined;

  const quote = quoteQuery.data;
  const approval = approvalQuery.data;
  const approvalDecisionPending =
    approvalEnabled && !approvalQuery.error && !approval && (approvalQuery.isLoading || approvalQuery.isFetching);
  const permitRequired = !permit2Disabled && !!quote?.permitData;
  const approvalResetRequired = !approvalDecisionPending && !!approval?.cancel;
  const approvalApproveRequired = !approvalDecisionPending && !!approval?.approval;
  const approvalRequired = approvalResetRequired || approvalApproveRequired;

  const refetchApproval = useCallback(async (): Promise<TradingApprovalResponse | undefined> => {
    const result = await approvalQuery.refetch();
    if (result.error) {
      throw result.error;
    }

    return result.data;
  }, [approvalQuery]);

  const resolveApproval = useCallback(async (): Promise<TradingApprovalResponse | undefined> => {
    if (!approvalEnabled) {
      return undefined;
    }

    if (approval) {
      return approval;
    }

    return refetchApproval();
  }, [approval, approvalEnabled, refetchApproval]);

  const signPermit = useCallback(async (): Promise<Hex | undefined> => {
    if (!permitRequired) {
      setSignatureState({ key: permitKey, value: undefined });
      return undefined;
    }

    if (!quote?.permitData) {
      throw new Error("Permit data not available.");
    }

    assertWalletConnected(connectedAddress);
    if (swapper) {
      assertSameAddress(swapper, connectedAddress);
    }

    try {
      setPermitErrorState(undefined);
      setPendingPermitKey(permitKey);

      const signature = await signTypedData.signTypedDataAsync({
        domain: quote.permitData.domain,
        types: quote.permitData.types,
        primaryType: getPrimaryType(quote.permitData.types),
        message: quote.permitData.values,
      });

      setSignatureState({ key: permitKey, value: signature });
      setPendingPermitKey(undefined);

      return signature;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      setPermitErrorState({ key: permitKey, value: normalized });
      setPendingPermitKey(undefined);
      throw normalized;
    }
  }, [connectedAddress, permitKey, permitRequired, quote?.permitData, signTypedData, swapper]);

  const executeApprovalReset = useCallback(async (): Promise<Hex> => {
    assertWalletConnected(connectedAddress);
    if (swapper) {
      assertSameAddress(swapper, connectedAddress);
    }

    const approvalState = await resolveApproval();
    if (!approvalState?.cancel) {
      throw new Error("Approval reset transaction not available.");
    }

    const { hash } = await approvalTransaction.sendAndConfirm(approvalState.cancel);
    await refetchApproval();
    return hash;
  }, [approvalTransaction, connectedAddress, refetchApproval, resolveApproval, swapper]);

  const executeApproval = useCallback(async (): Promise<Hex> => {
    assertWalletConnected(connectedAddress);
    if (swapper) {
      assertSameAddress(swapper, connectedAddress);
    }

    const approvalState = await resolveApproval();
    if (!approvalState?.approval) {
      throw new Error("Approval transaction not available.");
    }

    const { hash } = await approvalTransaction.sendAndConfirm(approvalState.approval);
    await refetchApproval();
    return hash;
  }, [approvalTransaction, connectedAddress, refetchApproval, resolveApproval, swapper]);

  const executeApprovalFlow = useCallback(async (): Promise<Hex> => {
    let hash: Hex | undefined;
    let approvalState = await resolveApproval();

    if (!approvalState?.cancel && !approvalState?.approval) {
      throw new Error("Approval transaction not available.");
    }

    if (approvalState?.cancel) {
      hash = await executeApprovalReset();
      approvalState = await resolveApproval();
    }

    if (approvalState?.approval) {
      hash = await executeApproval();
    }

    if (!hash) {
      throw new Error("Approval transaction not available.");
    }

    return hash;
  }, [executeApproval, executeApprovalReset, resolveApproval]);

  const executeSwap = useCallback(
    async (signatureOverride?: Hex): Promise<Hex> => {
      assertWalletConnected(connectedAddress);
      if (swapper) {
        assertSameAddress(swapper, connectedAddress);
      }

      if (!quote) {
        throw new Error("Quote not available.");
      }

      const signature = signatureOverride ?? permitSignature;
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
    [connectedAddress, permit2Disabled, permitSignature, quote, sdk, swapTransaction, swapper, urgency],
  );

  const currentStep: TradingStep = (() => {
    if (!quote || quoteQuery.isLoading || approvalDecisionPending || !swapper) {
      return "quote";
    }

    if (approvalResetRequired) {
      return "approval-reset";
    }

    if (approvalApproveRequired) {
      return "approval";
    }

    if (permitRequired && !permitSignature) {
      return "permit2";
    }

    if (swapTransaction.status !== "confirmed") {
      return "swap";
    }

    return "completed";
  })();

  const executeAll = useCallback(async (): Promise<Hex> => {
    const approvalState = await resolveApproval();
    if (approvalState?.cancel || approvalState?.approval) {
      await executeApprovalFlow();
    }

    const signature = permitRequired ? await signPermit() : undefined;
    return executeSwap(signature);
  }, [executeApprovalFlow, executeSwap, permitRequired, resolveApproval, signPermit]);

  const resetPermit = useCallback(() => {
    setSignatureState(undefined);
    setPermitErrorState(undefined);
    setPendingPermitKey(undefined);
  }, []);

  const reset = useCallback(() => {
    approvalTransaction.reset();
    swapTransaction.reset();
    resetPermit();
  }, [approvalTransaction, resetPermit, swapTransaction]);

  const steps: UseTradingSteps = {
    quote: {
      ...quoteQuery,
      data: quote,
      isFetching: quoteQuery.isFetching,
      isLoading: quoteQuery.isLoading,
    } as UseQueryResult<TradingQuoteResponse, Error>,
    approval: {
      isRequired: approvalRequired,
      resetRequired: approvalResetRequired,
      approveRequired: approvalApproveRequired,
      data: approval,
      query: approvalQuery,
      transaction: approvalTransaction,
      executeReset: executeApprovalReset,
      executeApprove: executeApproval,
      execute: executeApprovalFlow,
    },
    permit2: {
      isRequired: permitRequired,
      isPending: pendingPermitKey === permitKey,
      isSigned: !!permitSignature,
      error: permitError,
      signature: permitSignature,
      sign: signPermit,
      reset: resetPermit,
    },
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
