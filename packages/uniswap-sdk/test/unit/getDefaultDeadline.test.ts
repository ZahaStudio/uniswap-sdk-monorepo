import type { UniswapSDKInstance } from "@/core/sdk";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";

describe("getDefaultDeadline", () => {
  const instance = {
    client: {
      getBlock: vi.fn().mockResolvedValue({ timestamp: 1_000n }),
    },
    defaultDeadline: 600,
    defaultSlippageTolerance: 50,
  } as unknown as UniswapSDKInstance;

  it("adds the provided offset to the current block timestamp", async () => {
    await expect(getDefaultDeadline(instance, 60)).resolves.toBe(1_060n);
  });

  it("falls back to the sdk default deadline when override is omitted", async () => {
    await expect(getDefaultDeadline(instance)).resolves.toBe(1_600n);
  });

  it("rejects invalid deadline overrides", async () => {
    await expect(getDefaultDeadline(instance, 0)).rejects.toThrow("Invalid deadlineDuration");
    await expect(getDefaultDeadline(instance, -1)).rejects.toThrow("Invalid deadlineDuration");
    await expect(getDefaultDeadline(instance, 1.5)).rejects.toThrow("Invalid deadlineDuration");
  });
});
