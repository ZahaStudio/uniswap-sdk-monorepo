"use client";

import { createContext, useMemo, type ReactNode } from "react";

import { TradingSDK, type TradingSDKConfig } from "@zahastudio/trading-sdk";

export interface TradingSDKContextValue {
  sdk: TradingSDK;
}

export const TradingSDKContext = createContext<TradingSDKContextValue | null>(null);

export interface TradingSDKProviderProps {
  children: ReactNode;
  config: TradingSDKConfig;
}

export function TradingSDKProvider({ children, config }: TradingSDKProviderProps) {
  const sdk = useMemo(
    () =>
      TradingSDK.create({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        fetch: config.fetch,
        headers: config.headers,
        universalRouterVersion: config.universalRouterVersion,
        permit2Disabled: config.permit2Disabled,
      }),
    [
      config.apiKey,
      config.baseUrl,
      config.fetch,
      config.headers,
      config.universalRouterVersion,
      config.permit2Disabled,
    ],
  );

  const value = useMemo(() => ({ sdk }), [sdk]);

  return <TradingSDKContext.Provider value={value}>{children}</TradingSDKContext.Provider>;
}
