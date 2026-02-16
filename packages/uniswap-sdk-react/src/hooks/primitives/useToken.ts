"use client";

import { useMemo } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getBalance, readContracts } from "@wagmi/core";
import { getChainById } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";
import { erc20Abi, formatUnits, zeroAddress } from "viem";
import { useAccount, useReadContracts, useConfig } from "wagmi";

import type { UseHookOptions } from "@/types/hooks";
import { tokenKeys } from "@/utils/queryKeys";

/**
 * On-chain token metadata.
 */
export interface TokenDetails {
  /** Token contract address (zero address for native ETH) */
  address: Address;
  /** Token name (e.g. "USD Coin") */
  name: string;
  /** Token symbol (e.g. "USDC") */
  symbol: string;
  /** Token decimals (e.g. 6, 18) */
  decimals: number;
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
 * Combined query data returned by useToken.
 * Includes token metadata and optionally the account balance.
 */
export interface UseTokenData {
  /** On-chain token metadata */
  token: TokenDetails;
  /** Account balance (only present when an account address is available) */
  balance: TokenBalance | undefined;
}

/**
 * Parameters for the useToken hook.
 */
export interface UseTokenParams {
  /** The token contract address (use zero address for native ETH) */
  tokenAddress: Address;
  /** Optional account address to fetch balance for. Defaults to the connected wallet. */
  account?: Address;
}

/**
 * Return type for the useToken hook.
 */
export interface UseTokenReturn {
  /** TanStack Query result with token data and balance */
  query: UseQueryResult<UseTokenData, Error>;
}

/**
 * Hook to fetch on-chain token details and an account's balance.
 *
 * Token metadata (name, symbol, decimals) is fetched via wagmi's
 * `useReadContracts` hook and cached independently — it never changes
 * for a given token address. Balance is fetched inside a TanStack Query
 * that respects `refetchInterval` for live updates.
 *
 * For native ETH (zero address), metadata is hardcoded and balance
 * is fetched via wagmi core's `getBalance`.
 *
 * Balance is only included when an account address is available (either
 * from the connected wallet or the explicit `account` parameter).
 *
 * @param params - Token address and optional account override
 * @param options - Configuration: enabled, chainId, refetchInterval
 * @returns Object with a single TanStack Query result
 *
 * @example
 * ```tsx
 * // Use connected wallet's balance
 * const { query } = useToken({ tokenAddress: "0xA0b8...eB48" });
 * if (query.data) {
 *   const { token, balance } = query.data;
 *   console.log(`${balance?.formatted} ${token.symbol}`);
 * }
 *
 * // Use a specific account's balance
 * const { query } = useToken({
 *   tokenAddress: "0xA0b8...eB48",
 *   account: "0x1234...5678",
 * });
 * ```
 */
export function useToken(params: UseTokenParams, options: UseHookOptions = {}): UseTokenReturn {
  const { tokenAddress, account: accountOverride } = params;
  const { enabled = true, chainId: overrideChainId, refetchInterval } = options;

  const config = useConfig();
  const { address: connectedAddress, chainId } = useAccount();
  const account = accountOverride ?? connectedAddress;
  const isNative = tokenAddress.toLowerCase() === zeroAddress.toLowerCase();
  const resolvedChain = getChainById(overrideChainId ?? chainId!);

  const erc20Metadata = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: tokenAddress, abi: erc20Abi, functionName: "name", chainId: resolvedChain.id },
      { address: tokenAddress, abi: erc20Abi, functionName: "symbol", chainId: resolvedChain.id },
      { address: tokenAddress, abi: erc20Abi, functionName: "decimals", chainId: resolvedChain.id },
    ],
    query: {
      enabled: enabled && !isNative,
    },
  });

  const token = useMemo((): TokenDetails | undefined => {
    if (isNative) {
      return {
        address: zeroAddress,
        ...resolvedChain.nativeCurrency,
      };
    }

    const results = erc20Metadata.data;
    if (results) {
      return {
        address: tokenAddress,
        name: results[0],
        symbol: results[1],
        decimals: results[2],
      };
    }

    return undefined;
  }, [isNative, erc20Metadata.data, tokenAddress, resolvedChain]);

  const query = useQuery({
    queryKey: tokenKeys.detail(tokenAddress, account, chainId),
    queryFn: async (): Promise<UseTokenData> => {
      if (!token) {
        throw new Error("Token metadata not available");
      }

      if (!account) {
        return {
          token,
          balance: undefined,
        };
      }

      if (isNative) {
        const bal = await getBalance(config, { address: account, chainId });

        return {
          token,
          balance: {
            raw: bal.value,
            formatted: formatUnits(bal.value, token.decimals),
          },
        };
      }

      const [result] = await readContracts(config, {
        allowFailure: false,
        contracts: [
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
            chainId,
          },
        ],
      });

      return {
        token,
        balance: {
          raw: result,
          formatted: formatUnits(result, token.decimals),
        },
      };
    },
    enabled: enabled && !!tokenAddress && !!token,
    refetchInterval,
  });

  return { query };
}
