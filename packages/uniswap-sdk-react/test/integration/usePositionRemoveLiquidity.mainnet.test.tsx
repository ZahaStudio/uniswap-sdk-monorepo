import { act, renderHook, waitFor } from "@testing-library/react";
import { unichain } from "wagmi/chains";

import { usePosition } from "@/hooks/usePosition";
import { usePositionRemoveLiquidity } from "@/hooks/usePositionRemoveLiquidity";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { findLivePositionTokenId } from "@/test/integration/findLivePosition";
import { pinSdkClientToBlock } from "@/test/integration/pinSdkClient";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("usePositionRemoveLiquidity (unichain rpc)", () => {
  it("loads a live position at pinned block and execution rejects without wallet", async () => {
    const { wrapper } = createIntegrationWrapper();
    const { result: sdkResult } = renderHook(() => useUniswapSDK({ chainId: unichain.id }), { wrapper });
    pinSdkClientToBlock(sdkResult.current.sdk);

    const tokenId = await findLivePositionTokenId(sdkResult.current.sdk);

    const { result: positionResult } = renderHook(() => usePosition({ tokenId }, { chainId: unichain.id }), {
      wrapper,
    });

    await waitFor(() => {
      expect(positionResult.current.query.isSuccess).toBe(true);
    });

    const { result } = renderHook(() => usePositionRemoveLiquidity({ tokenId }, { chainId: unichain.id }), { wrapper });

    await act(async () => {
      await expect(
        result.current.execute({
          liquidityPercentage: 100,
        }),
      ).rejects.toBeInstanceOf(Error);
    });
  });
});
