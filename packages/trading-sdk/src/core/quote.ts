import type {
  TradingQuoteParams,
  TradingQuoteResponse,
  TradingRouting,
  TradingPermitData,
  TradingQuote,
} from "../types";

import { toAmountString } from "../utils/amounts";
import { normalizeBigInt, normalizeTransactionRequest, type ApiTransactionRequest } from "../utils/normalize";
import { DEFAULT_AUTO_SLIPPAGE, DEFAULT_PROTOCOLS, DEFAULT_ROUTING_PREFERENCE, SUPPORTED_ROUTINGS } from "./constants";

export interface ApiQuoteResponse {
  requestId: string;
  quote: TradingQuote;
  routing: string;
  permitTransaction?: ApiTransactionRequest | null;
  permitData: TradingPermitData | null;
  permitGasFee?: string;
}

function assertSupportedRouting(routing: string): asserts routing is TradingRouting {
  if (!SUPPORTED_ROUTINGS.includes(routing as TradingRouting)) {
    throw new Error(`Unsupported quote routing "${routing}". Trading SDK v1 supports CLASSIC, WRAP, and UNWRAP only.`);
  }
}

export function assertQuoteParams(params: TradingQuoteParams): void {
  if (params.type !== "EXACT_INPUT") {
    throw new Error(`Unsupported trade type "${params.type}". Trading SDK v1 only supports EXACT_INPUT.`);
  }

  if (params.slippageTolerance !== undefined && params.autoSlippage !== undefined) {
    throw new Error("Specify either slippageTolerance or autoSlippage, not both.");
  }

  if (params.autoSlippage !== undefined && params.autoSlippage !== DEFAULT_AUTO_SLIPPAGE) {
    throw new Error(`Unsupported auto slippage "${params.autoSlippage}". Trading SDK v1 only supports DEFAULT.`);
  }

  if (params.routingPreference !== undefined && params.routingPreference !== DEFAULT_ROUTING_PREFERENCE) {
    throw new Error(
      `Unsupported routing preference "${params.routingPreference}". Trading SDK v1 only supports BEST_PRICE.`,
    );
  }
}

export function buildQuoteRequest(params: TradingQuoteParams) {
  return {
    type: params.type,
    amount: toAmountString(params.amount),
    tokenInChainId: params.chainId,
    tokenOutChainId: params.chainId,
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    swapper: params.swapper,
    urgency: params.urgency,
    routingPreference: params.routingPreference ?? DEFAULT_ROUTING_PREFERENCE,
    protocols: [...DEFAULT_PROTOCOLS],
    generatePermitAsTransaction: false,
    ...(params.slippageTolerance !== undefined
      ? { slippageTolerance: params.slippageTolerance }
      : { autoSlippage: params.autoSlippage ?? DEFAULT_AUTO_SLIPPAGE }),
  };
}

export function normalizeQuoteResponse(response: ApiQuoteResponse): TradingQuoteResponse {
  assertSupportedRouting(response.routing);

  return {
    requestId: response.requestId,
    quote: response.quote,
    routing: response.routing,
    permitTransaction: normalizeTransactionRequest(response.permitTransaction),
    permitData: response.permitData ?? null,
    permitGasFee: normalizeBigInt(response.permitGasFee),
  };
}
