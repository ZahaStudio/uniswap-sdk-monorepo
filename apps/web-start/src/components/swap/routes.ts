import type { Address } from "viem";

import { zeroAddress } from "viem";

import type { SwapRouteDefinition, SwapToken } from "@/components/swap/types";

export const MAINNET_CHAIN_ID = 1;
export const EMPTY_HOOK = zeroAddress;
export const EMPTY_HOOK_DATA = "0x";

export const ETH_TOKEN: SwapToken = {
  chainId: MAINNET_CHAIN_ID,
  address: zeroAddress,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  tags: ["Native"],
};

export const WBTC_TOKEN: SwapToken = {
  chainId: MAINNET_CHAIN_ID,
  address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  symbol: "WBTC",
  name: "Wrapped Bitcoin",
  decimals: 8,
  tags: ["Blue chip"],
};

export const USDC_TOKEN: SwapToken = {
  chainId: MAINNET_CHAIN_ID,
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  tags: ["Stablecoin"],
};

export const USDT_TOKEN: SwapToken = {
  chainId: MAINNET_CHAIN_ID,
  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  tags: ["Stablecoin"],
};

export const SUPPORTED_TOKENS = [ETH_TOKEN, USDC_TOKEN, USDT_TOKEN, WBTC_TOKEN] as const;

export const DEFAULT_INPUT_TOKEN = ETH_TOKEN;
export const DEFAULT_OUTPUT_TOKEN = USDC_TOKEN;

function poolRoute(currency0: Address, currency1: Address, fee: number, tickSpacing: number) {
  return [
    {
      poolKey: {
        currency0,
        currency1,
        fee,
        tickSpacing,
        hooks: EMPTY_HOOK,
      },
      hookData: EMPTY_HOOK_DATA,
    },
  ] as const;
}

export const SWAP_ROUTE_DEFINITIONS: SwapRouteDefinition[] = [
  {
    id: "eth-usdc-500",
    label: "ETH / USDC",
    chainId: MAINNET_CHAIN_ID,
    token0: ETH_TOKEN,
    token1: USDC_TOKEN,
    route: poolRoute(ETH_TOKEN.address, USDC_TOKEN.address, 500, 10),
    feeLabel: "0.05%",
    liquidityLabel: "Curated high-liquidity ETH stable route",
  },
  {
    id: "eth-usdt-500",
    label: "ETH / USDT",
    chainId: MAINNET_CHAIN_ID,
    token0: ETH_TOKEN,
    token1: USDT_TOKEN,
    route: poolRoute(ETH_TOKEN.address, USDT_TOKEN.address, 500, 10),
    feeLabel: "0.05%",
    liquidityLabel: "Curated high-liquidity ETH stable route",
  },
  {
    id: "eth-wbtc-3000",
    label: "ETH / WBTC",
    chainId: MAINNET_CHAIN_ID,
    token0: ETH_TOKEN,
    token1: WBTC_TOKEN,
    route: poolRoute(ETH_TOKEN.address, WBTC_TOKEN.address, 3000, 60),
    feeLabel: "0.30%",
    liquidityLabel: "Curated major asset route",
  },
  {
    id: "usdc-usdt-100",
    label: "USDC / USDT",
    chainId: MAINNET_CHAIN_ID,
    token0: USDC_TOKEN,
    token1: USDT_TOKEN,
    route: poolRoute(USDC_TOKEN.address, USDT_TOKEN.address, 100, 1),
    feeLabel: "0.01%",
    liquidityLabel: "Curated stablecoin route",
  },
  {
    id: "wbtc-usdc-3000",
    label: "WBTC / USDC",
    chainId: MAINNET_CHAIN_ID,
    token0: WBTC_TOKEN,
    token1: USDC_TOKEN,
    route: poolRoute(WBTC_TOKEN.address, USDC_TOKEN.address, 3000, 60),
    feeLabel: "0.30%",
    liquidityLabel: "Curated BTC stable route",
  },
  {
    id: "wbtc-usdt-3000",
    label: "WBTC / USDT",
    chainId: MAINNET_CHAIN_ID,
    token0: WBTC_TOKEN,
    token1: USDT_TOKEN,
    route: poolRoute(WBTC_TOKEN.address, USDT_TOKEN.address, 3000, 60),
    feeLabel: "0.30%",
    liquidityLabel: "Curated BTC stable route",
  },
];

export const DEFAULT_SWAP_ROUTE = SWAP_ROUTE_DEFINITIONS[0]!;

export function isSameAddress(left: Address, right: Address) {
  return left.toLowerCase() === right.toLowerCase();
}

export function findSwapRoute(inputToken: SwapToken, outputToken: SwapToken): SwapRouteDefinition | undefined {
  if (isSameAddress(inputToken.address, outputToken.address)) {
    return undefined;
  }

  return SWAP_ROUTE_DEFINITIONS.find(
    (definition) =>
      (isSameAddress(definition.token0.address, inputToken.address) &&
        isSameAddress(definition.token1.address, outputToken.address)) ||
      (isSameAddress(definition.token1.address, inputToken.address) &&
        isSameAddress(definition.token0.address, outputToken.address)),
  );
}
