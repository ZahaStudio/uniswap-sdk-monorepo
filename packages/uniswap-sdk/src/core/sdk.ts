import type { Currency } from "@uniswap/sdk-core";
import type { Pool } from "@uniswap/v4-sdk";
import { getUniswapContracts } from "hookmate";
import { type Address, type Chain, type PublicClient } from "viem";

import { createDefaultCache, type CacheAdapter } from "@/helpers/cache";
import {
  buildAddLiquidityCallData,
  type BuildAddLiquidityArgs,
  type BuildAddLiquidityCallDataResult,
} from "@/utils/buildAddLiquidityCallData";
import { buildCollectFeesCallData, type BuildCollectFeesCallDataArgs } from "@/utils/buildCollectFeesCallData";
import {
  buildRemoveLiquidityCallData,
  type BuildRemoveLiquidityCallDataArgs,
} from "@/utils/buildRemoveLiquidityCallData";
import { buildSwapCallData, type BuildSwapCallDataArgs } from "@/utils/buildSwapCallData";
import { getChainById } from "@/utils/chains";
import { getPool, type PoolArgs } from "@/utils/getPool";
import { getPosition, type GetPositionResponse } from "@/utils/getPosition";
import { getPositionInfo, type GetPositionInfoResponse } from "@/utils/getPositionInfo";
import { getQuote, type QuoteResponse, type SwapExactInSingle } from "@/utils/getQuote";
import { getTickInfo, type GetTickInfoArgs, type TickInfoResponse } from "@/utils/getTickInfo";
import { getTokens, type GetTokensArgs } from "@/utils/getTokens";
import { getUncollectedFees, type GetUncollectedFeesResponse } from "@/utils/getUncollectedFees";
import { preparePermit2BatchData } from "@/utils/preparePermit2BatchData";
import {
  preparePermit2Data,
  type PreparePermit2BatchDataArgs,
  type PreparePermit2BatchDataResult,
  type PreparePermit2DataArgs,
  type PreparePermit2DataResult,
} from "@/utils/preparePermit2Data";

/**
 * Configuration for V4 contracts.
 * Contains addresses for all required Uniswap V4 contracts.
 */
export type V4Contracts = {
  /** Address of the pool manager contract */
  poolManager: Address;
  /** Address of the position manager contract */
  positionManager: Address;
  /** Address of the quoter contract */
  quoter: Address;
  /** Address of the state view contract */
  stateView: Address;
  /** Address of the universal router contract */
  universalRouter: Address;
  /** Address of the Permit2 contract */
  permit2: Address;
};

/**
 * Options for creating a UniswapSDK instance.
 */
export type UniswapSDKOptions = {
  /** Optional overrides for contract addresses */
  contracts?: V4Contracts;
  /** Optional cache adapter */
  cache?: CacheAdapter;
  /** Default deadline offset in seconds (default: 600 = 10 minutes) */
  defaultDeadline?: number;
  /** Default slippage tolerance in basis points (default: 50 = 0.5%) */
  defaultSlippageTolerance?: number;
};

/**
 * Internal instance type for UniswapSDK.
 * Represents the state of a single SDK instance.
 */
export type UniswapSDKInstance = {
  /** Viem public client */
  client: PublicClient;
  /** Chain */
  chain: Chain;
  /** Contract addresses */
  contracts: V4Contracts;
  /** Cache adapter */
  cache: CacheAdapter;
  /** Default deadline offset in seconds */
  defaultDeadline: number;
  /** Default slippage tolerance in basis points */
  defaultSlippageTolerance: number;
};

/**
 * Main class for interacting with Uniswap V4 contracts.
 * Provides a flexible and scalable way to interact with different chains
 * and contracts without requiring multiple instances.
 */
export class UniswapSDK {
  private instance: UniswapSDKInstance;

  private constructor(
    client: PublicClient,
    chain: Chain,
    contracts: V4Contracts,
    cache: CacheAdapter,
    defaultDeadline: number,
    defaultSlippageTolerance: number,
  ) {
    this.instance = {
      client,
      chain,
      contracts,
      cache,
      defaultDeadline,
      defaultSlippageTolerance,
    };
  }

