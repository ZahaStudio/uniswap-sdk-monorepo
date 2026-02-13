import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_TOKENS } from "@/test/fixtures/unichain";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("getTokens (unichain rpc)", () => {
  it("fetches token metadata from rpc", async () => {
    const tokenA = UNICHAIN_TOKENS.ETH as `0x${string}`;
    const tokenB = UNICHAIN_TOKENS.USDC as `0x${string}`;

    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const [currencyA, currencyB] = await sdk.getTokens({ addresses: [tokenA, tokenB] });

    expect(currencyA.symbol).toBe("ETH");
    expect(currencyA.decimals).toBe(18);
    expect(currencyA.name).toBe("Ether");

    expect(currencyB.symbol).toBe("USDC");
    expect(currencyB.name).toBe("USDC");
    expect(currencyB.decimals).toBe(6);
  });
});
