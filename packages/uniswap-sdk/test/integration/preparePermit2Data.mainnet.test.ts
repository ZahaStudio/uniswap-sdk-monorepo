import { maxUint160, type Hex } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_TOKENS } from "@/test/fixtures/unichain";
import { TEST_OWNER } from "@/test/integration/constants";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

const TEST_SIGNATURE = `0x${"11".repeat(65)}` as Hex;

describe("preparePermit2Data (unichain rpc)", () => {
  it("prepares permit2 typed data for one token", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const spender = sdk.getContractAddress("universalRouter");
    const block = await client.getBlock();
    const expectedSigDeadline = block.timestamp + BigInt(sdk.defaultDeadline);

    const prepared = await sdk.preparePermit2BatchData({
      tokens: [UNICHAIN_TOKENS.USDC],
      owner: TEST_OWNER,
      spender,
    });

    const signed = prepared.buildPermit2BatchDataWithSignature(TEST_SIGNATURE);

    expect(prepared.toSign.primaryType).toBe("PermitBatch");
    expect(prepared.toSign.domain.chainId).toBe(unichain.id);
    expect(prepared.permitBatch.details).toEqual([
      {
        token: UNICHAIN_TOKENS.USDC,
        amount: maxUint160.toString(),
        expiration: expectedSigDeadline.toString(),
        nonce: "0",
      },
    ]);
    expect(prepared.permitBatch.spender.toLowerCase()).toBe(spender.toLowerCase());
    expect(BigInt(prepared.permitBatch.sigDeadline.toString())).toBe(expectedSigDeadline);

    expect(signed.owner.toLowerCase()).toBe(TEST_OWNER.toLowerCase());
    expect(signed.signature).toBe(TEST_SIGNATURE);
    expect(signed.permitBatch.spender.toLowerCase()).toBe(spender.toLowerCase());
  });
});
