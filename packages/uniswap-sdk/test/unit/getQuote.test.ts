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
      },
    } as unknown as UniswapSDKInstance;

    const quote = await getQuote(
      {
        currencyIn: "0x0000000000000000000000000000000000000001",
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
        amountIn: "1000",
      },
      instance,
    );

    expect(quote).toEqual({
      amountOut: 12345n,
      timestamp: Date.now(),
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
});
