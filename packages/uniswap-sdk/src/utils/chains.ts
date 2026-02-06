import { getSupportedChains } from "hookmate";
import type { Chain } from "viem";

export const getChainById = (chainId: number): Chain => {
  const chain = getSupportedChains().find((chain) => chain.id === chainId);
  if (!chain) {
    throw new Error(`Unsupported Chain: ${chainId}`);
  }

  return chain;
};
