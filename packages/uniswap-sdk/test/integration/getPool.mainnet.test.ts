import { type PublicClient, createPublicClient, http, zeroAddress } from "viem";
import { unichain } from "viem/chains";

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
      chain: unichain,
      transport: http(forkUrl),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id);
    const pool = await sdk.getPool({
      currencyA: MAINNET_POOL_KEY.currency0,
      currencyB: MAINNET_POOL_KEY.currency1,
      fee: MAINNET_POOL_KEY.fee,
      tickSpacing: MAINNET_POOL_KEY.tickSpacing,
      hooks: MAINNET_POOL_KEY.hooks,
    });

    expect(pool.fee).toBe(MAINNET_POOL_KEY.fee);
    expect(pool.tickSpacing).toBe(MAINNET_POOL_KEY.tickSpacing);
    const poolCurrency0Address = pool.currency0.isNative ? zeroAddress : pool.currency0.address;
    const poolCurrency1Address = pool.currency1.isNative ? zeroAddress : pool.currency1.address;

    expect(poolCurrency0Address.toLowerCase()).toBe(MAINNET_POOL_KEY.currency0.toLowerCase());
    expect(poolCurrency1Address.toLowerCase()).toBe(MAINNET_POOL_KEY.currency1.toLowerCase());
    expect(pool.liquidity.toString()).toBe("85574567509471904");
    expect(pool.sqrtRatioX96.toString()).toBe("3478956592539674946755639");
    expect(pool.tickCurrent).toBe(-200678);
  });
});
