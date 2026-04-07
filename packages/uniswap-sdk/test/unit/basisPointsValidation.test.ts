import type { PublicClient } from "viem";

import { Token } from "@uniswap/sdk-core";
import { Pool } from "@uniswap/v4-sdk";
import { zeroAddress } from "viem";

import { UniswapSDK } from "@/core/sdk";
import { percentFromBips } from "@/helpers/percent";
import { calculateMinimumOutput } from "@/helpers/swap";
import { buildAddLiquidityCallData } from "@/utils/buildAddLiquidityCallData";
import { buildRemoveLiquidityCallData } from "@/utils/buildRemoveLiquidityCallData";

const pool = new Pool(
  new Token(1, "0x0000000000000000000000000000000000000001", 18, "TK0", "Token 0"),
  new Token(1, "0x0000000000000000000000000000000000000002", 18, "TK1", "Token 1"),
  3000,
  60,
  zeroAddress,
  "79228162514264337593543950336",
  "1",
  0,
);

describe("basis-points validation", () => {
  it("rejects non-integer default slippage tolerance in UniswapSDK.create", () => {
    const client = {
      chain: { id: 1 },
    } as PublicClient;

    expect(() =>
      UniswapSDK.create(client, 1, {
        defaultSlippageTolerance: 1.5,
      }),
    ).toThrow("Invalid defaultSlippageTolerance: 1.5. Must be an integer between 0 and 10000 basis points");

    expect(() =>
      UniswapSDK.create(client, 1, {
        defaultSlippageTolerance: Number.NaN,
      }),
    ).toThrow("Invalid defaultSlippageTolerance: NaN. Must be an integer between 0 and 10000 basis points");
  });

  it("rejects invalid slippage tolerance before building add-liquidity calldata", async () => {
    const instance = {
      defaultSlippageTolerance: 50,
    } as never;

    await expect(
      buildAddLiquidityCallData(
        {
          pool,
          amount0: "1",
          recipient: "0x0000000000000000000000000000000000000003",
          slippageTolerance: 1.5,
        },
        instance,
      ),
    ).rejects.toThrow("Invalid slippageTolerance: 1.5. Must be an integer between 0 and 10000 basis points");
  });

  it("rejects non-integer liquidity percentage before building remove-liquidity calldata", async () => {
    const instance = {
      defaultSlippageTolerance: 50,
    } as never;

    await expect(
      buildRemoveLiquidityCallData(
        {
          tokenId: "1",
          liquidityPercentage: Number.NaN,
        },
        instance,
      ),
    ).rejects.toThrow("Invalid liquidityPercentage: NaN. Must be an integer between 0 and 10000 basis points");
  });

  it("guards the public helpers against invalid basis-point inputs", () => {
    expect(() => percentFromBips(2.5)).toThrow("Invalid bps: 2.5. Must be an integer between 0 and 10000 basis points");
    expect(() => calculateMinimumOutput(1_000_000n, Number.NaN)).toThrow(
      "Invalid slippageBps: NaN. Must be an integer between 0 and 10000 basis points",
    );
  });
});
