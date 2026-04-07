import type { TradingApprovalParams, TradingApprovalResponse } from "../types";

import { toAmountString } from "../utils/amounts";
import { normalizeBigInt, normalizeTransactionRequest, type ApiTransactionRequest } from "../utils/normalize";

export interface ApiApprovalResponse {
  requestId: string;
  approval?: ApiTransactionRequest | null;
  cancel?: ApiTransactionRequest | null;
  gasFee?: string;
  cancelGasFee?: string;
}

export function buildApprovalRequest(params: TradingApprovalParams) {
  return {
    walletAddress: params.walletAddress,
    token: params.token,
    amount: toAmountString(params.amount),
    chainId: params.chainId,
    urgency: params.urgency,
    tokenOut: params.tokenOut,
    tokenOutChainId: params.tokenOutChainId ?? (params.tokenOut ? params.chainId : undefined),
  };
}

export function normalizeApprovalResponse(response: ApiApprovalResponse): TradingApprovalResponse {
  return {
    requestId: response.requestId,
    approval: normalizeTransactionRequest(response.approval),
    cancel: normalizeTransactionRequest(response.cancel),
    gasFee: normalizeBigInt(response.gasFee),
    cancelGasFee: normalizeBigInt(response.cancelGasFee),
  };
}
