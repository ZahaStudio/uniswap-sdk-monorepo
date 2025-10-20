import type { Abi } from "viem";
import type { SimulateContractReturnType } from "viem/actions";
import { describe, expect, it, vi } from "vitest";
import { createMockSdkInstance } from "@/test/helpers/sdkInstance";
import { getQuote } from "@/utils/getQuote";
import type { SwapExactInSingle } from "@/types/utils/getQuote";

const mockSwapParams: SwapExactInSingle = {
  poolKey: {
    currency0: "0x123",
    currency1: "0x456",
    fee: 3000,
    tickSpacing: 10,
    hooks: "0x",
  },
  zeroForOne: true,
  amountIn: "1000000",
};

describe("getQuote", () => {
  it("should throw error if SDK instance not found", async () => {
    const mockDeps = createMockSdkInstance();
    mockDeps.client.simulateContract = vi
      .fn()
      .mockRejectedValueOnce(new Error("SDK not found"));

    await expect(getQuote(mockSwapParams, mockDeps)).rejects.toThrow(
      "SDK not found"
    );
  });

  it("should handle quote simulation", async () => {
    const mockDeps = createMockSdkInstance();
    mockDeps.client.simulateContract = vi.fn().mockResolvedValueOnce({
      result: [BigInt(1000000), BigInt(21000)],
    } as SimulateContractReturnType<Abi, "quoteExactInputSingle", [[unknown]]>);

    const result = await getQuote(mockSwapParams, mockDeps);

    expect(result).toEqual({
      amountOut: BigInt(1000000),
      estimatedGasUsed: BigInt(21000),
      timestamp: expect.any(Number),
    });
  });

  it("should handle quote simulation with optional parameters", async () => {
    const mockDeps = createMockSdkInstance();
    mockDeps.client.simulateContract = vi.fn().mockResolvedValueOnce({
      result: [BigInt(950000), BigInt(25000)],
    } as SimulateContractReturnType<Abi, "quoteExactInputSingle", [[unknown]]>);

    const swapParamsWithOptional: SwapExactInSingle = {
      ...mockSwapParams,
      amountOutMinimum: "950000",
      hookData: "0x1234",
    };

    const result = await getQuote(swapParamsWithOptional, mockDeps);

    expect(result).toEqual({
      amountOut: BigInt(950000),
      estimatedGasUsed: BigInt(25000),
      timestamp: expect.any(Number),
    });
  });

  it("should handle string amountIn conversion to bigint", async () => {
    const mockDeps = createMockSdkInstance();
    mockDeps.client.simulateContract = vi.fn().mockResolvedValueOnce({
      result: [BigInt(2000000), BigInt(30000)],
    } as SimulateContractReturnType<Abi, "quoteExactInputSingle", [[unknown]]>);

    const swapParamsWithStringAmount: SwapExactInSingle = {
      ...mockSwapParams,
      amountIn: "2000000", // String amount
    };

    const result = await getQuote(swapParamsWithStringAmount, mockDeps);

    expect(result).toEqual({
      amountOut: BigInt(2000000),
      estimatedGasUsed: BigInt(30000),
      timestamp: expect.any(Number),
    });

    // Verify that the string was converted to bigint in the contract call
    expect(mockDeps.client.simulateContract).toHaveBeenCalledWith({
      address: expect.any(String),
      abi: expect.any(Array),
      functionName: "quoteExactInputSingle",
      args: [
        expect.objectContaining({
          exactAmount: BigInt(2000000), // Should be converted to bigint
        }),
      ],
    });
  });
});
