import type { Address } from "viem";

import type {
  AutoSlippage,
  RoutingPreference,
  TradeType,
  TradingPermitData,
  TradingQuoteAmounts,
  TradingRoute,
  TradingRouting,
  Urgency,
} from "./common";
import type { NormalizedTransactionRequest } from "../utils/normalize";

export interface TradingQuote {
  input: TradingQuoteAmounts;
  output: TradingQuoteAmounts;
  swapper: Address;
  chainId: number;
  tradeType: TradeType;
  slippage?: number;
  gasFee?: string;
  gasFeeUSD?: string;
  gasFeeQuote?: string;
  route?: TradingRoute;
  routeString?: string;
  quoteId?: string;
  gasUseEstimate?: string;
  blockNumber?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  txFailureReasons?: string[];
  priceImpact?: number;
  aggregatedOutputs?: Array<{
    token: Address;
    amount: string;
    recipient: Address;
    bps?: number;
    minAmount?: string;
  }>;
  [key: string]: unknown;
}

export interface TradingQuoteParams {
  type: TradeType;
  amount: bigint | string;
  tokenIn: Address;
  tokenOut: Address;
  chainId: number;
  swapper: Address;
  slippageTolerance?: number;
  autoSlippage?: AutoSlippage;
  urgency?: Urgency;
  routingPreference?: RoutingPreference;
}

export interface TradingQuoteResponse {
  requestId: string;
  quote: TradingQuote;
  routing: TradingRouting;
  permitTransaction: NormalizedTransactionRequest | null;
  permitData: TradingPermitData | null;
  permitGasFee?: bigint;
}
