import type { UniswapSDKInstance } from "@/core/sdk";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";

describe("getDefaultDeadline", () => {
  it("adds the provided offset to the current block timestamp", async () => {
    const instance = {
      client: {
        getBlock: vi.fn().mockResolvedValue({ timestamp: 1_000n }),
      },
      defaultDeadline: 600,
      defaultSlippageTolerance: 50,
    } as unknown as UniswapSDKInstance;

    await expect(getDefaultDeadline(instance, 60)).resolves.toBe(1_060n);
  });
});
