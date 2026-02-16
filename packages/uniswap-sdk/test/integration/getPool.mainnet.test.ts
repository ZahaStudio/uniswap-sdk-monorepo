import { zeroAddress } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("getPool (unichain rpc)", () => {
  it("fetches a pool", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const pool = await sdk.getPool(UNICHAIN_POOL_KEY);

    expect(pool.fee).toBe(UNICHAIN_POOL_KEY.fee);
    expect(pool.tickSpacing).toBe(UNICHAIN_POOL_KEY.tickSpacing);
    const poolCurrency0Address = pool.currency0.isNative ? zeroAddress : pool.currency0.address;
    const poolCurrency1Address = pool.currency1.isNative ? zeroAddress : pool.currency1.address;

    expect(poolCurrency0Address.toLowerCase()).toBe(UNICHAIN_POOL_KEY.currency0.toLowerCase());
    expect(poolCurrency1Address.toLowerCase()).toBe(UNICHAIN_POOL_KEY.currency1.toLowerCase());
    expect(pool.liquidity.toString()).toBe("85574567509471904");
    expect(pool.sqrtRatioX96.toString()).toBe("3478956592539674946755639");
    expect(pool.tickCurrent).toBe(-200678);
  });
});
