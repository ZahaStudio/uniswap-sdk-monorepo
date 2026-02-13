import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import { UNICHAIN_FORK_BLOCK_NUMBER } from "@/test/fixtures/unichain";

const UNICHAIN_RPC_URL = "https://mainnet.unichain.org";

export function createPinnedUnichainClient(blockNumber: bigint = BigInt(UNICHAIN_FORK_BLOCK_NUMBER)): PublicClient {
  const client = createPublicClient({
    chain: unichain,
    transport: http(UNICHAIN_RPC_URL),
  }) as PublicClient;

  const multicall = client.multicall.bind(client);
  const readContract = client.readContract.bind(client);
  const simulateContract = client.simulateContract.bind(client);
  const getBlock = client.getBlock.bind(client);
  type MulticallArgs = Parameters<typeof multicall>[0];
  type ReadContractArgs = Parameters<typeof readContract>[0];
  type SimulateContractArgs = Parameters<typeof simulateContract>[0];
  type GetBlockArgs = Parameters<typeof getBlock>[0];

  client.multicall = ((args: MulticallArgs) => {
    const request = {
      ...(args as object),
      blockNumber: args.blockNumber ?? blockNumber,
    } as MulticallArgs;

    return multicall(request);
  }) as unknown as typeof client.multicall;

  client.readContract = ((args: ReadContractArgs) => {
    const params = args as { blockNumber?: bigint } & object;
    const request = {
      ...params,
      blockNumber: params.blockNumber ?? blockNumber,
    } as ReadContractArgs;

    return readContract(request);
  }) as unknown as typeof client.readContract;

  client.simulateContract = ((args: SimulateContractArgs) => {
    const params = args as { blockNumber?: bigint } & object;
    const request = {
      ...params,
      blockNumber: params.blockNumber ?? blockNumber,
    } as SimulateContractArgs;

    return simulateContract(request);
  }) as unknown as typeof client.simulateContract;

  client.getBlock = ((args: GetBlockArgs) => {
    const params = (args ?? {}) as {
      blockHash?: `0x${string}`;
      blockNumber?: bigint;
      blockTag?: "safe" | "finalized" | "latest" | "earliest" | "pending";
    };

    if (params.blockHash || params.blockTag || params.blockNumber) {
      return getBlock(args);
    }

    return getBlock({ blockNumber } as GetBlockArgs);
  }) as unknown as typeof client.getBlock;

  return client;
}
