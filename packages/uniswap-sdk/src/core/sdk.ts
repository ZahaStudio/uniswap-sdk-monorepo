import type { Currency } from "@uniswap/sdk-core";
import type { Pool } from "@uniswap/v4-sdk";
import { getUniswapContracts } from "hookmate";
import { type Address, type Chain, type PublicClient } from "viem";

import { getChainById } from "@/constants/chains";
import { createDefaultCache, type CacheAdapter } from "@/helpers/cache";
import type { BuildSwapCallDataArgs } from "@/types";
import type { UniswapSDKInstance, V4Contracts } from "@/types/core";
import type { BuildAddLiquidityArgs, BuildAddLiquidityCallDataResult } from "@/types/utils/buildAddLiquidityCallData";
import type { BuildCollectFeesCallDataArgs } from "@/types/utils/buildCollectFeesCallData";
import type { BuildRemoveLiquidityCallDataArgs } from "@/types/utils/buildRemoveLiquidityCallData";
import type { PoolArgs } from "@/types/utils/getPool";
import type { GetPositionInfoResponse, GetPositionResponse } from "@/types/utils/getPosition";
import type { QuoteResponse, SwapExactInSingle } from "@/types/utils/getQuote";
import type { GetTickInfoArgs, TickInfoResponse } from "@/types/utils/getTickInfo";
import type { GetTokensArgs } from "@/types/utils/getTokens";
import type {
  PreparePermit2BatchDataArgs,
  PreparePermit2BatchDataResult,
  PreparePermit2DataArgs,
  PreparePermit2DataResult,
} from "@/types/utils/permit2";
import { buildAddLiquidityCallData } from "@/utils/buildAddLiquidityCallData";
import { buildCollectFeesCallData } from "@/utils/buildCollectFeesCallData";
import { buildRemoveLiquidityCallData } from "@/utils/buildRemoveLiquidityCallData";
import { buildSwapCallData } from "@/utils/buildSwapCallData";
import { getPool } from "@/utils/getPool";
import { getPosition } from "@/utils/getPosition";
import { getPositionInfo } from "@/utils/getPositionInfo";
import { getQuote } from "@/utils/getQuote";
import { getTickInfo } from "@/utils/getTickInfo";
import { getTokens } from "@/utils/getTokens";
import { preparePermit2BatchData } from "@/utils/preparePermit2BatchData";
import { preparePermit2Data } from "@/utils/preparePermit2Data";

/**
 * Main class for interacting with Uniswap V4 contracts.
 * Provides a flexible and scalable way to interact with different chains
 * and contracts without requiring multiple instances.
 */
export class UniswapSDK {
  private instance: UniswapSDKInstance;

  private constructor(client: PublicClient, chain: Chain, contracts: V4Contracts, cache?: CacheAdapter) {
    if (!cache) {
      cache = createDefaultCache();
    }
    this.instance = {
      client,
      chain,
      contracts,
      cache
    };
  }

  public static async create(client: PublicClient, contracts?: V4Contracts): Promise<UniswapSDK> {
    const chainId = await client.getChainId();
    const chain = getChainById(chainId);
    const uniswapContracts = getUniswapContracts(chainId);

    if (!contracts) {
      contracts = {
        poolManager: uniswapContracts.v4.poolManager,
        positionManager: uniswapContracts.v4.positionManager,
        quoter: uniswapContracts.v4.quoter,
        stateView: uniswapContracts.v4.stateView,
        universalRouter: uniswapContracts.utility.universalRouter,
      } as V4Contracts;
    }

    return new UniswapSDK(client, chain, contracts);
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
   * Generates Universal Router calldata for executing token swaps using Uniswap V4.
   *
   * This method uses the V4Planner from the Uniswap V4 SDK to build swap actions and parameters.
   * It creates SWAP_EXACT_IN_SINGLE actions with settle and take operations, and optionally
   * includes Permit2 signatures for token approvals. No blockchain calls are made - this is
   * purely a calldata generation method that returns Universal Router calldata.
   *
   * @param args @type {BuildSwapCallDataArgs} - Swap configuration including pool, amounts, and recipient
   * @returns Hex - Encoded Universal Router calldata ready for transaction execution
   * @throws Error if swap parameters are invalid or calldata generation fails
   */
  public buildSwapCallData(args: BuildSwapCallDataArgs) {
    return buildSwapCallData(args);
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
   * Generates V4PositionManager calldata for removing liquidity from existing positions.
   *
   * This method uses V4PositionManager.removeCallParameters to create burn calldata for
   * reducing or completely removing liquidity from a position. It calculates the appropriate
   * amounts based on the liquidity percentage to remove. No blockchain calls are made -
   * this is purely a calldata generation method.
   *
   * @param args @type {BuildRemoveLiquidityCallDataArgs} - Parameters for liquidity removal
   * @returns Promise - Calldata and value for the burn transaction
   * @throws Error if position data is invalid or removal parameters are incorrect
   */
  public async buildRemoveLiquidityCallData(args: BuildRemoveLiquidityCallDataArgs) {
    return buildRemoveLiquidityCallData(args, this.instance);
  }

  /**
   * Generates V4PositionManager calldata for collecting accumulated fees from positions.
   *
   * This method uses V4PositionManager.collectCallParameters to create calldata for
   * collecting fees earned by a liquidity position. It handles both currency0 and currency1
   * fee collection with proper recipient addressing. No blockchain calls are made -
   * this is purely a calldata generation method.
   *
   * @param args @type {BuildCollectFeesCallDataArgs} - Fee collection parameters
   * @returns Promise - Calldata and value for the collect transaction
   * @throws Error if position data is invalid or collection parameters are incorrect
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
   * This method creates a single permit structure that allows the Universal Router to spend
   * one token. It's typically used for swaps where only one token approval is needed.
   * No blockchain calls are made - this is purely a permit data generation method.
   * Use the returned toSign.values for signing the permit data.
   *
   * @param args @type {PreparePermit2DataArgs} - Single permit parameters for one token
   * @returns Promise<PreparePermit2DataResult> - Structured permit data ready for signing
   * @throws Error if permit data generation fails or parameters are invalid
   */
  public async preparePermit2Data(args: PreparePermit2DataArgs): Promise<PreparePermit2DataResult> {
    return preparePermit2Data(args, this.instance);
  }
}
