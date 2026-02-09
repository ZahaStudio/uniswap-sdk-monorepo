"use client";

import { useMemo } from "react";

import type { Address } from "viem";
import { erc20Abi, formatUnits, zeroAddress } from "viem";
import { useAccount, useBalance, useReadContracts } from "wagmi";

import type { UseHookOptions } from "@/types/hooks";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

/**
 * On-chain token metadata.
 */
export interface TokenDetails {
  /** Token contract address (zero address for native ETH) */
  address: Address;
  /** Token name (e.g. "USD Coin") */
  name: string | undefined;
  /** Token symbol (e.g. "USDC") */
  symbol: string | undefined;
  /** Token decimals (e.g. 6, 18) */
  decimals: number | undefined;
}

/**
 * User's balance for a token.
 */
export interface TokenBalance {
  /** Raw balance in base units */
  raw: bigint;
  /** Human-readable formatted balance */
  formatted: string;
}

/**
 * Return type for the useToken hook.
 */
export interface UseTokenReturn {
  /** On-chain token metadata */
  token: TokenDetails;
  /** User's balance (undefined if no wallet connected or still loading) */
  balance: TokenBalance | undefined;
  /** Whether token metadata is loading */
  isLoadingToken: boolean;
  /** Whether balance is loading */
  isLoadingBalance: boolean;
  /** Whether any data is loading */
  isLoading: boolean;
  /** Error from token metadata or balance fetch */
  error: Error | undefined;
}

/**
 * Hook to fetch on-chain token details and the connected user's balance.
 *
 * For native ETH (zero address), uses wagmi's `useBalance`.
 * For ERC-20 tokens, reads `name`, `symbol`, `decimals`, and `balanceOf`
 * via a single multicall.
 *
 * @param tokenAddress - The token contract address (use zero address for native ETH)
 * @param options - Configuration: enabled, chainId, refetchInterval
 * @returns Token details, user balance, and loading/error state
 *
 * @example
 * ```tsx
 * const { token, balance } = useToken("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
 *
 * // Display balance
 * if (balance) {
 *   console.log(`${balance.formatted} ${token.symbol}`);
 * }
 * ```
 */
export function useToken(tokenAddress: Address, options: UseHookOptions = {}): UseTokenReturn {
  const { enabled = true, chainId, refetchInterval } = options;

  const { address: account } = useAccount();
  const isNative = tokenAddress.toLowerCase() === zeroAddress.toLowerCase();

  // ── Native ETH balance ────────────────────────────────────────────────
  const nativeBalance = useBalance({
    address: account,
    chainId,
    query: {
      enabled: enabled && isNative && !!account,
      refetchInterval,
    },
  });

  // ── ERC-20 metadata + balance (single multicall) ──────────────────────
  const erc20Query = useReadContracts({
    contracts: [
      { address: tokenAddress, abi: erc20Abi, functionName: "name", chainId },
      { address: tokenAddress, abi: erc20Abi, functionName: "symbol", chainId },
      { address: tokenAddress, abi: erc20Abi, functionName: "decimals", chainId },
      ...(account
        ? [
            {
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [account],
              chainId,
            },
          ]
        : []),
    ],
    query: {
      enabled: enabled && !isNative,
      refetchInterval,
    },
  });

  // ── Derive token details ──────────────────────────────────────────────
  const token = useMemo((): TokenDetails => {
    if (isNative) {
      return {
        address: zeroAddress,
        name: "Ether",
        symbol: "ETH",
        decimals: 18,
      };
    }

    const results = erc20Query.data;
    return {
      address: tokenAddress,
      name: results?.[0]?.result as string | undefined,
      symbol: results?.[1]?.result as string | undefined,
      decimals: results?.[2]?.result as number | undefined,
    };
  }, [isNative, tokenAddress, erc20Query.data]);

  // ── Derive balance ────────────────────────────────────────────────────
  const balance = useMemo((): TokenBalance | undefined => {
    if (isNative) {
      if (!nativeBalance.data) return undefined;
      return {
        raw: nativeBalance.data.value,
        formatted: formatUnits(nativeBalance.data.value, 18),
      };
    }

    const decimals = token.decimals;
    if (decimals === undefined) return undefined;

    const balanceResult = account ? erc20Query.data?.[3] : undefined;
    if (!balanceResult?.result && balanceResult?.result !== 0n) return undefined;

    const raw = balanceResult.result as bigint;
    return {
      raw,
      formatted: formatUnits(raw, decimals),
    };
  }, [isNative, nativeBalance.data, token.decimals, account, erc20Query.data]);

  // ── Loading / error state ─────────────────────────────────────────────
  const isLoadingToken = !isNative && erc20Query.isLoading;
  const isLoadingBalance = isNative ? nativeBalance.isLoading : erc20Query.isLoading;
  const error = (isNative ? nativeBalance.error : erc20Query.error) ?? undefined;

  return {
    token,
    balance,
    isLoadingToken,
    isLoadingBalance,
    isLoading: isLoadingToken || isLoadingBalance,
    error,
  };
}
