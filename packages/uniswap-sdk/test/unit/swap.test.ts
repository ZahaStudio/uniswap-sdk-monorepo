import { calculateMinimumOutput } from "@/helpers/swap";

describe("calculateMinimumOutput", () => {
  it("returns the expected output for common slippage values", () => {
    expect(calculateMinimumOutput(1_000_000n, 0)).toBe(1_000_000n);
    expect(calculateMinimumOutput(1_000_000n, 50)).toBe(995_000n);
    expect(calculateMinimumOutput(1_000_000n, 10_000)).toBe(0n);
  });

  it("floors the result for non-divisible amounts", () => {
    expect(calculateMinimumOutput(5n, 33)).toBe(4n);
  });
});
