import {
  arbitrum,
  arbitrumSepolia,
  avalanche,
  base,
  baseSepolia,
  blast,
  bsc,
  type Chain,
  celo,
  mainnet,
  optimism,
  polygon,
  sepolia,
  unichain,
  unichainSepolia,
  worldchain,
  zksync,
  zora,
} from "viem/chains";

export const supportedChains = [
  arbitrum,
  optimism,
  polygon,
  base,
  bsc,
  avalanche,
  celo,
  blast,
  zksync,
  zora,
  worldchain,
  unichain,
  mainnet,
] as const;

export const testChains = [unichainSepolia, sepolia, baseSepolia, arbitrumSepolia] as const;

export const getChainById = (chainId: number): Chain => {
  const chain = [...supportedChains, ...testChains].find((chain) => chain.id === chainId);
  if (!chain) {
    throw new Error(`Chain with id ${chainId} not found`);
  }
  return chain;
};
