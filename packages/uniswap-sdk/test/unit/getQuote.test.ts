import { zeroAddress } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";

import { getQuote } from "@/utils/getQuote";

describe("getQuote", () => {
  it("quotes a multi-hop exact-input route through quoteExactInput", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T00:00:00.000Z"));

    const simulateContract = vi.fn().mockResolvedValue({ result: [12345n, 987n] });
    const instance = {
      client: {
        simulateContract,
      },
      contracts: {
        quoter: "0x0000000000000000000000000000000000000009",
        weth: "0x0000000000000000000000000000000000000004",
      },
    } as unknown as UniswapSDKInstance;

    const quote = await getQuote(
      {
        route: [
          {
            poolKey: {
              currency0: "0x0000000000000000000000000000000000000001",
              currency1: "0x0000000000000000000000000000000000000002",
              fee: 500,
              tickSpacing: 10,
              hooks: zeroAddress,
            },
          },
          {
            poolKey: {
              currency0: "0x0000000000000000000000000000000000000002",
              currency1: "0x0000000000000000000000000000000000000003",
              fee: 3000,
              tickSpacing: 60,
              hooks: zeroAddress,
            },
          },
        ],
        exactInput: {
          currency: "0x0000000000000000000000000000000000000001",
          amount: "1000",
        },
      },
      instance,
    );

    expect(quote).toEqual({
      amountIn: 1000n,
      amountOut: 12345n,
      timestamp: Date.now(),
      meta: {
        resolvedCurrencyIn: "0x0000000000000000000000000000000000000001",
        resolvedCurrencyOut: "0x0000000000000000000000000000000000000003",
      },
    });
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: instance.contracts.quoter,
        functionName: "quoteExactInput",
        args: [
          {
            exactCurrency: "0x0000000000000000000000000000000000000001",
            exactAmount: 1000n,
            path: [
              {
                intermediateCurrency: "0x0000000000000000000000000000000000000002",
                fee: 500,
                tickSpacing: 10,
                hooks: zeroAddress,
                hookData: "0x",
              },
              {
                intermediateCurrency: "0x0000000000000000000000000000000000000003",
                fee: 3000,
                tickSpacing: 60,
                hooks: zeroAddress,
                hookData: "0x",
              },
            ],
          },
        ],
      }),
    );

    vi.useRealTimers();
  });

  it("quotes a multi-hop exact-output route through quoteExactOutput", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T00:00:00.000Z"));

    const simulateContract = vi.fn().mockResolvedValue({ result: [2000n, 987n] });
    const instance = {
      client: {
        simulateContract,
      },
      contracts: {
        quoter: "0x0000000000000000000000000000000000000009",
        weth: "0x0000000000000000000000000000000000000004",
      },
    } as unknown as UniswapSDKInstance;

    const quote = await getQuote(
      {
        route: [
          {
            poolKey: {
              currency0: "0x0000000000000000000000000000000000000001",
              currency1: "0x0000000000000000000000000000000000000002",
              fee: 500,
              tickSpacing: 10,
              hooks: zeroAddress,
            },
          },
          {
            poolKey: {
              currency0: "0x0000000000000000000000000000000000000002",
              currency1: "0x0000000000000000000000000000000000000003",
              fee: 3000,
              tickSpacing: 60,
              hooks: zeroAddress,
            },
          },
        ],
        exactOutput: {
          currency: "0x0000000000000000000000000000000000000003",
          amount: "12345",
        },
      },
      instance,
    );

    expect(quote).toEqual({
      amountIn: 2000n,
      amountOut: 12345n,
      timestamp: Date.now(),
      meta: {
        resolvedCurrencyIn: "0x0000000000000000000000000000000000000001",
        resolvedCurrencyOut: "0x0000000000000000000000000000000000000003",
      },
    });
    expect(simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: instance.contracts.quoter,
        functionName: "quoteExactOutput",
        args: [
          {
            exactCurrency: "0x0000000000000000000000000000000000000003",
            exactAmount: 12345n,
            path: [
              {
                intermediateCurrency: "0x0000000000000000000000000000000000000001",
                fee: 500,
                tickSpacing: 10,
                hooks: zeroAddress,
                hookData: "0x",
              },
              {
                intermediateCurrency: "0x0000000000000000000000000000000000000002",
                fee: 3000,
                tickSpacing: 60,
                hooks: zeroAddress,
                hookData: "0x",
              },
            ],
          },
        ],
      }),
    );

    vi.useRealTimers();
  });

  it("resolves native token metadata when useNativeToken is enabled on WETH route edges", async () => {
    const simulateContract = vi.fn().mockResolvedValue({ result: [2000n, 987n] });
    const weth = "0x0000000000000000000000000000000000000004";
    const instance = {
      client: {
        simulateContract,
      },
      contracts: {
        quoter: "0x0000000000000000000000000000000000000009",
        weth,
      },
    } as unknown as UniswapSDKInstance;

    const quote = await getQuote(
      {
        route: [
          {
            poolKey: {
              currency0: "0x0000000000000000000000000000000000000001",
              currency1: weth,
              fee: 3000,
              tickSpacing: 60,
              hooks: zeroAddress,
            },
          },
        ],
        exactOutput: {
          currency: weth,
          amount: "12345",
        },
        useNativeToken: true,
      },
      instance,
    );

    expect(quote.meta).toEqual({
      resolvedCurrencyIn: "0x0000000000000000000000000000000000000001",
      resolvedCurrencyOut: zeroAddress,
    });
  });
});
