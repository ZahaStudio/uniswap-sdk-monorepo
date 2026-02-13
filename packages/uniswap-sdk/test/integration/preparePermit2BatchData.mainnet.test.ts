import type { Hex } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_TOKENS } from "@/test/fixtures/unichain";
import { TEST_OWNER } from "@/test/integration/constants";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

const TEST_SIGNATURE = `0x${"11".repeat(65)}` as Hex;

describe("preparePermit2BatchData (unichain rpc)", () => {
  it("prepares permit2 typed data for multiple tokens", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const spender = sdk.getContractAddress("universalRouter");

    const prepared = await sdk.preparePermit2BatchData({
      tokens: [UNICHAIN_TOKENS.ETH, UNICHAIN_TOKENS.USDC],
      owner: TEST_OWNER,
      spender,
    });

    const signed = prepared.buildPermit2BatchDataWithSignature(TEST_SIGNATURE);

    expect(prepared.toSign.primaryType).toBe("PermitBatch");
    expect(prepared.toSign.domain.chainId).toBe(unichain.id);
    expect(prepared.permitBatch.details).toEqual([
      {
        token: UNICHAIN_TOKENS.USDC,
        //  max uint160 value
        amount: "1461501637330902918203684832716283019655932542975",
        expiration: 0,
        nonce: 0,
      },
    ]);
    expect(prepared.permitBatch.spender.toLowerCase()).toBe(spender.toLowerCase());
    expect(prepared.permitBatch.sigDeadline).toBe(1770381227);

    expect(signed.owner.toLowerCase()).toBe(TEST_OWNER.toLowerCase());
    expect(signed.signature).toBe(TEST_SIGNATURE);
    expect(signed.permitBatch.spender.toLowerCase()).toBe(spender.toLowerCase());
  });
});
