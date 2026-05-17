import type { SwapRoute } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";

export type SwapMode = "exactInput" | "exactOutput";

export type SwapToken = {
  chainId: number;
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  tags?: string[];
};

export type SwapRouteDefinition = {
  id: string;
  label: string;
  chainId: number;
  token0: SwapToken;
  token1: SwapToken;
  route: SwapRoute;
  feeLabel: string;
  liquidityLabel: string;
};
