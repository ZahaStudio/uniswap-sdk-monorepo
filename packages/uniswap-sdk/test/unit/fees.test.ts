import { getFeePercentage, getTickSpacingForFee, isValidFeeTier } from "@/helpers/fees";
import { FeeTier, TICK_SPACING_BY_FEE } from "@/utils/getPool";

describe("fees helpers", () => {
  it("returns the expected tick spacing for supported fee tiers", () => {
    const feeTiers = [FeeTier.LOWEST, FeeTier.LOW, FeeTier.MEDIUM, FeeTier.HIGH];

    for (const fee of feeTiers) {
      expect(getTickSpacingForFee(fee)).toBe(TICK_SPACING_BY_FEE[fee]);
    }
  });

  it("validates fee tiers correctly", () => {
    expect(isValidFeeTier(FeeTier.MEDIUM)).toBe(true);
    expect(isValidFeeTier(123)).toBe(false);
  });

  it("formats fee tier percentages", () => {
    expect(getFeePercentage(FeeTier.LOWEST)).toBe("0.01%");
    expect(getFeePercentage(FeeTier.LOW)).toBe("0.05%");
    expect(getFeePercentage(FeeTier.MEDIUM)).toBe("0.30%");
    expect(getFeePercentage(FeeTier.HIGH)).toBe("1.00%");
  });

  it("throws when an unsupported fee tier is provided", () => {
    expect(() => getTickSpacingForFee(123)).toThrow("Unsupported fee tier: 123");
    expect(() => getFeePercentage(123)).toThrow("Unsupported fee tier: 123");
  });
});
