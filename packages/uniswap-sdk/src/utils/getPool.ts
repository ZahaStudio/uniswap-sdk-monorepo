import { Pool, type PoolKey } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";
import { sortTokens } from "@/helpers/tokens";
import { getTokens } from "@/utils/getTokens";

export const DEFAULT_HOOKS = zeroAddress;

/**
 * Retrieves a Uniswap V4 pool instance for a given pool key.
 * @param poolKey - V4 pool key: currency0, currency1, fee, tickSpacing, hooks
 * @param instance - UniswapSDKInstance
 * @returns Promise resolving to pool data
 * @throws Error if SDK instance or token instances are not found or if pool data is not found
 */
export async function getPool(poolKey: PoolKey, instance: UniswapSDKInstance): Promise<Pool> {
  const { currency0, currency1, fee, tickSpacing, hooks } = poolKey;

  const [_currencyA, _currencyB] = sortTokens(currency0 as Address, currency1 as Address);
  const tokenInstances = await getTokens(
    {
      addresses: [_currencyA, _currencyB],
    },
    instance,
  );

  const poolId32Bytes = Pool.getPoolId(tokenInstances[0], tokenInstances[1], fee, tickSpacing, hooks) as Hex;

  const { client, contracts } = instance;
  const { stateView } = contracts;

  const poolData = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: stateView,
        abi: v4.StateViewArtifact.abi,
        functionName: "getSlot0",
        args: [poolId32Bytes],
      },
      {
        address: stateView,
        abi: v4.StateViewArtifact.abi,
        functionName: "getLiquidity",
        args: [poolId32Bytes],
      },
    ],
  });

  if (!poolData) {
    throw new Error("Failed to fetch pool data");
  }

  const [slot0Data, liquidityData] = poolData;
  const poolExists = slot0Data && liquidityData;

  if (!poolExists) {
    throw new Error("Pool does not exist");
  }

  try {
    const pool = new Pool(
      tokenInstances[0],
      tokenInstances[1],
      fee,
      tickSpacing,
      hooks,
      slot0Data[0].toString(),
      liquidityData.toString(),
      slot0Data[1],
    );

    return pool;
  } catch (error) {
    throw new Error(`Error creating pool instance: ${(error as Error).message}`);
  }
}
