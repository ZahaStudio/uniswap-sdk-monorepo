"use client";

import { useContext, type ContextType } from "react";

import { useChainId } from "wagmi";

import { TradingSDKContext } from "@/provider/TradingSDKProvider";

export interface UseTradingSDKReturn {
  sdk: NonNullable<ContextType<typeof TradingSDKContext>>["sdk"];
  isInitialized: boolean;
  chainId: number;
}

export interface UseTradingSDKOptions {
  chainId?: number;
}

export function useTradingSDK(options: UseTradingSDKOptions = {}): UseTradingSDKReturn {
  const context = useContext(TradingSDKContext);

  if (!context) {
    throw new Error("useTradingSDK must be used within TradingSDKProvider.");
  }

  const connectedChainId = useChainId();
  const chainId = options.chainId ?? connectedChainId;

  return {
    sdk: context.sdk,
    isInitialized: true,
    chainId,
  };
}
