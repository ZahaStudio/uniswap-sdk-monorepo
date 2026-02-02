import { Pool } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";
import { zeroAddress } from "viem";

import { getTickSpacingForFee } from "@/helpers/fees";
import { sortTokens } from "@/helpers/tokens";
import type { UniswapSDKInstance } from "@/types/core";
import type { PoolArgs } from "@/types/utils/getPool";
import { getTokens } from "@/utils/getTokens";

export const DEFAULT_HOOKS = zeroAddress;

/**
 * Retrieves a Uniswap V4 pool instance for a given currency pair, fee tier, tick spacing, and hooks configuration.
 * @param args Pool arguments including currencyA, currencyB, fee tier, tick spacing, and hooks configuration
 * @param instance UniswapSDKInstance
 * @returns Promise resolving to pool data
 * @throws Error if SDK instance or token instances are not found or if pool data is not found
 */
export async function getPool(args: PoolArgs, instance: UniswapSDKInstance): Promise<Pool> {
  const { currencyA, currencyB, fee, tickSpacing, hooks = DEFAULT_HOOKS } = args;

  const [_currencyA, _currencyB] = sortTokens(currencyA, currencyB);
  const tokenInstances = await getTokens(
    {
      addresses: [_currencyA, _currencyB],
    },
    instance,
  );

  // Use provided tick spacing or derive from fee tier
  const _tickSpacing = tickSpacing ?? getTickSpacingForFee(fee);

  const poolId32Bytes = Pool.getPoolId(tokenInstances[0], tokenInstances[1], fee, _tickSpacing, hooks) as `0x${string}`;

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
      _tickSpacing,
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
