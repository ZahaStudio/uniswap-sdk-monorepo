import { zeroAddress } from "viem";

import {
  EMPTY_HOOK_DATA,
  normalizeHookData,
  resolveSwapRouteExactInput,
  resolveSwapRouteExactOutput,
} from "@/utils/swapRoute";

describe("swapRoute", () => {
  it("normalizes missing hook data to empty bytes", () => {
    expect(normalizeHookData()).toBe(EMPTY_HOOK_DATA);
  });

  it("preserves custom hook data for exact-input routes", () => {
    const route = resolveSwapRouteExactInput("0x0000000000000000000000000000000000000001", [
      {
        poolKey: {
          currency0: "0x0000000000000000000000000000000000000001",
          currency1: "0x0000000000000000000000000000000000000002",
          fee: 500,
          tickSpacing: 10,
          hooks: "0x00000000000000000000000000000000000000aa",
        },
        hookData: "0x1234",
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
    ]);

    expect(route).toEqual({
      outputCurrency: "0x0000000000000000000000000000000000000003",
      path: [
        {
          intermediateCurrency: "0x0000000000000000000000000000000000000002",
          fee: 500,
          tickSpacing: 10,
          hooks: "0x00000000000000000000000000000000000000aa",
          hookData: "0x1234",
        },
        {
          intermediateCurrency: "0x0000000000000000000000000000000000000003",
          fee: 3000,
          tickSpacing: 60,
          hooks: zeroAddress,
          hookData: EMPTY_HOOK_DATA,
        },
      ],
    });
  });

  it("preserves custom hook data for exact-output routes", () => {
    const route = resolveSwapRouteExactOutput("0x0000000000000000000000000000000000000003", [
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
          hooks: "0x00000000000000000000000000000000000000bb",
        },
        hookData: "0xdeadbeef",
      },
    ]);

    expect(route).toEqual({
      inputCurrency: "0x0000000000000000000000000000000000000001",
      path: [
        {
          intermediateCurrency: "0x0000000000000000000000000000000000000001",
          fee: 500,
          tickSpacing: 10,
          hooks: zeroAddress,
          hookData: EMPTY_HOOK_DATA,
        },
        {
          intermediateCurrency: "0x0000000000000000000000000000000000000002",
          fee: 3000,
          tickSpacing: 60,
          hooks: "0x00000000000000000000000000000000000000bb",
          hookData: "0xdeadbeef",
        },
      ],
    });
  });
});
