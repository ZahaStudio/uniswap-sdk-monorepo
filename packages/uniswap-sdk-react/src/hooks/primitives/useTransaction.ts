"use client";

import { useCallback, useState } from "react";

import { estimateGas, waitForTransactionReceipt } from "@wagmi/core";
import type { Address, Hex, TransactionReceipt } from "viem";
import { useConfig, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";

/**
 * Transaction lifecycle status.
 *
 * - `idle` — No transaction in flight
 * - `pending` — Waiting for user wallet signature
 * - `confirming` — Transaction broadcast, waiting for on-chain confirmation
 * - `confirmed` — Transaction confirmed on-chain
 * - `error` — A step in the lifecycle failed
 */
export type TransactionStatus = "idle" | "pending" | "confirming" | "confirmed" | "error";

/**
 * Configuration options for the useTransaction hook.
 */
export interface UseTransactionOptions {
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
  /** Current transaction hash (set after broadcast) */
  txHash: Hex | undefined;
  /** Receipt for the most recently sent transaction when confirmed */
  receipt: TransactionReceipt | undefined;
  /** Derived lifecycle status */
  status: TransactionStatus;
  /** First error from send or receipt */
  error: Error | undefined;
  /** Send a transaction. Resolves with the tx hash after broadcast. */
  sendTransaction: (params: SendTransactionParams) => Promise<Hex>;
  /** Send a transaction and wait for confirmation. */
  sendAndConfirm: (params: SendTransactionParams) => Promise<{ hash: Hex; receipt: TransactionReceipt }>;
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
 * @param options - Optional confirmation config
 * @returns Transaction lifecycle state and action functions
 *
 * @example
 * ```tsx
 * const tx = useTransaction();
 *
 * // Send a transaction with pre-encoded calldata
 * const hash = await tx.sendTransaction({ to: "0x...", data: "0x...", value: 0n });
 *
 * // Send and await confirmation in one call
 * const { receipt } = await tx.sendAndConfirm({ to: "0x...", data: "0x...", value: 0n });
 * ```
 */
export function useTransaction(options: UseTransactionOptions = {}): UseTransactionReturn {
  const { confirmations = 1 } = options;

  const config = useConfig();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);

  const send = useSendTransaction();

  const receiptQuery = useWaitForTransactionReceipt({
    hash: txHash,
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
    async (params: SendTransactionParams): Promise<Hex> => {
      const value = params.value ?? 0n;

      const estimated = await estimateGas(config, {
        to: params.to,
        data: params.data,
        value,
      });
      const gasLimit = estimated * 2n;

      const hash = await send.sendTransactionAsync({
        to: params.to,
        data: params.data,
        value,
        gas: gasLimit,
      });
      setTxHash(hash);
      return hash;
    },
    [send, config],
  );

  const sendAndConfirm = useCallback(
    async (params: SendTransactionParams): Promise<{ hash: Hex; receipt: TransactionReceipt }> => {
      const hash = await sendTransaction(params);
      const receipt = await waitForTransactionReceipt(config, {
        hash,
        confirmations,
      });
      return { hash, receipt };
    },
    [sendTransaction, config, confirmations],
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
