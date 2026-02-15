"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { estimateGas } from "@wagmi/core";
import type { Address, Hex, TransactionReceipt } from "viem";
import { useConfig, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";

/**
 * Transaction lifecycle status.
 *
 * - `idle` — No transaction in flight
 * - `pending` — Estimating gas and/or waiting for user wallet signature
 * - `confirming` — Transaction broadcast, waiting for on-chain confirmation
 * - `confirmed` — Transaction confirmed on-chain
 * - `error` — A step in the lifecycle failed
 */
export type TransactionStatus = "idle" | "pending" | "confirming" | "confirmed" | "error";

/**
 * Configuration options for the useTransaction hook.
 */
export interface UseTransactionOptions {
  /** Callback fired when the transaction is confirmed on-chain */
  onSuccess?: (receipt: TransactionReceipt) => void;
  /** Number of block confirmations to wait for (default: 1) */
  confirmations?: number;
}

/**
 * Parameters for sending a transaction.
 */
export interface SendTransactionParams {
  /** Target contract address */
  to: Address;
  /** Encoded calldata */
  data: Hex;
  /** Native value to send (default: 0n) */
  value?: bigint;
}

/**
 * Return type for the useTransaction hook.
 */
export interface UseTransactionReturn {
  /** Wagmi useSendTransaction return */
  send: ReturnType<typeof useSendTransaction>;
  /** Wagmi useWaitForTransactionReceipt return — receipt query */
  receipt: ReturnType<typeof useWaitForTransactionReceipt>;

  /** Current transaction hash (set after broadcast) */
  txHash: Hex | undefined;
  /** Derived lifecycle status */
  status: TransactionStatus;
  /** First error from send or receipt */
  error: Error | undefined;
  /** Send a transaction. Resolves with the tx hash after broadcast. */
  sendTransaction: (params: SendTransactionParams) => Promise<Hex>;
  /**
   * Returns a promise that resolves when the current transaction is confirmed.
   * Useful for chaining steps in a pipeline (e.g. approve → wait → swap).
   */
  waitForConfirmation: () => Promise<TransactionReceipt>;
  /** Reset all state back to idle */
  reset: () => void;
}

/**
 * Generic, reusable hook for managing the lifecycle of a single blockchain
 * transaction. Composes wagmi's `useSendTransaction` and
 * `useWaitForTransactionReceipt` into a unified status model.
 *
 * This hook is SDK-agnostic — it knows nothing about Uniswap. It can be used
 * for any transaction pattern: swaps, approvals, position management, etc.
 *
 * All contract interactions should encode their calldata first and use
 * `sendTransaction` for consistent behavior.
 *
 * @param options - Optional callbacks and confirmation config
 * @returns Transaction lifecycle state and action functions
 *
 * @example
 * ```tsx
 * const tx = useTransaction({
 *   onSuccess: (receipt) => console.log("Confirmed!", receipt.transactionHash),
 * });
 *
 * // Send a transaction with pre-encoded calldata
 * await tx.sendTransaction({ to: "0x...", data: "0x...", value: 0n });
 *
 * // Wait for confirmation in a pipeline
 * const receipt = await tx.waitForConfirmation();
 * ```
 */
export function useTransaction(options: UseTransactionOptions = {}): UseTransactionReturn {
  const { onSuccess, confirmations = 1 } = options;

  const config = useConfig();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const txHashRef = useRef<Hex | undefined>(undefined);
  const [isPreparingTx, setIsPreparingTx] = useState(false);

  // Store onSuccess in a ref so the receipt effect doesn't re-fire
  // when the caller passes an unstable (inline) callback.
  const onSuccessRef = useRef(onSuccess);

  // Ref-based promise resolver for waitForConfirmation()
  const confirmResolverRef = useRef<{
    resolve: (receipt: TransactionReceipt) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const send = useSendTransaction();

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations,
    query: {
      enabled: !!txHash,
    },
  });

  useEffect(() => {
    if (receipt.data) {
      onSuccessRef.current?.(receipt.data);
      if (confirmResolverRef.current) {
        confirmResolverRef.current.resolve(receipt.data);
        confirmResolverRef.current = null;
      }
    }
  }, [receipt.data]);

  useEffect(() => {
    if (receipt.error) {
      if (confirmResolverRef.current) {
        confirmResolverRef.current.reject(receipt.error);
        confirmResolverRef.current = null;
      }
    }
  }, [receipt.error]);

  const error = send.error ?? receipt.error ?? undefined;

  const status: TransactionStatus = (() => {
    if (error) return "error";
    if (receipt.isSuccess) return "confirmed";
    if (txHash && receipt.isLoading) return "confirming";
    if (send.isPending || isPreparingTx) return "pending";
    return "idle";
  })();

  const sendTransaction = useCallback(
    async (params: SendTransactionParams): Promise<Hex> => {
      const value = params.value ?? 0n;

      setIsPreparingTx(true);
      let gasLimit: bigint;
      try {
        const estimated = await estimateGas(config, {
          to: params.to,
          data: params.data,
          value,
        });
        gasLimit = estimated * 2n;
      } finally {
        setIsPreparingTx(false);
      }

      const hash = await send.sendTransactionAsync({
        to: params.to,
        data: params.data,
        value,
        gas: gasLimit,
      });
      txHashRef.current = hash;
      setTxHash(hash);
      return hash;
    },
    [send, config],
  );

  const waitForConfirmation = useCallback((): Promise<TransactionReceipt> => {
    // If already confirmed, resolve immediately
    if (receipt.data) return Promise.resolve(receipt.data);

    // If no tx in flight, reject
    if (!txHashRef.current) return Promise.reject(new Error("No transaction to wait for"));

    // Create a promise that will be resolved by the receipt effect
    return new Promise<TransactionReceipt>((resolve, reject) => {
      confirmResolverRef.current = { resolve, reject };
    });
  }, [receipt.data]);

  const reset = useCallback(() => {
    txHashRef.current = undefined;
    setTxHash(undefined);
    send.reset();
    confirmResolverRef.current = null;
  }, [send]);

  return {
    // Wagmi hook instances
    send,
    receipt,

    // Derived state
    txHash,
    status,
    error,

    // Actions
    sendTransaction,
    waitForConfirmation,
    reset,
  };
}
