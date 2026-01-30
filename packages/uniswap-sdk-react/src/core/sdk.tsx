import { createContext, useContext, type PropsWithChildren } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { UniswapSDK } from "@zahastudio/uniswap-sdk";
import { useChainId, usePublicClient } from "wagmi";

import { SDK_QUERY_SPECIFIER } from "@/utils/constants";

type UniswapSDKContextValue = UseQueryResult<UniswapSDK, Error>;

const UniswapSDKContext = createContext<UniswapSDKContextValue | undefined>(undefined);

type UniswapSDKProviderProps = PropsWithChildren<{
  // contracts?: V4Contracts; // TODO: Allow users to specify a list of V4Contract based on chainId
}>;

export function UniswapSDKProvider({ children }: UniswapSDKProviderProps) {
  const chainId = useChainId();
  const client = usePublicClient({ chainId });

  const sdkQuery = useQuery({
    queryKey: [SDK_QUERY_SPECIFIER, "instance", chainId],
    queryFn: async () => {
      if (!client) {
        throw new Error("Public client unavailable");
      }

      return UniswapSDK.create(client);
    },
    enabled: Boolean(client),
  });

  return <UniswapSDKContext.Provider value={sdkQuery}>{children}</UniswapSDKContext.Provider>;
}

export function useUniswapSDK() {
  const context = useContext(UniswapSDKContext);

  if (!context) {
    throw new Error("useUniswapSDK must be used within UniswapSDKProvider");
  }

  return context;
}
