"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Abi, Address, Hex, TransactionReceipt } from "viem";
import { useSendTransaction, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

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
  /** Callback fired when the transaction is confirmed on-chain */
  onSuccess?: (receipt: TransactionReceipt) => void;
  /** Number of block confirmations to wait for (default: 1) */
  confirmations?: number;
}

/**
 * Parameters for sending a raw transaction.
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
 * Parameters for a typed contract write.
 */
export interface WriteContractParams<TAbi extends Abi = Abi> {
  /** Contract address */
  address: Address;
  /** Contract ABI */
  abi: TAbi;
  /** Function to call */
  functionName: string;
  /** Function arguments */
  args?: readonly unknown[];
  /** Native value to send */
  value?: bigint;
}

/**
 * Return type for the useTransaction hook.
 */
export interface UseTransactionReturn {
  // ── Wagmi hook instances (exposed directly) ───────────────────────────
  /** Wagmi useSendTransaction return — use for raw tx sends */
  send: ReturnType<typeof useSendTransaction>;
  /** Wagmi useWriteContract return — use for typed contract writes */
  write: ReturnType<typeof useWriteContract>;
  /** Wagmi useWaitForTransactionReceipt return — receipt query */
  receipt: ReturnType<typeof useWaitForTransactionReceipt>;

  // ── Derived state ─────────────────────────────────────────────────────
  /** Current transaction hash (set after broadcast) */
  txHash: Hex | undefined;
  /** Derived lifecycle status */
  status: TransactionStatus;
  /** First error from send, write, or receipt */
  error: Error | undefined;

  // ── Convenience flags ─────────────────────────────────────────────────
  isIdle: boolean;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  isError: boolean;

  // ── Actions ───────────────────────────────────────────────────────────
  /** Send a raw transaction. Resolves with the tx hash after broadcast. */
  sendTransaction: (params: SendTransactionParams) => Promise<Hex>;
  /** Send a typed contract write. Resolves with the tx hash after broadcast. */
  writeContract: (params: WriteContractParams) => Promise<Hex>;
  /**
   * Returns a promise that resolves when the current transaction is confirmed.
   * Useful for chaining steps in a pipeline (e.g. approve → wait → swap).
   */
  waitForConfirmation: () => Promise<TransactionReceipt>;
  /** Reset all state back to idle */
  reset: () => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generic, reusable hook for managing the lifecycle of a single blockchain
 * transaction. Composes wagmi's `useSendTransaction`, `useWriteContract`, and
 * `useWaitForTransactionReceipt` into a unified status model.
 *
 * This hook is SDK-agnostic — it knows nothing about Uniswap. It can be used
 * for any transaction pattern: swaps, approvals, position management, etc.
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
 * // Raw send
 * await tx.sendTransaction({ to: "0x...", data: "0x...", value: 0n });
 *
 * // Contract write
 * await tx.writeContract({ address: "0x...", abi: erc20Abi, functionName: "approve", args: [...] });
 *
 * // Wait for confirmation in a pipeline
 * const receipt = await tx.waitForConfirmation();
 * ```
 */
export function useTransaction(options: UseTransactionOptions = {}): UseTransactionReturn {
  const { onSuccess, confirmations = 1 } = options;

  // ── Local state ─────────────────────────────────────────────────────────
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);

  // Ref-based promise resolver for waitForConfirmation()
  const confirmResolverRef = useRef<{
    resolve: (receipt: TransactionReceipt) => void;
    reject: (err: Error) => void;
  } | null>(null);

  // ── Wagmi hooks ─────────────────────────────────────────────────────────
  const send = useSendTransaction();
  const write = useWriteContract();

  const receipt = useWaitForTransactionReceipt({
    hash: txHash,
    confirmations,
    query: {
      enabled: !!txHash,
    },
  });

  // ── Fire callbacks when receipt arrives ─────────────────────────────────
  useEffect(() => {
    if (receipt.data) {
      onSuccess?.(receipt.data);
      if (confirmResolverRef.current) {
        confirmResolverRef.current.resolve(receipt.data);
        confirmResolverRef.current = null;
      }
    }
  }, [receipt.data, onSuccess]);

  // ── Fire rejection when receipt errors ──────────────────────────────────
  useEffect(() => {
    if (receipt.error) {
      if (confirmResolverRef.current) {
        confirmResolverRef.current.reject(receipt.error);
        confirmResolverRef.current = null;
      }
    }
  }, [receipt.error]);

  // ── Derive status ───────────────────────────────────────────────────────
  const error = send.error ?? write.error ?? receipt.error ?? undefined;

  const status: TransactionStatus = (() => {
    if (error) return "error";
    if (receipt.isSuccess) return "confirmed";
    if (txHash && receipt.isLoading) return "confirming";
    if (send.isPending || write.isPending) return "pending";
    return "idle";
  })();

  // ── Actions ─────────────────────────────────────────────────────────────
  const sendTransaction = useCallback(
    async (params: SendTransactionParams): Promise<Hex> => {
      const hash = await send.sendTransactionAsync({
        to: params.to,
        data: params.data,
        value: params.value ?? 0n,
      });
      setTxHash(hash);
      return hash;
    },
    [send],
  );

  const writeContractFn = useCallback(
    async (params: WriteContractParams): Promise<Hex> => {
      const hash = await write.writeContractAsync({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args as unknown[],
        value: params.value,
      });
      setTxHash(hash);
      return hash;
    },
    [write],
  );

  const waitForConfirmation = useCallback((): Promise<TransactionReceipt> => {
    // If already confirmed, resolve immediately
    if (receipt.data) return Promise.resolve(receipt.data);

    // If no tx in flight, reject
    if (!txHash) return Promise.reject(new Error("No transaction to wait for"));

    // Create a promise that will be resolved by the receipt effect
    return new Promise<TransactionReceipt>((resolve, reject) => {
      confirmResolverRef.current = { resolve, reject };
    });
  }, [receipt.data, txHash]);

  const reset = useCallback(() => {
    setTxHash(undefined);
    send.reset();
    write.reset();
    confirmResolverRef.current = null;
  }, [send, write]);

  return {
    // Wagmi hook instances
    send,
    write,
    receipt,

    // Derived state
    txHash,
    status,
    error,

    // Convenience flags
    isIdle: status === "idle",
    isPending: status === "pending",
    isConfirming: status === "confirming",
    isConfirmed: status === "confirmed",
    isError: status === "error",

    // Actions
    sendTransaction,
    writeContract: writeContractFn,
    waitForConfirmation,
    reset,
  };
}
