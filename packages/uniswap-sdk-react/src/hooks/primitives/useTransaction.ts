"use client";

import { useCallback, useState } from "react";

import type { Address, Hex, TransactionReceipt } from "viem";
import type { GetCallsStatusReturnType, SendCallsReturnType } from "viem/actions";

import {
  isAtomicBatchSupported as resolveAtomicBatchSupported,
  type WalletBatchCall,
  type WalletCapabilities,
} from "@zahastudio/uniswap-sdk";
import { AtomicityNotSupportedError } from "viem";
import {
  useAccount,
  useCapabilities,
  usePublicClient,
  useSendCalls,
  useSendCallsSync,
  useSendTransaction,
  useWaitForTransactionReceipt,
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
  /** Optional caller-provided EIP-5792 batch ID. */
  id?: string;
}

export interface SendBatchTransactionAndConfirmParams extends SendBatchTransactionParams {
  /** Timeout in milliseconds while waiting for wallet_getCallsStatus. */
  timeout?: number;
  /** Polling interval in milliseconds while waiting for wallet_getCallsStatus. */
  pollingInterval?: number;
}

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
  const { address: connectedAddress } = useAccount();
  const [txHash, setTxHash] = useState<Hex | undefined>(undefined);

  const send = useSendTransaction();
  const sendCalls = useSendCalls();
  const sendCallsSync = useSendCallsSync();
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

  const callsStatus = sendCallsSync.data;
  const batchId = callsStatus?.id ?? sendCalls.data?.id;
  const isAtomicBatchSupported =
    capabilities.data && chainId !== undefined ? resolveAtomicBatchSupported(capabilities.data, chainId) : false;
  const error =
    send.error ?? receiptQuery.error ?? sendCalls.error ?? sendCallsSync.error ?? capabilities.error ?? undefined;

  const status: TransactionStatus = (() => {
    if (error || callsStatus?.status === "failure") return "error";
    if (send.isPending || sendCalls.isPending || sendCallsSync.isPending) return "pending";
    if (receiptQuery.isSuccess || callsStatus?.status === "success") return "confirmed";
    if ((txHash && receiptQuery.isLoading) || (sendCalls.data?.id && !callsStatus)) return "confirming";
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
      return { hash, receipt };
    },
    [sendTransaction, publicClient, confirmations, chainId],
  );

  const sendBatchTransaction = useCallback(
    async ({ calls, capabilities: requestCapabilities, id }: SendBatchTransactionParams) => {
      if (!connectedAddress) {
        throw new Error("Wallet not connected");
      }
      if (chainId === undefined) {
        throw new Error("No chain ID available for batched wallet calls");
      }
      if (!isAtomicBatchSupported) {
        throw new AtomicityNotSupportedError(
          new Error(`Wallet atomic batching is not available for chain ${chainId}.`),
        );
      }

      return sendCalls.sendCallsAsync({
        account: connectedAddress,
        chainId,
        calls,
        capabilities: requestCapabilities,
        forceAtomic: true,
        id,
        version: "2.0.0",
      });
    },
    [chainId, connectedAddress, isAtomicBatchSupported, sendCalls],
  );

  const sendBatchTransactionAndConfirm = useCallback(
    async ({
      calls,
      capabilities: requestCapabilities,
      id,
      timeout,
      pollingInterval,
    }: SendBatchTransactionAndConfirmParams) => {
      if (!connectedAddress) {
        throw new Error("Wallet not connected");
      }
      if (chainId === undefined) {
        throw new Error("No chain ID available for batched wallet calls");
      }
      if (!isAtomicBatchSupported) {
        throw new AtomicityNotSupportedError(
          new Error(`Wallet atomic batching is not available for chain ${chainId}.`),
        );
      }

      const result = await sendCallsSync.sendCallsSyncAsync({
        account: connectedAddress,
        chainId,
        calls,
        capabilities: requestCapabilities,
        forceAtomic: true,
        id,
        version: "2.0.0",
        timeout,
        pollingInterval,
      });

      return {
        id: result.id,
        status: result,
      };
    },
    [chainId, connectedAddress, isAtomicBatchSupported, sendCallsSync],
  );

  const reset = useCallback(() => {
    setTxHash(undefined);
    send.reset();
    sendCalls.reset();
    sendCallsSync.reset();
  }, [send, sendCalls, sendCallsSync]);

  return {
    txHash,
    receipt: receiptQuery.data,
    batchId,
    callsStatus,
    status,
    isAtomicBatchSupported,
    error,
    sendTransaction,
    sendTransactionAndConfirm,
    sendBatchTransaction,
    sendBatchTransactionAndConfirm,
    reset,
  };
}
