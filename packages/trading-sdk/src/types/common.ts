import type { Address } from "viem";

export type TradingRouting = "CLASSIC" | "WRAP" | "UNWRAP";
export type TradeType = "EXACT_INPUT";
export type Urgency = "normal" | "fast" | "urgent";
export type AutoSlippage = "DEFAULT";
export type RoutingPreference = "BEST_PRICE";
export type UniversalRouterVersion = "1.2" | "2.0";
export type TradingProtocol = "V2" | "V3" | "V4";

export interface TradingPermitData {
  domain: Record<string, unknown>;
  types: Record<string, Array<{ name: string; type: string }>>;
  values: Record<string, unknown>;
}

export interface TradingQuoteAmounts {
  token: Address;
  amount: string;
  recipient?: Address;
}

export interface TradingRouteToken {
  address: Address;
  chainId?: number;
  symbol?: string;
  decimals?: string;
  buyFeeBps?: number;
  sellFeeBps?: number;
}

interface TradingRoutePoolBase {
  type: string;
  address: Address;
  tokenIn: TradingRouteToken;
  tokenOut: TradingRouteToken;
  amountIn?: string;
  amountOut?: string;
}

export interface TradingV2RoutePool extends TradingRoutePoolBase {
  type: "v2-pool";
  reserve0?: {
    token?: TradingRouteToken;
    quotient?: string;
  };
  reserve1?: {
    token?: TradingRouteToken;
    quotient?: string;
  };
}

export interface TradingV3RoutePool extends TradingRoutePoolBase {
  type: "v3-pool";
  sqrtRatioX96?: string;
  liquidity?: string;
  tickCurrent?: string | number;
  fee?: number;
}

export interface TradingV4RoutePool extends TradingRoutePoolBase {
  type: "v4-pool";
  sqrtRatioX96?: string;
  liquidity?: string;
  tickCurrent?: string | number;
  fee?: number;
  tickSpacing?: number;
  hooks?: Address;
}

export type TradingRoutePool = TradingV2RoutePool | TradingV3RoutePool | TradingV4RoutePool;
export type TradingRoute = TradingRoutePool[][];
