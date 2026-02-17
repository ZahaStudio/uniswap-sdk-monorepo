import { renderHook, waitFor } from "@testing-library/react";
import { zeroAddress } from "viem";
import { unichain } from "wagmi/chains";

import { useToken } from "@/hooks/primitives/useToken";
import { UNICHAIN_TOKENS } from "@/test/fixtures/unichain";
import { createIntegrationWrapper } from "@/test/integration/renderHookWithProviders";

describe("useToken", () => {
  it("returns native token metadata when tokenAddress is zero address", async () => {
    const { wrapper } = createIntegrationWrapper();

    const { result } = renderHook(
      () =>
        useToken(
          {
            tokenAddress: zeroAddress,
          },
          {
            chainId: unichain.id,
          },
        ),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    expect(result.current.query.data?.token).toEqual({
      address: zeroAddress,
      name: unichain.nativeCurrency.name,
      symbol: unichain.nativeCurrency.symbol,
      decimals: unichain.nativeCurrency.decimals,
    });
    expect(result.current.query.data?.balance).toBeUndefined();
  });

  it("fetches ERC20 metadata on unichain", async () => {
    const { wrapper } = createIntegrationWrapper();

    const { result } = renderHook(
      () =>
        useToken(
          {
            tokenAddress: UNICHAIN_TOKENS.USDC,
          },
          {
            chainId: unichain.id,
          },
        ),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.query.isSuccess).toBe(true);
    });

    expect(result.current.query.data?.token.address.toLowerCase()).toBe(UNICHAIN_TOKENS.USDC.toLowerCase());
    expect(result.current.query.data?.token.symbol).toBe("USDC");
    expect(result.current.query.data?.token.decimals).toBe(6);
    expect(result.current.query.data?.balance).toBeUndefined();
  });
});
