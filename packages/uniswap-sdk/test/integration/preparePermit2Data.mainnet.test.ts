import type { Hex } from "viem";
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

    const prepared = await sdk.preparePermit2Data({
      token: UNICHAIN_TOKENS.USDC,
      owner: TEST_OWNER,
      spender,
    });

    const signed = prepared.buildPermit2DataWithSignature(TEST_SIGNATURE);

    expect(prepared.toSign.primaryType).toBe("PermitSingle");
    expect(prepared.toSign.domain.chainId).toBe(unichain.id);
    expect(prepared.permit.details.token.toLowerCase()).toBe(UNICHAIN_TOKENS.USDC.toLowerCase());
    expect(prepared.permit.spender.toLowerCase()).toBe(spender.toLowerCase());
    expect(prepared.permit.details.nonce).toBe("0");
    expect(prepared.permit.details.expiration).toBe("1770381227");
    expect(prepared.permit.sigDeadline).toBe(1770381227);

    expect(signed.owner.toLowerCase()).toBe(TEST_OWNER.toLowerCase());
    expect(signed.signature).toBe(TEST_SIGNATURE);
    expect(signed.permit.spender.toLowerCase()).toBe(spender.toLowerCase());
  });
});
