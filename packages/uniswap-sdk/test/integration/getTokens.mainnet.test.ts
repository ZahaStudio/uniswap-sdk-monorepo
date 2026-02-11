import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_TOKENS } from "@/test/fixtures/mainnet";
import { startForkNode, stopForkNode } from "@/test/integration/forkNode";

describe("getTokens (unichain fork)", () => {
  let forkUrl: string | null = null;
  let forkNode: Awaited<ReturnType<typeof startForkNode>> | null = null;

  beforeAll(async () => {
    forkNode = await startForkNode();
    forkUrl = forkNode.url;
  });

  afterAll(async () => {
    if (forkNode) {
      await stopForkNode(forkNode);
    }
  });

  it("fetches token metadata from the fork", async () => {
    if (!forkUrl) {
      throw new Error("Fork node URL was not initialized.");
    }

    const tokenA = MAINNET_TOKENS.ETH as `0x${string}`;
    const tokenB = MAINNET_TOKENS.USDC as `0x${string}`;

    const client = createPublicClient({
      chain: unichain,
      transport: http(forkUrl),
    }) as PublicClient;

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
