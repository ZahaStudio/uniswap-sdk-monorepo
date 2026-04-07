import type { UniversalRouterVersion } from "./common";

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
