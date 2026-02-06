import { Ether } from "@uniswap/sdk-core";
import { createPublicClient, erc20Abi, http } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_TOKENS } from "@/test/fixtures/mainnet";
import { startAnvil, stopAnvil } from "@/test/integration/anvil";

describe("getTokens (unichain fork)", () => {
  let anvilUrl: string | null = null;
  let anvil: Awaited<ReturnType<typeof startAnvil>> | null = null;

  beforeAll(async () => {
    anvil = await startAnvil();
    anvilUrl = anvil.url;
  });

  afterAll(async () => {
    if (anvil) {
      await stopAnvil(anvil);
    }
  });

  it("fetches token metadata from the fork", async () => {
    if (!anvilUrl) {
      throw new Error("Anvil URL was not initialized.");
    }

    const tokenA = MAINNET_TOKENS.ETH as `0x${string}`;
    const tokenB = MAINNET_TOKENS.USDC as `0x${string}`;

    const client = createPublicClient({
      chain: mainnet,
      transport: http(anvilUrl),
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
