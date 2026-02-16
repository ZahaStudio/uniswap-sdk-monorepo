import { sortTokens } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";
import { zeroAddress } from "viem";

export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
}

export const ETH: TokenInfo = {
  address: zeroAddress,
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  logoUrl: "https://token-icons.s3.amazonaws.com/eth.png",
};

export const USDC: TokenInfo = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoUrl: "https://token-icons.s3.amazonaws.com/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png",
};

export const USDT: TokenInfo = {
  address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  symbol: "USDT",
  name: "Tether USD",
  decimals: 6,
  logoUrl: "https://token-icons.s3.amazonaws.com/0xdac17f958d2ee523a2206206994597c13d831ec7.png",
};

export interface SwapPairPreset {
  id: string;
  label: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  /** Fee tier in pips (e.g. 500 = 0.05%, 3000 = 0.3%) */
  fee: number;
  tickSpacing: number;
  /** Default input amount (human-readable) */
  defaultAmount: string;
}

const HOOKS_ADDRESS = zeroAddress;

// USDC → USDT (both ERC-20, 0.01% fee tier)
export const USDC_USDT_PAIR: SwapPairPreset = {
  id: "usdc-usdt",
  label: "USDC → USDT",
  tokenIn: USDC,
  tokenOut: USDT,
  fee: 100,
  tickSpacing: 1,
  defaultAmount: "200",
};

// ETH → USDC (native ETH, 0.3% fee tier)
export const ETH_USDC_PAIR: SwapPairPreset = {
  id: "eth-usdc",
  label: "ETH → USDC",
  tokenIn: ETH,
  tokenOut: USDC,
  fee: 3000,
  tickSpacing: 60,
  defaultAmount: "0.5",
};

export const SWAP_PRESETS: SwapPairPreset[] = [ETH_USDC_PAIR, USDC_USDT_PAIR];

/**
 * Build a PoolKey from a swap pair preset.
 * currency0/currency1 must be sorted.
 */
export function getPoolKeyFromPreset(preset: SwapPairPreset) {
  const [currency0, currency1] = sortTokens(preset.tokenIn.address, preset.tokenOut.address);
  // zeroForOne = true when tokenIn is currency0
  const zeroForOne = preset.tokenIn.address.toLowerCase() === currency0.toLowerCase();

  return {
    poolKey: {
      currency0,
      currency1,
      fee: preset.fee,
      tickSpacing: preset.tickSpacing,
      hooks: HOOKS_ADDRESS,
    },
    zeroForOne,
  };
}

/**
 * Format a bigint token amount to human-readable string.
 */
export function formatTokenAmount(amount: bigint, decimals: number, maxDecimals = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;

  if (fractional === 0n) return whole.toString();

  const fracStr = fractional.toString().padStart(decimals, "0");
  const trimmed = fracStr.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/**
 * Parse a human-readable token amount to bigint.
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  if (!amount || amount === "0" || amount === ".") return 0n;

  const [whole = "0", frac = ""] = amount.split(".");
  const paddedFrac = frac.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFrac);
}