  /**
   * Creates a SDK instance for a specific chain.
   *
   * @param client - Viem public client for the target chain
   * @param chainId - Chain ID for the target network (defaults to client.chain.id)
   * @param options - Optional configuration: contracts, cache, defaultDeadline, defaultSlippageTolerance
   */
  public static create(client: PublicClient, chainId: number, options: UniswapSDKOptions = {}): UniswapSDK {
    const chain = getChainById(chainId);
    const uniswapContracts = getUniswapContracts(chainId);

    const {
      contracts,
      cache = createDefaultCache(),
      defaultDeadline = 10 * 60, // 10 minutes
      defaultSlippageTolerance = 50, // 0.5%
    } = options;

    const resolvedContracts =
      contracts ??
      ({
        poolManager: uniswapContracts.v4.poolManager,
        positionManager: uniswapContracts.v4.positionManager,
        quoter: uniswapContracts.v4.quoter,
        stateView: uniswapContracts.v4.stateView,
        universalRouter: uniswapContracts.utility.universalRouter,
        permit2: uniswapContracts.utility.permit2,
      } satisfies V4Contracts);

    return new UniswapSDK(client, chain, resolvedContracts, cache, defaultDeadline, defaultSlippageTolerance);
  }

  /**
   * Returns the default deadline offset in seconds.
   */
  public get defaultDeadline(): number {
    return this.instance.defaultDeadline;
  }

  /**
   * Returns the default slippage tolerance in basis points.
   */
  public get defaultSlippageTolerance(): number {
    return this.instance.defaultSlippageTolerance;
  }

  /**
   * Returns the address of a specific contract.
   * @param name @type {keyof V4Contracts}
   * @returns The address of the specified contract.
   * @throws Will throw an error if the contract address is not found.
   */
  public getContractAddress(name: keyof V4Contracts): Address {
    const address = this.instance.contracts[name];
    if (!address) {
      throw new Error(`Contract address for ${name} not found.`);
    }
    return address;
  }

  /**
   * Creates a Uniswap V4 Pool instance by fetching real-time pool state from the blockchain.
   *
   * This method uses multicall to efficiently fetch pool data from the V4StateView contract,
   * calling getSlot0() and getLiquidity() in a single transaction. It then uses the Uniswap V4 SDK's
   * Pool constructor with the live data to create a fully initialized pool instance.
   *
   * @param args @type {PoolArgs} - Pool configuration including currencies, fee tier, tick spacing, and hooks
   * @returns Promise<Pool> - A fully initialized Pool instance with current market state
   * @throws Error if pool data cannot be fetched or pool doesn't exist
   */
  public async getPool(args: PoolArgs): Promise<Pool> {
    return getPool(args, this.instance);
  }

  /**
   * Fetches ERC20 token metadata and creates Currency instances using Uniswap SDK-Core.
   *
   * This method uses multicall to efficiently fetch symbol(), name(), and decimals() from multiple
   * ERC20 tokens in a single transaction. For native currency (ETH), it creates an Ether instance
   * using the chain ID. For ERC20 tokens, it creates Token instances with the fetched metadata.
   *
   * @param args @type {GetTokensArgs} - Array of token addresses to fetch
   * @returns Promise<Currency[]> - Array of Currency instances (Token or Ether)
   * @throws Error if token data cannot be fetched from the blockchain
   */
  public async getTokens(args: GetTokensArgs): Promise<Currency[]> {
    return getTokens(args, this.instance);
  }

  /**
   * Simulates a token swap using the V4 Quoter contract to get exact output amounts and gas estimates.
   *
   * This method uses client.simulateContract() to call V4Quoter.quoteExactInputSingle() and simulate
   * the swap without executing it. It provides accurate pricing information and gas estimates for
   * the transaction without requiring multicall since it's a single contract simulation.
   *
   * @param args @type {SwapExactInSingle} - Swap parameters including pool key, amount in, and direction
   * @returns Promise<QuoteResponse> - Quote data with amount out, gas estimate, and timestamp
   * @throws Error if simulation fails or contract call reverts
   */
  public async getQuote(args: SwapExactInSingle): Promise<QuoteResponse> {
    return getQuote(args, this.instance);
  }

