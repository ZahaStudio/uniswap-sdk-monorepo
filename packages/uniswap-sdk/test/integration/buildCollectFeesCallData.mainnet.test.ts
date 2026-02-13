import { v4 } from "hookmate/abi";
import { decodeAbiParameters, decodeFunctionData, parseAbiParameters, type Hex } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { ACTIVE_POSITION_TOKEN_ID, TEST_RECIPIENT } from "@/test/integration/constants";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("buildCollectFeesCallData (unichain rpc)", () => {
  it("builds collect fees calldata for an active position", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);

    const { calldata, value } = await sdk.buildCollectFeesCallData({
      tokenId: ACTIVE_POSITION_TOKEN_ID,
      recipient: TEST_RECIPIENT,
    });

    const decoded = decodeFunctionData({
      abi: v4.PositionManagerArtifact.abi,
      data: calldata as Hex,
    });

    const [unlockData, deadline] = decoded.args as [Hex, bigint];
    const [, params] = decodeAbiParameters(parseAbiParameters("bytes,bytes[]"), unlockData);
    const tokenIdWord = BigInt(ACTIVE_POSITION_TOKEN_ID).toString(16).padStart(64, "0");
    const recipientWord = TEST_RECIPIENT.toLowerCase().slice(2).padStart(64, "0");

    // 0xdd46508f is PositionManager.modifyLiquidities(bytes,uint256).
    expect(calldata.slice(0, 10)).toBe("0xdd46508f");
    expect(decoded.functionName).toBe("modifyLiquidities");
    expect(deadline).toBe(1770378227n);
    expect(params.some((param) => param.toLowerCase().includes(tokenIdWord))).toBe(true);
    expect(params.some((param) => param.toLowerCase().includes(recipientWord))).toBe(true);
    expect(value).toBe("0x00");
  });
});
