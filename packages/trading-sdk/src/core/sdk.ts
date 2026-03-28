import ky, { HTTPError, type KyInstance } from "ky";
import type { Address, Hex } from "viem";

import { TradingApiError } from "./errors";
import {
  normalizeBigInt,
  normalizeTransactionRequest,
  type ApiTransactionRequest,
  type NormalizedTransactionRequest,
} from "../utils/normalize";

const DEFAULT_BASE_URL = "https://trade-api.gateway.uniswap.org/v1";
const DEFAULT_AUTO_SLIPPAGE = "DEFAULT" as const;
const DEFAULT_ROUTING_PREFERENCE = "BEST_PRICE" as const;
const DEFAULT_PROTOCOLS = ["V2", "V3", "V4"] as const;
const SUPPORTED_ROUTINGS = ["CLASSIC", "WRAP", "UNWRAP"] as const;

export type TradingRouting = (typeof SUPPORTED_ROUTINGS)[number];
export type TradeType = "EXACT_INPUT";
export type Urgency = "normal" | "fast" | "urgent";
export type AutoSlippage = typeof DEFAULT_AUTO_SLIPPAGE;
export type RoutingPreference = typeof DEFAULT_ROUTING_PREFERENCE;
export type UniversalRouterVersion = "1.2" | "2.0";
export type TradingProtocol = (typeof DEFAULT_PROTOCOLS)[number];

export interface TradingRequestOptions {
  permit2Disabled?: boolean;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export interface TradingSDKConfig {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit;
  universalRouterVersion?: UniversalRouterVersion;
  permit2Disabled?: boolean;
}

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

interface ApiQuoteResponse {
  requestId: string;
  quote: TradingQuote;
  routing: string;
  permitTransaction?: ApiTransactionRequest | null;
  permitData: TradingPermitData | null;
  permitGasFee?: string;
}

interface ApiApprovalResponse {
  requestId: string;
  approval?: ApiTransactionRequest | null;
  cancel?: ApiTransactionRequest | null;
  gasFee?: string;
  cancelGasFee?: string;
}

interface ApiCreateSwapResponse {
  requestId: string;
  swap: ApiTransactionRequest;
  gasFee?: string;
}

interface ApiErrorResponse {
  errorCode?: string;
  detail?: string;
  requestId?: string;
}

function resolveFetch(fetchOverride?: typeof fetch): typeof fetch {
  if (fetchOverride) {
    return fetchOverride;
  }

  if (typeof globalThis.fetch !== "function") {
    throw new Error("No fetch implementation available. Pass `fetch` in TradingSDK.create(config).");
  }

  return globalThis.fetch.bind(globalThis);
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function createBaseHeaders(config: TradingSDKConfig): Headers {
  const headers = new Headers(config.headers);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  headers.set("x-api-key", config.apiKey);
  headers.set("x-universal-router-version", config.universalRouterVersion ?? "2.0");
  return headers;
}

function toAmountString(amount: bigint | string): string {
  const normalized = typeof amount === "bigint" ? amount : BigInt(amount);
  if (normalized <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  return normalized.toString();
}

function assertSupportedRouting(routing: string): asserts routing is TradingRouting {
  if (!SUPPORTED_ROUTINGS.includes(routing as TradingRouting)) {
    throw new Error(`Unsupported quote routing "${routing}". Trading SDK v1 supports CLASSIC, WRAP, and UNWRAP only.`);
  }
}

function assertQuoteParams(params: TradingQuoteParams): void {
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

export class TradingSDK {
  private readonly headers?: HeadersInit;
  private readonly permit2Disabled: boolean;
  private readonly http: KyInstance;

  private constructor(config: TradingSDKConfig) {
    if (!config.apiKey) {
      throw new Error("Trading SDK requires an API key.");
    }

    this.headers = config.headers;
    this.permit2Disabled = config.permit2Disabled ?? false;
    this.http = ky.create({
      prefixUrl: normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL),
      fetch: resolveFetch(config.fetch),
      headers: createBaseHeaders(config),
    });
  }

  public static create(config: TradingSDKConfig): TradingSDK {
    return new TradingSDK(config);
  }

  public async getQuote(params: TradingQuoteParams, options: TradingRequestOptions = {}): Promise<TradingQuoteResponse> {
    assertQuoteParams(params);

    const body = {
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

    const response = await this.request<ApiQuoteResponse>("quote", {
      method: "POST",
      body,
      options,
    });

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

  public async checkApproval(
    params: TradingApprovalParams,
    options: TradingRequestOptions = {},
  ): Promise<TradingApprovalResponse> {
    const body = {
      walletAddress: params.walletAddress,
      token: params.token,
      amount: toAmountString(params.amount),
      chainId: params.chainId,
      urgency: params.urgency,
      tokenOut: params.tokenOut,
      tokenOutChainId: params.tokenOutChainId ?? (params.tokenOut ? params.chainId : undefined),
    };

    const response = await this.request<ApiApprovalResponse>("check_approval", {
      method: "POST",
      body,
      options,
    });

    return {
      requestId: response.requestId,
      approval: normalizeTransactionRequest(response.approval),
      cancel: normalizeTransactionRequest(response.cancel),
      gasFee: normalizeBigInt(response.gasFee),
      cancelGasFee: normalizeBigInt(response.cancelGasFee),
    };
  }

  public async createSwap(
    params: CreateTradingSwapParams,
    options: TradingRequestOptions = {},
  ): Promise<CreateTradingSwapResponse> {
    if ((params.signature && !params.permitData) || (!params.signature && params.permitData)) {
      throw new Error("Signature and permitData must be provided together.");
    }

    const response = await this.request<ApiCreateSwapResponse>("swap", {
      method: "POST",
      body: {
        quote: params.quote,
        signature: params.signature,
        permitData: params.permitData ?? undefined,
        refreshGasPrice: params.refreshGasPrice,
        simulateTransaction: params.simulateTransaction,
        deadline: params.deadline,
        urgency: params.urgency,
      },
      options,
    });

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

  private async request<TResponse>(
    path: string,
    args: {
      method: "POST";
      body: unknown;
      options: TradingRequestOptions;
    },
  ): Promise<TResponse> {
    const headers = new Headers(this.headers);

    const permit2Disabled = args.options.permit2Disabled ?? this.permit2Disabled;
    if (permit2Disabled) {
      headers.set("x-permit2-disabled", "true");
    }

    const optionHeaders = new Headers(args.options.headers);
    optionHeaders.forEach((value, key) => headers.set(key, value));

    try {
      const response = await this.http(path, {
        method: args.method,
        headers,
        json: args.body,
        signal: args.options.signal,
      });

      return (await response.json()) as TResponse;
    } catch (error) {
      if (error instanceof HTTPError) {
        const response = error.response;
        let payload: ApiErrorResponse | undefined;

        try {
          payload = (await response.clone().json()) as ApiErrorResponse;
        } catch {
          payload = undefined;
        }

        throw new TradingApiError({
          status: response.status,
          errorCode: payload?.errorCode,
          detail: payload?.detail,
          requestId: payload?.requestId,
        });
      }

      throw error;
    }
  }
}
