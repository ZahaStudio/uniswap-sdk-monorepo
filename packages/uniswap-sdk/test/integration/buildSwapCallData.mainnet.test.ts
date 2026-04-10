import { utility } from "hookmate/abi";
import { decodeFunctionData, type Hex } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { mapRoute } from "@/utils/swapRoute";
import {
  UNICHAIN_ETH_TO_WETH_ROUTE,
  UNICHAIN_POOL_KEY,
  UNICHAIN_TOKENS,
  UNICHAIN_WETH_POOL_KEY,
} from "@/test/fixtures/unichain";
import { TEST_RECIPIENT } from "@/test/integration/constants";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("buildSwapCallData (unichain rpc)", () => {
  it("builds universal router calldata for a single-hop route", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const block = await client.getBlock();
    const expectedDeadline = block.timestamp + BigInt(sdk.defaultDeadline);
    const pool = await sdk.getPool(UNICHAIN_POOL_KEY);

    const calldata = await sdk.buildSwapCallData({
      currencyIn: UNICHAIN_TOKENS.USDC,
      route: [{ pool }],
      amountIn: 1_000_000n,
      amountOutMinimum: 0n,
      recipient: TEST_RECIPIENT,
    });

    const decoded = decodeFunctionData({
      abi: utility.UniversalRouterArtifact.abi,
      data: calldata,
    });

    expect(decoded.functionName).toBe("execute");

    const [commands, , deadline] = decoded.args as [Hex, Hex[], bigint];
    expect(commands).toBe("0x10");
    expect(deadline).toBe(expectedDeadline);
    expect(calldata).toMatch(/^0x[0-9a-f]+$/);
  });

  it("builds universal router calldata for a multi-hop route", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const block = await client.getBlock();
    const expectedDeadline = block.timestamp + BigInt(sdk.defaultDeadline);
    const pools = await Promise.all(UNICHAIN_ETH_TO_WETH_ROUTE.map(({ poolKey }) => sdk.getPool(poolKey)));

    const calldata = await sdk.buildSwapCallData({
      currencyIn: UNICHAIN_TOKENS.ETH,
      route: mapRoute(UNICHAIN_ETH_TO_WETH_ROUTE, (_, index) => ({ pool: pools[index]! })),
      amountIn: 1_000_000n,
      amountOutMinimum: 0n,
      recipient: TEST_RECIPIENT,
    });

    const decoded = decodeFunctionData({
      abi: utility.UniversalRouterArtifact.abi,
      data: calldata,
    });

    expect(decoded.functionName).toBe("execute");

    const [commands, , deadline] = decoded.args as [Hex, Hex[], bigint];
    expect(commands).toBe("0x10");
    expect(deadline).toBe(expectedDeadline);
    expect(calldata).toMatch(/^0x[0-9a-f]+$/);
  });

  it("adds WRAP_ETH command when useNativeETH is true and input is WETH", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const block = await client.getBlock();
    const expectedDeadline = block.timestamp + BigInt(sdk.defaultDeadline);
    const pool = await sdk.getPool(UNICHAIN_WETH_POOL_KEY);

    const calldata = await sdk.buildSwapCallData({
      currencyIn: UNICHAIN_TOKENS.WETH,
      route: [{ pool }],
      amountIn: 1_000_000n,
      amountOutMinimum: 0n,
      recipient: TEST_RECIPIENT,
      useNativeETH: true,
    });

    const decoded = decodeFunctionData({
      abi: utility.UniversalRouterArtifact.abi,
      data: calldata,
    });

    expect(decoded.functionName).toBe("execute");

    const [commands, inputs, deadline] = decoded.args as [Hex, Hex[], bigint];
    expect(commands).toBe("0x0b10");
    expect(inputs).toHaveLength(2);
    expect(deadline).toBe(expectedDeadline);
    expect(calldata).toMatch(/^0x[0-9a-f]+$/);
  });

  it("adds UNWRAP_WETH command when useNativeETH is true and output is WETH", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const block = await client.getBlock();
    const expectedDeadline = block.timestamp + BigInt(sdk.defaultDeadline);
    const pool = await sdk.getPool(UNICHAIN_WETH_POOL_KEY);

    const calldata = await sdk.buildSwapCallData({
      currencyIn: UNICHAIN_TOKENS.USDC,
      route: [{ pool }],
      amountIn: 1_000_000n,
      amountOutMinimum: 0n,
      recipient: TEST_RECIPIENT,
      useNativeETH: true,
    });

    const decoded = decodeFunctionData({
      abi: utility.UniversalRouterArtifact.abi,
      data: calldata,
    });

    expect(decoded.functionName).toBe("execute");

    const [commands, inputs, deadline] = decoded.args as [Hex, Hex[], bigint];
    expect(commands).toBe("0x100c");
    expect(inputs).toHaveLength(2);
    expect(deadline).toBe(expectedDeadline);
    expect(calldata).toMatch(/^0x[0-9a-f]+$/);
  });
});
