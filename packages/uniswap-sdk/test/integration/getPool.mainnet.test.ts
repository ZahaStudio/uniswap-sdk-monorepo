import { Pool } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";
import { createPublicClient, http, zeroAddress } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startForkNode, stopForkNode } from "@/test/integration/forkNode";

describe("getPool (unichain fork)", () => {
  let forkUrl: string | null = null;
  let forkNode: Awaited<ReturnType<typeof startForkNode>> | null = null;

  beforeAll(async () => {
    forkNode = await startForkNode();
    forkUrl = forkNode.url;
  });

  afterAll(async () => {
    if (forkNode) {
      await stopForkNode(forkNode);
    }
  });

  it("fetches a pool", async () => {
    if (!forkUrl) {
      throw new Error("Fork node URL was not initialized.");
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(forkUrl),
    });

    const sdk = await UniswapSDK.create(client);
    const pool = await sdk.getPool({
      currencyA: MAINNET_POOL_KEY.currency0,
      currencyB: MAINNET_POOL_KEY.currency1,
      fee: MAINNET_POOL_KEY.fee,
      tickSpacing: MAINNET_POOL_KEY.tickSpacing,
      hooks: MAINNET_POOL_KEY.hooks,
    });

    const tokens = await sdk.getTokens({
      addresses: [MAINNET_POOL_KEY.currency0, MAINNET_POOL_KEY.currency1],
    });
    const poolId = Pool.getPoolId(
      tokens[0],
      tokens[1],
      MAINNET_POOL_KEY.fee,
      MAINNET_POOL_KEY.tickSpacing,
      MAINNET_POOL_KEY.hooks,
    ) as `0x${string}`;
    const [slot0Data, liquidityData] = await client.multicall({
      allowFailure: false,
      contracts: [
        {
          address: sdk.getContractAddress("stateView"),
          abi: v4.StateViewArtifact.abi,
          functionName: "getSlot0",
          args: [poolId],
        },
        {
          address: sdk.getContractAddress("stateView"),
          abi: v4.StateViewArtifact.abi,
          functionName: "getLiquidity",
          args: [poolId],
        },
      ],
    });

    expect(pool.fee).toBe(MAINNET_POOL_KEY.fee);
    expect(pool.tickSpacing).toBe(MAINNET_POOL_KEY.tickSpacing);
    const poolCurrency0Address = pool.currency0.isNative ? zeroAddress : pool.currency0.address;
    const poolCurrency1Address = pool.currency1.isNative ? zeroAddress : pool.currency1.address;

    expect(poolCurrency0Address.toLowerCase()).toBe(MAINNET_POOL_KEY.currency0.toLowerCase());
    expect(poolCurrency1Address.toLowerCase()).toBe(MAINNET_POOL_KEY.currency1.toLowerCase());
    expect(pool.liquidity.toString()).toBe(liquidityData.toString());
    expect(pool.sqrtRatioX96.toString()).toBe(slot0Data[0].toString());
    expect(pool.tickCurrent).toBe(slot0Data[1]);
  });
});