  /**
   * Fetches tick information for a given pool key and tick from V4 StateView.
   *
   * This method uses client.readContract() to call V4StateView.getTickInfo() and retrieve
   * tick data including liquidity and fee growth information. It first creates Token instances
   * from the pool key currencies, computes the PoolId, and then reads the tick info from the
   * blockchain.
   *
   * @param args - Tick query parameters including pool key and tick index
   * @returns Promise<TickInfoResponse> - Tick information including liquidity and fee growth data
   * @throws Error if tick data cannot be fetched or contract call reverts
   */
  public async getTickInfo(args: GetTickInfoArgs): Promise<TickInfoResponse> {
    return getTickInfo(args, this.instance);
  }

  /**
   * Retrieves a complete Uniswap V4 position instance with pool and token information.
   *
   * This method fetches position details and builds a fully initialized Position instance
   * using the Uniswap V4 SDK. It includes the pool state, token metadata, position
   * liquidity data, and current pool tick, providing a comprehensive view of the position.
   *
   * @param tokenId - The NFT token ID of the position
   * @returns Promise<GetPositionResponse> - Complete position data including position instance, pool, tokens, pool ID, and current tick
   * @throws Error if position data cannot be fetched, position doesn't exist, or liquidity is 0
   */
  public async getPosition(tokenId: string): Promise<GetPositionResponse> {
    return getPosition(tokenId, this.instance);
  }

  /**
   * Retrieves basic position information without SDK instances.
   *
   * This method fetches raw position data from the blockchain and returns it without creating
   * SDK instances. It's more efficient when you only need position metadata (tick range, liquidity,
   * pool key) without requiring Position or Pool objects. Also fetches pool state (slot0 and
   * liquidity) to avoid redundant calls when building full position instances.
   *
   * Use this method when:
   * - Displaying position information in a UI
   * - Checking if a position exists
   * - Getting position metadata without SDK operations
   *
   * Use `getPosition()` instead when you need SDK instances for swaps, calculations, or other operations.
   *
   * @param tokenId - The NFT token ID of the position
   * @returns Promise<GetPositionInfoResponse> - Basic position information with pool state
   * @throws Error if position data cannot be fetched or position doesn't exist
   */
  public async getPositionInfo(tokenId: string): Promise<GetPositionInfoResponse> {
    return getPositionInfo(tokenId, this.instance);
  }

  /**
   * Calculates uncollected (accrued but not yet collected) fees for a given position NFT.
   *
   * This method uses StateView.getPositionInfo to get the position's last fee growth snapshot,
   * and StateView.getFeeGrowthInside to get the current fee growth inside the tick range.
   * The difference, multiplied by the position's liquidity, gives the uncollected fees.
   *
   * @param tokenId - The NFT token ID of the position
   * @returns Promise<GetUncollectedFeesResponse> - Uncollected fee amounts for both tokens
   * @throws Error if position data cannot be fetched
   */
  public async getUncollectedFees(tokenId: string): Promise<GetUncollectedFeesResponse> {
    return getUncollectedFees(tokenId, this.instance);
  }

  /**
   * Generates Universal Router calldata for executing token swaps using Uniswap V4.
   *
   * This method uses the V4Planner from the Uniswap V4 SDK to build swap actions and parameters.
   * It creates SWAP_EXACT_IN_SINGLE actions with settle and take operations, and optionally
   * includes Permit2 signatures for token approvals. Fetches the current block timestamp to
   * compute the transaction deadline.
   *
   * @param args @type {BuildSwapCallDataArgs} - Swap configuration including pool, amounts, and recipient
   * @returns Promise<Hex> - Encoded Universal Router calldata ready for transaction execution
   * @throws Error if swap parameters are invalid or calldata generation fails
   */
  public async buildSwapCallData(args: BuildSwapCallDataArgs) {
    return buildSwapCallData(args, this.instance);
  }

