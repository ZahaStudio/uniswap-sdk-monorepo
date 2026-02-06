import { Ether } from "@uniswap/sdk-core";
import { createPublicClient, erc20Abi, http } from "viem";
import { mainnet } from "viem/chains";

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
      chain: mainnet,
      transport: http(forkUrl),
    });

    const sdk = await UniswapSDK.create(client);
    const [currencyA, currencyB] = await sdk.getTokens({ addresses: [tokenA, tokenB] });

    const nativeCurrency = Ether.onChain(await client.getChainId());
    expect(currencyA.symbol).toBe(nativeCurrency.symbol);
    expect(currencyA.decimals).toBe(nativeCurrency.decimals);
    expect(currencyA.name).toBe(nativeCurrency.name);

    const [expectedSymbol, expectedName, expectedDecimals] = await client.multicall({
      allowFailure: false,
      contracts: [
        { address: tokenB, abi: erc20Abi, functionName: "symbol" },
        { address: tokenB, abi: erc20Abi, functionName: "name" },
        { address: tokenB, abi: erc20Abi, functionName: "decimals" },
      ],
    });

    expect(currencyB.symbol).toBe(expectedSymbol);
    expect(currencyB.name).toBe(expectedName);
    expect(currencyB.decimals).toBe(expectedDecimals);
  });
});
