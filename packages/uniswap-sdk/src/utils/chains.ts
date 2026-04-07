import type { Chain } from "viem";

import { getSupportedChains } from "hookmate";

export const getChainById = (chainId: number): Chain => {
  const chain = getSupportedChains().find((chain) => chain.id === chainId);
  if (!chain) {
    throw new Error(`Unsupported Chain: ${chainId}`);
  }

  return chain;
};
