import { sortTokens, type PoolKey } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";
import { zeroAddress } from "viem";

// ---------------------------------------------------------------------------
// Token display types
// ---------------------------------------------------------------------------

export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string;
}

/** Logo URL registry keyed by lowercase address. */
const TOKEN_LOGOS: Record<string, string> = {
  [zeroAddress]: "https://token-icons.s3.amazonaws.com/eth.png",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "https://token-icons.s3.amazonaws.com/eth.png",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48":
    "https://token-icons.s3.amazonaws.com/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png",
  "0xdac17f958d2ee523a2206206994597c13d831ec7":
    "https://token-icons.s3.amazonaws.com/0xdac17f958d2ee523a2206206994597c13d831ec7.png",
};

/**
 * Build a TokenInfo from on-chain data + logo registry.
 * Falls back to a placeholder logo when the address isn't in the registry.
 */
export function buildTokenInfo(address: Address, symbol: string, name: string, decimals: number): TokenInfo {
  return {
    address,
    symbol,
    name,
    decimals,
    logoUrl: TOKEN_LOGOS[address.toLowerCase()] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Pool presets
// ---------------------------------------------------------------------------

export interface PoolPreset {
  /** Human-readable identifier (e.g. "eth-usdc") */
  poolId: string;
  /** Pre-sorted pool key (currency0 < currency1) */
  poolKey: PoolKey;
  /** Default swap direction: true = currency0 → currency1 */
  zeroForOne: boolean;
}

function makePoolKey(
  tokenA: Address,
  tokenB: Address,
  fee: number,
  tickSpacing: number,
  hooks: Address = zeroAddress,
): PoolKey {
  const [currency0, currency1] = sortTokens(tokenA, tokenB);
  return { currency0, currency1, fee, tickSpacing, hooks };
}

// Addresses
const WETH_ADDR = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;
const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address;

// ETH/USDC (native ETH pool, 0.3% fee tier)
export const ETH_USDC_POOL: PoolPreset = {
  poolId: "eth-usdc",
  poolKey: makePoolKey(zeroAddress, USDC_ADDR, 3000, 60),
  zeroForOne: true,
};

// USDC/USDT (both ERC-20, 0.01% fee tier)
export const USDC_USDT_POOL: PoolPreset = {
  poolId: "usdc-usdt",
  poolKey: makePoolKey(USDC_ADDR, USDT_ADDR, 100, 1),
  zeroForOne: true,
};

// WETH/USDC (WETH pool, 0.05% fee tier)
export const WETH_USDC_POOL: PoolPreset = {
  poolId: "usdc-weth",
  poolKey: makePoolKey(USDC_ADDR, WETH_ADDR, 500, 10),
  zeroForOne: true,
};

export const POOL_PRESETS: PoolPreset[] = [ETH_USDC_POOL, USDC_USDT_POOL, WETH_USDC_POOL];

// ---------------------------------------------------------------------------
// Amount helpers
// ---------------------------------------------------------------------------

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
