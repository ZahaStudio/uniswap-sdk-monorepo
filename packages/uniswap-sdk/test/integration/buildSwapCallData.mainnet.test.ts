import { utility } from "hookmate/abi";
import { decodeFunctionData, type Hex } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { TEST_RECIPIENT } from "@/test/integration/constants";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("buildSwapCallData (unichain rpc)", () => {
  it("builds universal router calldata", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const pool = await sdk.getPool({
      currencyA: UNICHAIN_POOL_KEY.currency0,
      currencyB: UNICHAIN_POOL_KEY.currency1,
      fee: UNICHAIN_POOL_KEY.fee,
      tickSpacing: UNICHAIN_POOL_KEY.tickSpacing,
      hooks: UNICHAIN_POOL_KEY.hooks,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const calldata = sdk.buildSwapCallData({
      amountIn: 1_000_000n,
      amountOutMinimum: 0n,
      pool,
      zeroForOne: false,
      recipient: TEST_RECIPIENT,
    });

    vi.useRealTimers();

    const decoded = decodeFunctionData({
      abi: utility.UniversalRouterArtifact.abi,
      data: calldata,
    });

    const recipientWord = TEST_RECIPIENT.toLowerCase().slice(2).padStart(64, "0");
    const amountInWord = 1_000_000n.toString(16).padStart(64, "0");

    expect(decoded.functionName).toBe("execute");

    const [commands, inputs, deadline] = decoded.args as [Hex, Hex[], bigint];
    // 0x3593564c is UniversalRouter.execute(bytes,bytes[],uint256).
    expect(calldata.slice(0, 10)).toBe("0x3593564c");
    // V4_SWAP command byte from universal-router-sdk CommandType.V4_SWAP.
    expect(commands).toBe("0x10");
    // Deadline is derived from mocked system time + 5 minutes in buildSwapCallData.
    expect(deadline).toBe(1767225900n);
    // Action payload must include encoded recipient and amountIn words.
    expect(calldata.toLowerCase()).toContain(recipientWord);
    expect(calldata.toLowerCase()).toContain(amountInWord);
  });
});
