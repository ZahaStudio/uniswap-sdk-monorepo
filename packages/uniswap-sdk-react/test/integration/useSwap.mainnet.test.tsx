import { renderHook, waitFor } from "@testing-library/react";
import { unichain } from "wagmi/chains";

import { useSwap } from "@/hooks/useSwap";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { UNICHAIN_EXPECTED_AMOUNT_OUT, UNICHAIN_POOL_KEY, UNICHAIN_SWAP_AMOUNT_IN } from "@/test/fixtures/unichain";
import { getSdkClient, pinSdkClientToBlock } from "@/test/integration/pinSdkClient";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("useSwap", () => {
  it("returns a deterministic quote at the pinned block", async () => {
    const { wrapper } = createIntegrationWrapper();
    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });

    pinSdkClientToBlock(sdkResult.current.sdk);

    const sdkClient = getSdkClient(sdkResult.current.sdk);
    const block = await sdkClient.getBlock?.();
    if (!block) {
      throw new Error("Pinned SDK client did not expose getBlock");
    }
    const blockTimestampMs = Number(block.timestamp) * 1000;

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(blockTimestampMs);

    try {
      const { result } = renderHook(
        () =>
          useSwap(
            {
              poolKey: UNICHAIN_POOL_KEY,
              amountIn: UNICHAIN_SWAP_AMOUNT_IN,
              zeroForOne: false,
            },
            {
              chainId: unichain.id,
            },
          ),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.steps.quote.isSuccess).toBe(true);
      });

      expect(result.current.steps.quote.data?.amountOut).toBe(UNICHAIN_EXPECTED_AMOUNT_OUT);
      // (expectedOutput * (10000 - slippageBps)) / 10000
      expect(result.current.steps.quote.data?.minAmountOut).toBe(515782866094379n);
      expect(result.current.steps.quote.data?.timestamp).toBe(blockTimestampMs);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
