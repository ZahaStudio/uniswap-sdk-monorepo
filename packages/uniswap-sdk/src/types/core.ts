import type { Address, Chain, PublicClient } from "viem";

/**
 * Configuration for V4 contracts.
 * Contains addresses for all required Uniswap V4 contracts.
 */
export type V4Contracts = {
  /** Address of the pool manager contract */
  poolManager: Address;
  /** Address of the position descriptor contract */
  positionDescriptor: Address;
  /** Address of the position manager contract */
  positionManager: Address;
  /** Address of the quoter contract */
  quoter: Address;
  /** Address of the state view contract */
  stateView: Address;
  /** Address of the universal router contract */
  universalRouter: Address;
};

/**
 * Configuration for the UniDevKitV4 SDK.
 * Required for initializing and managing SDK instances.
 */
export type UniDevKitV4Config = {
  /** Chain ID */
  chainId: number;
  /** RPC URL for the chain (optional) */
  rpcUrl?: string;
  /** Contract addresses */
  contracts: V4Contracts;
};

/**
 * Internal instance type for UniDevKitV4.
 * Represents the state of a single SDK instance.
 */
export type UniDevKitV4Instance = {
  /** Viem public client */
  client: PublicClient;
  /** Chain */
  chain: Chain;
  /** Contract addresses */
  contracts: V4Contracts;
};
