import type { Address, Hex } from "viem";

export interface ApiTransactionRequest {
  to: Address;
  from?: Address;
  data: Hex;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

export interface NormalizedTransactionRequest {
  to: Address;
  from?: Address;
  data: Hex;
  value: bigint;
  chainId: number;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gasPrice?: bigint;
}

export function normalizeBigInt(value: bigint | number | string | null | undefined): bigint | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return typeof value === "bigint" ? value : BigInt(value);
}

export function normalizeTransactionRequest(
  transaction: ApiTransactionRequest | null | undefined,
): NormalizedTransactionRequest | null {
  if (!transaction) {
    return null;
  }

  return {
    to: transaction.to,
    from: transaction.from,
    data: transaction.data,
    value: BigInt(transaction.value),
    chainId: transaction.chainId,
    gasLimit: normalizeBigInt(transaction.gasLimit),
    maxFeePerGas: normalizeBigInt(transaction.maxFeePerGas),
    maxPriorityFeePerGas: normalizeBigInt(transaction.maxPriorityFeePerGas),
    gasPrice: normalizeBigInt(transaction.gasPrice),
  };
}
