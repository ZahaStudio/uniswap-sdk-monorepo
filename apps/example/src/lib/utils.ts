import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Address } from "viem";

import { buildTokenInfo, type TokenInfo } from "@/lib/tokens";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns true if the error should be shown to the user (filters out user rejections). */
export function shouldShowExecutionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return !normalized.includes("user rejected") && !normalized.includes("user denied");
}

/** Placeholder token while on-chain metadata is loading. */
export function placeholderToken(address: Address): TokenInfo {
  return buildTokenInfo(address, "...", "", 18);
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}
