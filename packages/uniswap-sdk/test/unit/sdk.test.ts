import type { Address, PublicClient } from "viem";

import { UniswapSDK, type V4Contracts } from "@/core/sdk";

const customContracts = {
  poolManager: "0x0000000000000000000000000000000000000001",
  positionManager: "0x0000000000000000000000000000000000000002",
  quoter: "0x0000000000000000000000000000000000000003",
  stateView: "0x0000000000000000000000000000000000000004",
  universalRouter: "0x0000000000000000000000000000000000000005",
  permit2: "0x0000000000000000000000000000000000000006",
  weth: "0x0000000000000000000000000000000000000007",
} satisfies Record<keyof V4Contracts, Address>;

describe("UniswapSDK.create", () => {
  const client = {} as PublicClient;

  it("allows unsupported chains when custom contracts are provided", () => {
    const sdk = UniswapSDK.create(client, 999_999, {
      contracts: customContracts,
    });

    expect(sdk.getContractAddress("poolManager")).toBe(customContracts.poolManager);
  });

  it("requires hookmate support when custom contracts are omitted", () => {
    expect(() => UniswapSDK.create(client, 999_999)).toThrow();
  });
});
