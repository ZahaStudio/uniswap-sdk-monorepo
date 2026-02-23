import { WETH_ADDRESS } from "@uniswap/universal-router-sdk";
import type { Address } from "viem";

import { sortTokens } from "@/helpers/tokens";

export const UNICHAIN_TOKENS = {
  ETH: "0x0000000000000000000000000000000000000000",
  WETH: WETH_ADDRESS(130) as Address,
  USDC: "0x078d782b760474a361dda0af3839290b0ef57ad6",
} as const;

export const UNICHAIN_POOL_ID = "0x3258f413c7a88cda2fa8709a589d221a80f6574f63df5a5b6774485d8acc39d9" as const;

export const UNICHAIN_FORK_BLOCK_NUMBER = 39_629_268;

const [currency0, currency1] = sortTokens(UNICHAIN_TOKENS.ETH, UNICHAIN_TOKENS.USDC);

export const UNICHAIN_POOL_KEY = {
  currency0,
  currency1,
  fee: 500,
  tickSpacing: 10,
  hooks: "0x0000000000000000000000000000000000000000",
} as const;

const [wethCurrency0, wethCurrency1] = sortTokens(UNICHAIN_TOKENS.WETH, UNICHAIN_TOKENS.USDC);

export const UNICHAIN_WETH_POOL_KEY = {
  currency0: wethCurrency0,
  currency1: wethCurrency1,
  fee: 3000,
  tickSpacing: 60,
  hooks: "0x0000000000000000000000000000000000000000",
} as const;

export const UNICHAIN_WETH_IS_CURRENCY0 = wethCurrency0.toLowerCase() === UNICHAIN_TOKENS.WETH.toLowerCase();
