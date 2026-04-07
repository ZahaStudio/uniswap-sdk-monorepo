import type { PoolKey } from "@uniswap/v4-sdk";

import { Token } from "@uniswap/sdk-core";
import { zeroAddress } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";

import { getPool } from "@/utils/getPool";
import { getTokens } from "@/utils/getTokens";

vi.mock("@/utils/getTokens", () => ({
  getTokens: vi.fn(),
}));

const mockedGetTokens = vi.mocked(getTokens);

describe("getPool", () => {
  it("returns a pool even when on-chain liquidity is zero", async () => {
    mockedGetTokens.mockResolvedValue([
      new Token(1, "0x0000000000000000000000000000000000000001", 18, "TK0", "Token 0"),
      new Token(1, "0x0000000000000000000000000000000000000002", 18, "TK1", "Token 1"),
    ]);

    const instance = {
      client: {
        multicall: vi.fn().mockResolvedValue([[79228162514264337593543950336n, 0, 0, 0], 0n]),
      },
      contracts: {
        stateView: "0x0000000000000000000000000000000000000003",
      },
    } as unknown as UniswapSDKInstance;

    const poolKey = {
      currency0: "0x0000000000000000000000000000000000000001",
      currency1: "0x0000000000000000000000000000000000000002",
      fee: 3000,
      tickSpacing: 60,
      hooks: zeroAddress,
    } satisfies PoolKey;

    const pool = await getPool(poolKey, instance);

    expect(pool.liquidity.toString()).toBe("0");
  });
});
