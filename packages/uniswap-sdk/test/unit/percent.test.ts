import { Percent } from "@uniswap/sdk-core";

import { BIPS_BASE, percentFromBips } from "@/helpers/percent";

describe("percentFromBips", () => {
  it("returns a Percent with the expected fraction", () => {
    const percent = percentFromBips(500);

    expect(percent.equalTo(new Percent(500, BIPS_BASE))).toBe(true);
  });
});
