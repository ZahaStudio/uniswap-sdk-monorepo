import { type PublicClient, createPublicClient, http, zeroAddress } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_FORK_BLOCK_NUMBER, UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";

const UNICHAIN_RPC_URL = "https://unichain.drpc.org";
const PINNED_BLOCK_NUMBER = BigInt(UNICHAIN_FORK_BLOCK_NUMBER);

describe("getPool (unichain rpc)", () => {
  it("fetches a pool", async () => {
    const client = createPublicClient({
      chain: unichain,
      transport: http(UNICHAIN_RPC_URL),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id, undefined, undefined, PINNED_BLOCK_NUMBER);
    const pool = await sdk.getPool({
      currencyA: UNICHAIN_POOL_KEY.currency0,
      currencyB: UNICHAIN_POOL_KEY.currency1,
      fee: UNICHAIN_POOL_KEY.fee,
      tickSpacing: UNICHAIN_POOL_KEY.tickSpacing,
      hooks: UNICHAIN_POOL_KEY.hooks,
    });

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
