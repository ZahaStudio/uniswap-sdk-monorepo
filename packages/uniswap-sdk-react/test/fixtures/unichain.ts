import type { Address } from "viem";

export const UNICHAIN_RPC_URL = "https://mainnet.unichain.org";
export const UNICHAIN_FORK_BLOCK_NUMBER = 39_629_268;

export const UNICHAIN_TOKENS = {
  ETH: "0x0000000000000000000000000000000000000000",
  USDC: "0x078d782b760474a361dda0af3839290b0ef57ad6",
} as const;

export const UNICHAIN_POOL_KEY = {
  currency0: UNICHAIN_TOKENS.ETH,
  currency1: UNICHAIN_TOKENS.USDC,
  fee: 500,
  tickSpacing: 10,
  hooks: "0x0000000000000000000000000000000000000000",
} as const;

export const UNICHAIN_SWAP_AMOUNT_IN = 1_000_000n;
export const UNICHAIN_EXPECTED_AMOUNT_OUT = 518_374_739_793_346n;

export const UNICHAIN_EXPECTED_POOL = {
  liquidity: "85574567509471904",
  sqrtRatioX96: "3478956592539674946755639",
  tickCurrent: -200678,
} as const;

export const UNICHAIN_PERMIT2_ROUTER = "0x0000000000000000000000000000000000000000" as Address;
