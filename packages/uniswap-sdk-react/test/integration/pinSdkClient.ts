import type { UniswapSDK } from "@zahastudio/uniswap-sdk";

import { UNICHAIN_FORK_BLOCK_NUMBER } from "@/test/fixtures/unichain";

type ClientLike = {
  multicall?: (args: unknown) => Promise<unknown>;
  readContract?: (args: unknown) => Promise<unknown>;
  simulateContract?: (args: unknown) => Promise<unknown>;
  getBlock?: (args?: unknown) => Promise<{ timestamp: bigint }>;
};

export function pinSdkClientToBlock(sdk: UniswapSDK, blockNumber: bigint = BigInt(UNICHAIN_FORK_BLOCK_NUMBER)): void {
  const client = getSdkClient(sdk);

  if (typeof client.multicall === "function") {
    const multicall = client.multicall.bind(client);
    client.multicall = (args: unknown) => {
      const request = {
        ...(args as object),
        blockNumber: (args as { blockNumber?: bigint }).blockNumber ?? blockNumber,
      };

      return multicall(request);
    };
  }

  if (typeof client.readContract === "function") {
    const readContract = client.readContract.bind(client);
    client.readContract = (args: unknown) => {
      const request = {
        ...(args as object),
        blockNumber: (args as { blockNumber?: bigint }).blockNumber ?? blockNumber,
      };

      return readContract(request);
    };
  }

  if (typeof client.simulateContract === "function") {
    const simulateContract = client.simulateContract.bind(client);
    client.simulateContract = (args: unknown) => {
      const request = {
        ...(args as object),
        blockNumber: (args as { blockNumber?: bigint }).blockNumber ?? blockNumber,
      };

      return simulateContract(request);
    };
  }

  if (typeof client.getBlock === "function") {
    const getBlock = client.getBlock.bind(client);
    client.getBlock = (args?: unknown) => {
      const params = (args ?? {}) as {
        blockHash?: `0x${string}`;
        blockNumber?: bigint;
        blockTag?: "safe" | "finalized" | "latest" | "earliest" | "pending";
      };

      if (params.blockHash || params.blockTag || params.blockNumber) {
        return getBlock(args);
      }

      return getBlock({ blockNumber });
    };
  }
}

export function getSdkClient(sdk: UniswapSDK): ClientLike {
  const internal = sdk as unknown as { instance?: { client?: ClientLike } };
  const client = internal.instance?.client;

  if (!client) {
    throw new Error("Unable to access UniswapSDK internal client for integration test setup.");
  }

  return client;
}
