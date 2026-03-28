"use client";

import { useCallback, useState } from "react";

import type { NormalizedTransactionRequest } from "@zahastudio/trading-sdk";
import type { Hex, TransactionReceipt } from "viem";
import { usePublicClient, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";

export type TransactionStatus = "idle" | "pending" | "confirming" | "confirmed" | "error";

export interface UseTransactionOptions {
  confirmations?: number;
  chainId?: number;
}

export interface UseTransactionReturn {
  txHash: Hex | undefined;
  receipt: TransactionReceipt | undefined;
  status: TransactionStatus;
  error: Error | undefined;
  sendTransaction: (params: NormalizedTransactionRequest) => Promise<Hex>;
  sendAndConfirm: (params: NormalizedTransactionRequest) => Promise<{ hash: Hex; receipt: TransactionReceipt }>;
  reset: () => void;
}

export function useTransaction(options: UseTransactionOptions = {}): UseTransactionReturn {
  const { confirmations = 1, chainId } = options;

  const publicClient = usePublicClient({ chainId });
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const send = useSendTransaction();

  const receiptQuery = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
    confirmations,
    query: {
      enabled: !!txHash,
    },
  });

  const error = send.error ?? receiptQuery.error ?? undefined;

  const status: TransactionStatus = (() => {
    if (error) return "error";
    if (receiptQuery.isSuccess) return "confirmed";
    if (txHash && receiptQuery.isLoading) return "confirming";
    if (send.isPending) return "pending";
    return "idle";
  })();

  const sendTransaction = useCallback(
    async (params: NormalizedTransactionRequest): Promise<Hex> => {
      const hash = await send.sendTransactionAsync({
        to: params.to,
        data: params.data,
        value: params.value,
        gas: params.gasLimit,
        gasPrice: params.gasPrice,
        maxFeePerGas: params.maxFeePerGas,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas,
        chainId: params.chainId ?? chainId,
      });

      setTxHash(hash);
      return hash;
    },
    [chainId, send],
  );

  const sendAndConfirm = useCallback(
    async (params: NormalizedTransactionRequest): Promise<{ hash: Hex; receipt: TransactionReceipt }> => {
      if (!publicClient) {
        throw new Error(`No public client available for chain ID ${params.chainId ?? chainId}.`);
      }

      const hash = await sendTransaction(params);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations,
      });

      return { hash, receipt };
    },
    [chainId, confirmations, publicClient, sendTransaction],
  );

  const reset = useCallback(() => {
    setTxHash(undefined);
    send.reset();
  }, [send]);

  return {
    txHash,
    receipt: receiptQuery.data,
    status,
    error,
    sendTransaction,
    sendAndConfirm,
    reset,
  };
}
