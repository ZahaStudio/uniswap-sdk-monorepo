import { normalizeBigInt, normalizeTransactionRequest, type ApiTransactionRequest } from "../utils/normalize";
import type { CreateTradingSwapParams, CreateTradingSwapResponse } from "../types";

export interface ApiCreateSwapResponse {
  requestId: string;
  swap: ApiTransactionRequest;
  gasFee?: string;
}

export function assertCreateSwapParams(params: CreateTradingSwapParams): void {
  if ((params.signature && !params.permitData) || (!params.signature && params.permitData)) {
    throw new Error("Signature and permitData must be provided together.");
  }
}

export function buildCreateSwapRequest(params: CreateTradingSwapParams) {
  return {
    quote: params.quote,
    signature: params.signature,
    permitData: params.permitData ?? undefined,
    refreshGasPrice: params.refreshGasPrice,
    simulateTransaction: params.simulateTransaction,
    deadline: params.deadline,
    urgency: params.urgency,
  };
}

export function normalizeCreateSwapResponse(response: ApiCreateSwapResponse): CreateTradingSwapResponse {
  const swap = normalizeTransactionRequest(response.swap);
  if (!swap) {
    throw new Error("Trading API returned an empty swap transaction.");
  }

  return {
    requestId: response.requestId,
    swap,
    gasFee: normalizeBigInt(response.gasFee),
  };
}
