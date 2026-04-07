import type { Address } from "viem";

import type { NormalizedTransactionRequest } from "../utils/normalize";
import type { Urgency } from "./common";

export interface TradingApprovalParams {
  walletAddress: Address;
  token: Address;
  amount: bigint | string;
  chainId: number;
  urgency?: Urgency;
  tokenOut?: Address;
  tokenOutChainId?: number;
}

export interface TradingApprovalResponse {
  requestId: string;
  approval: NormalizedTransactionRequest | null;
  cancel: NormalizedTransactionRequest | null;
  gasFee?: bigint;
  cancelGasFee?: bigint;
}