  /**
   * Creates Position instances and generates V4PositionManager calldata for adding liquidity.
   *
   * This method uses Uniswap V3 SDK's Position.fromAmounts/fromAmount0/fromAmount1 to create positions,
   * and V4PositionManager.addCallParameters to generate the mint calldata. It handles both existing
   * pools and new pool creation, with support for Permit2 batch approvals and native currency handling.
   * No blockchain calls are made - this is purely a calldata generation method.
   *
   * @param args @type {BuildAddLiquidityArgs} - Liquidity parameters including amounts, tick range, and slippage
   * @returns Promise<BuildAddLiquidityCallDataResult> - Calldata and value for the mint transaction
   * @throws Error if position creation fails or invalid parameters are provided
   */
  public async buildAddLiquidityCallData(args: BuildAddLiquidityArgs): Promise<BuildAddLiquidityCallDataResult> {
    return buildAddLiquidityCallData(args, this.instance);
  }

  /**
   * Fetches position data and generates V4PositionManager calldata for removing liquidity.
   *
   * This method fetches the position from the blockchain via `getPosition()`, then uses
   * V4PositionManager.removeCallParameters to create burn calldata for reducing or completely
   * removing liquidity from a position. If no deadline is provided, it fetches the current
   * block timestamp to compute one.
   *
   * @param args @type {BuildRemoveLiquidityCallDataArgs} - Parameters for liquidity removal
   * @returns Promise - Calldata and value for the burn transaction
   * @throws Error if position data cannot be fetched or removal parameters are incorrect
   */
  public async buildRemoveLiquidityCallData(args: BuildRemoveLiquidityCallDataArgs) {
    return buildRemoveLiquidityCallData(args, this.instance);
  }

  /**
   * Fetches position data and generates V4PositionManager calldata for collecting fees.
   *
   * This method fetches the position from the blockchain via `getPosition()`, then uses
   * V4PositionManager.collectCallParameters to create calldata for collecting fees earned
   * by a liquidity position. It handles both currency0 and currency1 fee collection with
   * proper recipient addressing. If no deadline is provided, it fetches the current block
   * timestamp to compute one.
   *
   * @param args @type {BuildCollectFeesCallDataArgs} - Fee collection parameters
   * @returns Promise - Calldata and value for the collect transaction
   * @throws Error if position data cannot be fetched or collection parameters are incorrect
   */
  public async buildCollectFeesCallData(args: BuildCollectFeesCallDataArgs) {
    return buildCollectFeesCallData(args, this.instance);
  }

  /**
   * Prepares Permit2 batch approval data for multiple tokens using the Permit2 SDK.
   *
   * This method uses multicall to efficiently fetch allowance() data from the Permit2 contract
   * for multiple tokens in a single transaction. It creates batch permit structures that allow
   * the Universal Router to spend multiple tokens. Typically used for adding liquidity where
   * multiple token approvals are needed. Use the returned toSign.values for signing.
   *
   * @param args @type {PreparePermit2BatchDataArgs} - Batch permit parameters for multiple tokens
   * @returns Promise<PreparePermit2BatchDataResult> - Structured permit data ready for signing
   * @throws Error if permit data generation fails or parameters are invalid
   */
  public async preparePermit2BatchData(args: PreparePermit2BatchDataArgs): Promise<PreparePermit2BatchDataResult> {
    return preparePermit2BatchData(args, this.instance);
  }

  /**
   * Prepares Permit2 single token approval data using the Permit2 SDK.
   *
   * This method fetches the current allowance from the Permit2 contract and, if no
   * sigDeadline is provided, reads the current block timestamp. It then creates a single
   * permit structure that allows a spender to use one token. Typically used for swaps
   * where only one token approval is needed. Use the returned toSign.values for signing.
   *
   * @param args @type {PreparePermit2DataArgs} - Single permit parameters for one token
   * @returns Promise<PreparePermit2DataResult> - Structured permit data ready for signing
   * @throws Error if permit data generation fails or parameters are invalid
   */
  public async preparePermit2Data(args: PreparePermit2DataArgs): Promise<PreparePermit2DataResult> {
    return preparePermit2Data(args, this.instance);
  }
}
