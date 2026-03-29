"use client";

import { useCallback } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { TradingApprovalResponse, TradingSDK, Urgency } from "@zahastudio/trading-sdk";
import type { Address, Hex } from "viem";

import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { assertConnectedSwapper } from "@/utils";
import { tradingKeys } from "@/utils";

export interface UseTradingApprovalParams {
  sdk: TradingSDK;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  swapper?: Address;
  chainId: number;
  connectedAddress?: Address;
  permit2Disabled: boolean;
  urgency?: Urgency;
  enabled?: boolean;
}

export interface UseTradingApprovalSubstep {
  isRequired: boolean;
  data: TradingApprovalResponse | undefined;
  query: UseQueryResult<TradingApprovalResponse, Error>;
  transaction: UseTransactionReturn;
  execute: () => Promise<Hex>;
}

export interface UseTradingApprovalReturn {
  isRequired: boolean;
  isDecisionPending: boolean;
  data: TradingApprovalResponse | undefined;
  query: UseQueryResult<TradingApprovalResponse, Error>;
  approvalReset: UseTradingApprovalSubstep;
  approval: UseTradingApprovalSubstep;
  execute: () => Promise<Hex>;
  resolve: () => Promise<TradingApprovalResponse | undefined>;
}

export type UseTradingApprovalState = UseTradingApprovalReturn;

export function useTradingApproval({
  sdk,
  tokenIn,
  tokenOut,
  amountIn,
  swapper,
  chainId,
  connectedAddress,
  permit2Disabled,
  urgency,
  enabled = true,
}: UseTradingApprovalParams): UseTradingApprovalReturn {
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
    enabled,
  });

  const resetTransaction = useTransaction({ chainId });
  const approvalTransaction = useTransaction({ chainId });
  const approval = approvalQuery.data;
  const isDecisionPending =
    enabled && !approvalQuery.error && !approval && (approvalQuery.isLoading || approvalQuery.isFetching);
  const resetRequired = !isDecisionPending && !!approval?.cancel;
  const approveRequired = !isDecisionPending && !!approval?.approval;
  const isRequired = resetRequired || approveRequired;

  const refetchApproval = useCallback(async (): Promise<TradingApprovalResponse | undefined> => {
    const result = await approvalQuery.refetch();
    if (result.error) {
      throw result.error;
    }

    return result.data;
  }, [approvalQuery]);

  const resolveApproval = useCallback(async (): Promise<TradingApprovalResponse | undefined> => {
    if (!enabled) {
      return undefined;
    }

    if (approval) {
      return approval;
    }

    return refetchApproval();
  }, [approval, enabled, refetchApproval]);

  const executeReset = useCallback(async (): Promise<Hex> => {
    assertConnectedSwapper(swapper, connectedAddress);

    const approvalState = await resolveApproval();
    if (!approvalState?.cancel) {
      throw new Error("Approval reset transaction not available.");
    }

    const { hash } = await resetTransaction.sendAndConfirm(approvalState.cancel);
    await refetchApproval();
    return hash;
  }, [connectedAddress, refetchApproval, resetTransaction, resolveApproval, swapper]);

  const executeApprove = useCallback(async (): Promise<Hex> => {
    assertConnectedSwapper(swapper, connectedAddress);

    const approvalState = await resolveApproval();
    if (!approvalState?.approval) {
      throw new Error("Approval transaction not available.");
    }

    const { hash } = await approvalTransaction.sendAndConfirm(approvalState.approval);
    await refetchApproval();
    return hash;
  }, [approvalTransaction, connectedAddress, refetchApproval, resolveApproval, swapper]);

  const execute = useCallback(async (): Promise<Hex> => {
    let hash: Hex | undefined;
    let approvalState = await resolveApproval();

    if (!approvalState?.cancel && !approvalState?.approval) {
      throw new Error("Approval transaction not available.");
    }

    if (approvalState.cancel) {
      hash = await executeReset();
      approvalState = await resolveApproval();
    }

    if (approvalState?.approval) {
      hash = await executeApprove();
    }

    if (!hash) {
      throw new Error("Approval transaction not available.");
    }

    return hash;
  }, [executeApprove, executeReset, resolveApproval]);

  return {
    isRequired,
    isDecisionPending,
    data: approval,
    query: approvalQuery,
    approvalReset: {
      isRequired: resetRequired,
      data: approval,
      query: approvalQuery,
      transaction: resetTransaction,
      execute: executeReset,
    },
    approval: {
      isRequired: approveRequired,
      data: approval,
      query: approvalQuery,
      transaction: approvalTransaction,
      execute: executeApprove,
    },
    execute,
    resolve: resolveApproval,
  };
}
