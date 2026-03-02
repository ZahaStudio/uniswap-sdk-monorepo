import type { UniswapSDKInstance } from "@/core/sdk";

export async function getDefaultDeadline(instance: UniswapSDKInstance, deadlineDuration?: number): Promise<bigint> {
  const resolvedDeadline = deadlineDuration ?? instance.defaultDeadline;
  if (!Number.isInteger(resolvedDeadline) || resolvedDeadline <= 0) {
    throw new Error(`Invalid deadlineDuration: ${resolvedDeadline}. Must be a positive integer number of seconds.`);
  }

  return (await instance.client.getBlock()).timestamp + BigInt(resolvedDeadline);
}
