import { type Currency, Ether, Token } from "@uniswap/sdk-core";
import type { Address } from "viem";
import { erc20Abi, zeroAddress } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";

/**
 * Arguments for getTokens function
 */
export interface GetTokensArgs {
  /** Array of token contract addresses (at least one) */
  addresses: [Address, ...Address[]];
}

const tokenCache = new Map<string, Currency>();

const getTokenCacheKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;

/**
 * Retrieves Token instances for a list of token addresses on a specific chain.
 * @param params Parameters including token addresses
 * @param instance UniswapSDKInstance
 * @returns Promise resolving to array of Token instances
 * @throws Error if token data cannot be fetched
 */
export async function getTokens(params: GetTokensArgs, instance: UniswapSDKInstance): Promise<Currency[]> {
  const { addresses } = params;
  const { client, chain } = instance;

  try {
    const tokens: Currency[] = new Array(addresses.length);
    const missing = new Map<string, { address: string; indices: number[] }>();

    for (let index = 0; index < addresses.length; index += 1) {
      const address = addresses[index];
      if (address === zeroAddress) {
        tokens[index] = Ether.onChain(chain.id);
        continue;
      }

      const cacheKey = getTokenCacheKey(chain.id, address);
      const cached = tokenCache.get(cacheKey);
      if (cached) {
        tokens[index] = cached;
        continue;
      }

      const entry = missing.get(cacheKey);
      if (entry) {
        entry.indices.push(index);
      } else {
        missing.set(cacheKey, { address, indices: [index] });
      }
    }

    if (missing.size > 0) {
      const calls = Array.from(missing.values()).flatMap((entry) => [
        { address: entry.address, abi: erc20Abi, functionName: "symbol" },
        { address: entry.address, abi: erc20Abi, functionName: "name" },
        { address: entry.address, abi: erc20Abi, functionName: "decimals" },
      ]);

      const results = await client.multicall({
        contracts: calls,
        allowFailure: false,
      });

      let resultIndex = 0;

      for (const [cacheKey, entry] of missing) {
        const symbol = results[resultIndex++] as string;
        const name = results[resultIndex++] as string;
        const decimals = results[resultIndex++] as number;
        const token = new Token(chain.id, entry.address, decimals, symbol, name);
        tokenCache.set(cacheKey, token);

        for (const index of entry.indices) {
          tokens[index] = token;
        }
      }
    }

    return tokens;
  } catch (err) {
    throw new Error(`Failed to fetch token data: ${(err as Error).message}`);
  }
}
