import { Pool } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startForkNode, stopForkNode } from "@/test/integration/forkNode";

describe("getTickInfo (unichain fork)", () => {
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

  it("reads tick info for the pool", async () => {
    if (!forkUrl) {
      throw new Error("Fork node URL was not initialized.");
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(forkUrl),
    });

    const sdk = await UniswapSDK.create(client);
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
    const [expectedLiquidityGross, expectedLiquidityNet, expectedFeeGrowthOutside0X128, expectedFeeGrowthOutside1X128] =
      (await client.readContract({
        address: sdk.getContractAddress("stateView"),
        abi: v4.StateViewArtifact.abi,
        functionName: "getTickInfo",
        args: [poolId, 0],
      })) as unknown as [bigint, bigint, bigint, bigint];

    const tickInfo = await sdk.getTickInfo({
      poolKey: MAINNET_POOL_KEY,
      tick: 0,
    });

    expect(tickInfo.liquidityGross).toBe(expectedLiquidityGross);
    expect(tickInfo.liquidityNet).toBe(expectedLiquidityNet);
    expect(tickInfo.feeGrowthOutside0X128).toBe(expectedFeeGrowthOutside0X128);
    expect(tickInfo.feeGrowthOutside1X128).toBe(expectedFeeGrowthOutside1X128);
  });
});
