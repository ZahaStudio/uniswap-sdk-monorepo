import ky, { HTTPError, type KyInstance } from "ky";

import { TradingApiError } from "./errors";
import { DEFAULT_BASE_URL } from "./constants";
import type { TradingRequestOptions, TradingSDKConfig } from "../types";

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

export function createBaseHeaders(config: TradingSDKConfig): Headers {
  const headers = new Headers(config.headers);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  headers.set("x-api-key", config.apiKey);
  headers.set("x-universal-router-version", config.universalRouterVersion ?? "2.0");
  return headers;
}

export function createHttpClient(config: TradingSDKConfig, baseHeaders: HeadersInit): KyInstance {
  return ky.create({
    prefixUrl: normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL),
    fetch: resolveFetch(config.fetch),
    headers: baseHeaders,
  });
}

export function createRequestHeaders(
  baseHeaders: HeadersInit,
  defaultPermit2Disabled: boolean,
  options: TradingRequestOptions,
): Headers {
  const headers = new Headers(baseHeaders);

  const permit2Disabled = options.permit2Disabled ?? defaultPermit2Disabled;
  if (permit2Disabled) {
    headers.set("x-permit2-disabled", "true");
  }

  const optionHeaders = new Headers(options.headers);
  optionHeaders.forEach((value, key) => headers.set(key, value));

  return headers;
}

export async function parseHttpError(error: HTTPError): Promise<never> {
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
