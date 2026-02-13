import { v4 } from "hookmate/abi";
import { decodeAbiParameters, decodeFunctionData, parseAbiParameters, type Hex } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { TEST_RECIPIENT } from "@/test/integration/constants";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("buildAddLiquidityCallData (unichain rpc)", () => {
  it("builds add liquidity calldata", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const pool = await sdk.getPool({
      currencyA: UNICHAIN_POOL_KEY.currency0,
      currencyB: UNICHAIN_POOL_KEY.currency1,
      fee: UNICHAIN_POOL_KEY.fee,
      tickSpacing: UNICHAIN_POOL_KEY.tickSpacing,
      hooks: UNICHAIN_POOL_KEY.hooks,
    });

    const { calldata, value } = await sdk.buildAddLiquidityCallData({
      pool,
      amount0: "100000000000000",
      recipient: TEST_RECIPIENT,
      slippageTolerance: 100,
    });

    const decoded = decodeFunctionData({
      abi: v4.PositionManagerArtifact.abi,
      data: calldata as Hex,
    });

    const [unlockData, deadline] = decoded.args as [Hex, bigint];
    const [, params] = decodeAbiParameters(parseAbiParameters("bytes,bytes[]"), unlockData);
    const recipientWord = TEST_RECIPIENT.toLowerCase().slice(2).padStart(64, "0");
    const valueWord = BigInt(value).toString(16).padStart(64, "0");

    // 0xdd46508f is PositionManager.modifyLiquidities(bytes,uint256).
    expect(calldata.slice(0, 10)).toBe("0xdd46508f");
    expect(decoded.functionName).toBe("modifyLiquidities");
    expect(deadline).toBe(1770378227n);
    expect(params.some((param) => param.toLowerCase().includes(recipientWord))).toBe(true);
    expect(params.some((param) => param.toLowerCase().includes(valueWord))).toBe(true);
    expect(value).toBe("0x5b685c31f8be");
  });
});
