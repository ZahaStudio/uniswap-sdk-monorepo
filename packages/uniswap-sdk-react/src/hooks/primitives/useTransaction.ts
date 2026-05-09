"use client";

import { useCallback, useState } from "react";

import type { Address, Hex, TransactionReceipt } from "viem";
import type { GetCallsStatusReturnType, SendCallsReturnType } from "viem/actions";

import { isAtomicBatchSupported, type WalletBatchCall, type WalletCapabilities } from "@zahastudio/uniswap-sdk";
import { AtomicityNotSupportedError } from "viem";
import {
  useAccount,
  useCapabilities,
  usePublicClient,
  useSendCalls,
  useSendTransaction,
  useWaitForCallsStatus,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";

/**
 * Transaction lifecycle status.
 *
 * - `idle` — No transaction in flight
 * - `pending` — Waiting for user wallet signature
 * - `confirming` — Transaction or call batch submitted, waiting for confirmation/status
 * - `confirmed` — Transaction or call batch confirmed
 * - `error` — A step in the lifecycle failed
 */
export type TransactionStatus = "idle" | "pending" | "confirming" | "confirmed" | "error";

/**
 * Configuration options for the useTransaction hook.
 */
export interface UseTransactionOptions {
  /** Number of block confirmations to wait for single transactions (default: 1) */
  confirmations?: number;
  /** Optional chain override applied to transaction lifecycle calls */
  chainId?: number;
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

export interface SendBatchTransactionParams {
  /** Ordered calls to submit through wallet_sendCalls. */
  calls: readonly WalletBatchCall[];
  /** Optional EIP-5792 capabilities to pass through to the wallet. */
  capabilities?: WalletCapabilities;
}

export type SendBatchTransactionAndConfirmParams = SendBatchTransactionParams;

export type SendBatchTransactionResult = SendCallsReturnType;

export interface SendBatchTransactionAndConfirmResult {
  /** EIP-5792 call batch identifier. */
  id: string;
  /** Final status returned by wallet_getCallsStatus. */
  status: GetCallsStatusReturnType;
}

/**
 * Return type for the useTransaction hook.
 */
export interface UseTransactionReturn {
  /** Current transaction hash (set after single transaction broadcast) */
  txHash: Hex | undefined;
  /** Receipt for the most recently sent single transaction when confirmed */
  receipt: TransactionReceipt | undefined;
  /** Last EIP-5792 call batch identifier */
  batchId: string | undefined;
  /** Last wallet_getCallsStatus result returned by sendBatchTransactionAndConfirm */
  callsStatus: GetCallsStatusReturnType | undefined;
  /** Derived lifecycle status */
  status: TransactionStatus;
  /** Whether the current wallet reports atomic batching as supported or ready. Defaults to false while loading. */
  isAtomicBatchSupported: boolean;
  /** First error from send, receipt, capabilities, or call batch status */
  error: Error | undefined;
  /** Send a single transaction. Resolves with the tx hash after broadcast. */
  sendTransaction: (params: SendTransactionParams) => Promise<Hex>;
  /** Send a single transaction and wait for confirmation. */
  sendTransactionAndConfirm: (params: SendTransactionParams) => Promise<{ hash: Hex; receipt: TransactionReceipt }>;
  /** Submit an atomic EIP-5792 call batch. Resolves with the batch id after wallet acceptance. */
  sendBatchTransaction: (params: SendBatchTransactionParams) => Promise<SendBatchTransactionResult>;
  /** Submit an atomic EIP-5792 call batch and wait for wallet_getCallsStatus. */
  sendBatchTransactionAndConfirm: (
    params: SendBatchTransactionAndConfirmParams,
  ) => Promise<SendBatchTransactionAndConfirmResult>;
  /** Reset all state back to idle */
  reset: () => void;
}

/**
 * Generic, reusable hook for managing single-transaction and EIP-5792 call-batch lifecycles.
 *
 * Single transaction methods use wagmi's `useSendTransaction` and `useWaitForTransactionReceipt`.
 * Batch methods use EIP-5792 wallet calls with `forceAtomic: true` after checking the wallet's
 * atomic capability (`supported` or `ready`).
 *
 * @param options - Optional confirmation config
 * @returns Transaction lifecycle state and action functions
 *
 * @example
 * ```tsx
 * const tx = useTransaction();
 *
 * const hash = await tx.sendTransaction({ to: "0x...", data: "0x...", value: 0n });
 * const { receipt } = await tx.sendTransactionAndConfirm({ to: "0x...", data: "0x...", value: 0n });
 * const batch = await tx.sendBatchTransactionAndConfirm({ calls: [{ to: "0x...", data: "0x..." }] });
 * ```
 */
export function useTransaction(options: UseTransactionOptions = {}): UseTransactionReturn {
  const { confirmations = 1, chainId } = options;

  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const { address: connectedAddress } = useAccount();

  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);
  const [pendingBatchId, setPendingBatchId] = useState<string | undefined>(undefined);

  const send = useSendTransaction();
  const sendCalls = useSendCalls();

  const capabilities = useCapabilities({
    account: connectedAddress,
    chainId,
    query: {
      enabled: !!connectedAddress && chainId !== undefined,
    },
  });

  const receiptQuery = useWaitForTransactionReceipt({
    hash: txHash,
    chainId,
    confirmations,
    query: {
      enabled: !!txHash,
    },
  });

  const callsStatusQuery = useWaitForCallsStatus({
    id: pendingBatchId,
    query: {
      enabled: !!pendingBatchId,
    },
  });

  const callsStatus = callsStatusQuery.data;
  const atomicBatchSupported = isAtomicBatchSupported(capabilities.data, chainId) ?? false;
  const error =
    send.error ?? receiptQuery.error ?? sendCalls.error ?? callsStatusQuery.error ?? capabilities.error ?? undefined;

  const status: TransactionStatus = (() => {
    if (error || callsStatus?.status === "failure") return "error";
    if (send.isPending || sendCalls.isPending) return "pending";
    if (receiptQuery.isSuccess || callsStatus?.status === "success") return "confirmed";
    if ((txHash && receiptQuery.isLoading) || (pendingBatchId && (callsStatusQuery.isLoading || !callsStatus))) {
      return "confirming";
    }
    return "idle";
  })();

  const sendTransaction = useCallback(
    async (params: SendTransactionParams): Promise<Hex> => {
      if (!publicClient) {
        throw new Error(`No public client available for chain ID ${chainId}`);
      }

      const value = params.value ?? 0n;

      const estimated = await publicClient.estimateGas({
        to: params.to,
        data: params.data,
        value,
        account: connectedAddress,
      });
      const gasLimit = estimated * 2n;

      const hash = await send.sendTransactionAsync({
        to: params.to,
        data: params.data,
        value,
        gas: gasLimit,
        chainId,
      });
      setTxHash(hash);
      return hash;
    },
    [publicClient, connectedAddress, send, chainId],
  );

  const sendTransactionAndConfirm = useCallback(
    async (params: SendTransactionParams): Promise<{ hash: Hex; receipt: TransactionReceipt }> => {
      if (!publicClient) {
        throw new Error(`No public client available for chain ID ${chainId}`);
      }

      const hash = await sendTransaction(params);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations,
      });

      return {
        hash,
        receipt,
      };
    },
    [sendTransaction, publicClient, confirmations, chainId],
  );

  const sendBatchTransaction = useCallback(
    async ({ calls, capabilities: requestCapabilities }: SendBatchTransactionParams) => {
      if (!connectedAddress) {
        throw new Error("Wallet not connected");
      }
      if (chainId === undefined) {
        throw new Error("No chain ID available for batched wallet calls");
      }
      if (!atomicBatchSupported) {
        throw new AtomicityNotSupportedError(
          new Error(`Wallet atomic batching is not available for chain ${chainId}.`),
        );
      }

      setPendingBatchId(undefined);
      // sendCalls.reset();

      const result = await sendCalls.sendCallsAsync({
        account: connectedAddress,
        chainId,
        calls,
        capabilities: requestCapabilities,
        forceAtomic: true,
        version: "2.0.0",
      });

      setPendingBatchId(result.id);
      return result;
    },
    [chainId, connectedAddress, atomicBatchSupported, sendCalls],
  );

  const sendBatchTransactionAndConfirm = useCallback(
    async (params: SendBatchTransactionAndConfirmParams) => {
      if (!walletClient) {
        throw new Error(`No wallet client available for chain ID ${chainId}`);
      }

      const result = await sendBatchTransaction(params);
      const status = await walletClient.waitForCallsStatus({
        id: result.id,
      });

      return {
        id: result.id,
        status,
      };
    },
    [sendBatchTransaction, walletClient, chainId],
  );

  const reset = useCallback(() => {
    setTxHash(undefined);
    setPendingBatchId(undefined);
    send.reset();
    sendCalls.reset();
  }, [send, sendCalls]);

  return {
    txHash,
    receipt: receiptQuery.data,
    batchId: pendingBatchId,
    callsStatus,
    status,
    isAtomicBatchSupported: atomicBatchSupported,
    error,
    sendTransaction,
    sendTransactionAndConfirm,
    sendBatchTransaction,
    sendBatchTransactionAndConfirm,
    reset,
  };
}
