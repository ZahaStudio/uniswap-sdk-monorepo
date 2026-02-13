import { v4 } from "hookmate/abi";
import { decodeAbiParameters, decodeFunctionData, parseAbiParameters, type Hex } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { ACTIVE_POSITION_TOKEN_ID } from "@/test/integration/constants";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("buildRemoveLiquidityCallData (unichain rpc)", () => {
  it("builds remove liquidity calldata for an active position", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);

    const { calldata, value } = await sdk.buildRemoveLiquidityCallData({
      tokenId: ACTIVE_POSITION_TOKEN_ID,
      liquidityPercentage: 100,
      slippageTolerance: 100,
    });

    const decoded = decodeFunctionData({
      abi: v4.PositionManagerArtifact.abi,
      data: calldata as Hex,
    });

    const [unlockData, deadline] = decoded.args as [Hex, bigint];
    const [, params] = decodeAbiParameters(parseAbiParameters("bytes,bytes[]"), unlockData);
    const tokenIdWord = BigInt(ACTIVE_POSITION_TOKEN_ID).toString(16).padStart(64, "0");

    // 0xdd46508f is PositionManager.modifyLiquidities(bytes,uint256).
    expect(calldata.slice(0, 10)).toBe("0xdd46508f");
    expect(decoded.functionName).toBe("modifyLiquidities");
    expect(deadline).toBe(1770378227n);
    expect(params.some((param) => param.toLowerCase().includes(tokenIdWord))).toBe(true);
    expect(value).toBe("0x00");
  });
});
