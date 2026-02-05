import { sortTokens } from "@/helpers/tokens";

describe("sortTokens", () => {
  it("returns lexicographic order by address", () => {
    const lower = "0x0000000000000000000000000000000000000001";
    const higher = "0x000000000000000000000000000000000000000a";

    expect(sortTokens(higher, lower)).toEqual([lower, higher]);
  });

  it("handles mixed-case addresses consistently", () => {
    const lower = "0x0000000000000000000000000000000000000001";
    const upper = "0x00000000000000000000000000000000000000AA";

    expect(sortTokens(upper, lower)).toEqual([lower, upper]);
  });
});
