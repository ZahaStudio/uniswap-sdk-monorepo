import { type Currency, Ether, Token } from "@uniswap/sdk-core";
import type { Address } from "viem";
import { erc20Abi, zeroAddress } from "viem";
import { getFromCache, setToCache } from "@/helpers/cache";

import type { UniswapSDKInstance } from "@/core/sdk";

/**
 * Arguments for getTokens function
 */
export interface GetTokensArgs {
  /** Array of token contract addresses (at least one) */
  addresses: [Address, ...Address[]];
}

/**
 * Retrieves Token instances for a list of token addresses on a specific chain.
 * @param params Parameters including token addresses
 * @param instance UniswapSDKInstance
 * @returns Promise resolving to array of Token instances
 * @throws Error if token data cannot be fetched
 */
export async function getTokens(params: GetTokensArgs, instance: UniswapSDKInstance): Promise<Currency[]> {
  const { addresses } = params;
  const { client, chain, cache } = instance;
  const resultByAddress = new Map<string, Currency>();
  const missingAddresses: Address[] = [];
  const normalize = (address: string) => address.toLowerCase();
  const cacheTokenKey = (address: string) => `tokens:${chain.id}:${normalize(address)}`;

  for (const address of addresses) {
    if (address === zeroAddress) {
      resultByAddress.set(normalize(address), Ether.onChain(chain.id));
      continue;
    }
    const cachedCurrency = await getFromCache<Currency>(cache, cacheTokenKey(address));
    if (cachedCurrency) {
      resultByAddress.set(normalize(address), cachedCurrency);
    } else {
      missingAddresses.push(address);
    }
  }

  // return the cached values if we are able to find all addresses in
  // cache
  if (missingAddresses.length === 0) {
    return addresses.map((address) => {
      const cachedToken = resultByAddress.get(normalize(address));
      if (!cachedToken) {
        throw new Error(`Failed to fetch token data for ${address}`);
      }
      return cachedToken;
    });
  }

  const calls = missingAddresses
    .filter((address) => address !== zeroAddress) // filter out native currency
    .flatMap((address) => [
      { address, abi: erc20Abi, functionName: "symbol" },
      { address, abi: erc20Abi, functionName: "name" },
      { address, abi: erc20Abi, functionName: "decimals" },
    ]);

  try {
    const results = await client.multicall({
      contracts: calls,
      allowFailure: false,
    });

    let resultIndex = 0;

    // Add all the missing addresses to cache
    for (const address of missingAddresses) {
      const symbol = results[resultIndex++] as string;
      const name = results[resultIndex++] as string;
      const decimals = results[resultIndex++] as number;
      const token = new Token(chain.id, address, decimals, symbol, name);
      resultByAddress.set(normalize(address), token);
      await setToCache(cache, cacheTokenKey(address), token);
    }

    return addresses.map((address) => {
      const token = resultByAddress.get(normalize(address));
      if (!token) {
        throw new Error(`Failed to fetch token data for ${address}`);
      }
      return token;
    });
  } catch (err) {
    throw new Error(`Failed to fetch token data: ${(err as Error).message} `);
  }
}
