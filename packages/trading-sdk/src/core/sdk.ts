import { HTTPError, type KyInstance } from "ky";

import { buildApprovalRequest, normalizeApprovalResponse, type ApiApprovalResponse } from "./approval";
import { createBaseHeaders, createHttpClient, createRequestHeaders, parseHttpError } from "./http";
import { assertQuoteParams, buildQuoteRequest, normalizeQuoteResponse, type ApiQuoteResponse } from "./quote";
import {
  assertCreateSwapParams,
  buildCreateSwapRequest,
  normalizeCreateSwapResponse,
  type ApiCreateSwapResponse,
} from "./swap";
import type {
  CreateTradingSwapParams,
  CreateTradingSwapResponse,
  TradingApprovalParams,
  TradingApprovalResponse,
  TradingQuoteParams,
  TradingQuoteResponse,
  TradingRequestOptions,
  TradingSDKConfig,
} from "../types";

export class TradingSDK {
  private readonly baseHeaders: Headers;
  private readonly permit2Disabled: boolean;
  private readonly http: KyInstance;

  private constructor(config: TradingSDKConfig) {
    if (!config.apiKey) {
      throw new Error("Trading SDK requires an API key.");
    }

    this.baseHeaders = createBaseHeaders(config);
    this.permit2Disabled = config.permit2Disabled ?? false;
    this.http = createHttpClient(config, this.baseHeaders);
  }

  public static create(config: TradingSDKConfig): TradingSDK {
    return new TradingSDK(config);
  }

  public async getQuote(
    params: TradingQuoteParams,
    options: TradingRequestOptions = {},
  ): Promise<TradingQuoteResponse> {
    assertQuoteParams(params);

    const response = await this.request<ApiQuoteResponse>("quote", {
      method: "POST",
      body: buildQuoteRequest(params),
      options,
    });

    return normalizeQuoteResponse(response);
  }

  public async checkApproval(
    params: TradingApprovalParams,
    options: TradingRequestOptions = {},
  ): Promise<TradingApprovalResponse> {
    const response = await this.request<ApiApprovalResponse>("check_approval", {
      method: "POST",
      body: buildApprovalRequest(params),
      options,
    });

    return normalizeApprovalResponse(response);
  }

  public async createSwap(
    params: CreateTradingSwapParams,
    options: TradingRequestOptions = {},
  ): Promise<CreateTradingSwapResponse> {
    assertCreateSwapParams(params);

    const response = await this.request<ApiCreateSwapResponse>("swap", {
      method: "POST",
      body: buildCreateSwapRequest(params),
      options,
    });

    return normalizeCreateSwapResponse(response);
  }

  private async request<TResponse>(
    path: string,
    args: {
      method: "POST";
      body: unknown;
      options: TradingRequestOptions;
    },
  ): Promise<TResponse> {
    const headers = createRequestHeaders(this.baseHeaders, this.permit2Disabled, args.options);

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
        await parseHttpError(error);
      }

      throw error;
    }
  }
}
