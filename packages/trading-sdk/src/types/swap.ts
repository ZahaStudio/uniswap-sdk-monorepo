import type { Hex } from "viem";

import type { TradingPermitData, Urgency } from "./common";
import type { TradingQuote } from "./quote";
import type { NormalizedTransactionRequest } from "../utils/normalize";

export interface CreateTradingSwapParams {
  quote: TradingQuote;
  signature?: Hex | string;
  permitData?: TradingPermitData | null;
  refreshGasPrice?: boolean;
  simulateTransaction?: boolean;
  deadline?: number;
  urgency?: Urgency;
}

export interface CreateTradingSwapResponse {
  requestId: string;
  swap: NormalizedTransactionRequest;
  gasFee?: bigint;
}
