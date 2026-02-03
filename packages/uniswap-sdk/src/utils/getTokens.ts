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

  const calls = addresses
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

    const tokens: Currency[] = [];
    let resultIndex = 0;

    for (const address of addresses) {
      if (address === zeroAddress) {
        tokens.push(Ether.onChain(chain.id));
      } else {
        // For ERC20 tokens, use multicall results
        const symbol = results[resultIndex++] as string;
        const name = results[resultIndex++] as string;
        const decimals = results[resultIndex++] as number;
        tokens.push(new Token(chain.id, address, decimals, symbol, name));
      }
    }

    return tokens;
  } catch (err) {
    throw new Error(`Failed to fetch token data: ${(err as Error).message}`);
  }
}
