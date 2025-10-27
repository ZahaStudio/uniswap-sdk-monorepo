import { getChainById } from '@/constants/chains'
import { FeeTier } from '@/types/utils/getPool'
import { buildAddLiquidityCallData } from '@/utils/buildAddLiquidityCallData'
import { buildCollectFeesCallData } from '@/utils/buildCollectFeesCallData'
import { buildRemoveLiquidityCallData } from '@/utils/buildRemoveLiquidityCallData'
import { buildSwapCallData } from '@/utils/buildSwapCallData'
import { getPool } from '@/utils/getPool'
import { getPositionDetails } from '@/utils/getPosition'
import { getQuote } from '@/utils/getQuote'
import { getTokens } from '@/utils/getTokens'
import { preparePermit2BatchData } from '@/utils/preparePermit2BatchData'
import { preparePermit2Data } from '@/utils/preparePermit2Data'
import type { BuildSwapCallDataArgs } from '@/types'
import type { UniDevKitV4Config, UniDevKitV4Instance } from '@/types/core'
import type {
  BuildAddLiquidityArgs,
  BuildAddLiquidityCallDataResult,
} from '@/types/utils/buildAddLiquidityCallData'
import type { GetPositionDetailsResponse } from '@/types/utils/getPosition'
import type { QuoteResponse, SwapExactInSingle } from '@/types/utils/getQuote'
import type { GetTokensArgs } from '@/types/utils/getTokens'
import type {
  PreparePermit2BatchDataArgs,
  PreparePermit2BatchDataResult,
  PreparePermit2DataArgs,
  PreparePermit2DataResult,
} from '@/types/utils/permit2'
import type { BuildCollectFeesCallDataArgs } from '@/types/utils/buildCollectFeesCallData'
import type { BuildRemoveLiquidityCallDataArgs } from '@/types/utils/buildRemoveLiquidityCallData'
import type { PoolArgs } from '@/types/utils/getPool'
import type { Currency } from '@uniswap/sdk-core'
import type { Pool } from '@uniswap/v4-sdk'
import { type Address, createPublicClient, http, type PublicClient } from 'viem'

/**
 * Main class for interacting with Uniswap V4 contracts.
 * Provides a flexible and scalable way to interact with different chains
 * and contracts without requiring multiple instances.
 */
export class UniDevKitV4 {
  private instance: UniDevKitV4Instance

  /**
   * Creates a new UniDevKitV4 instance.
   * @param config @type {UniDevKitV4Config}
   * @throws Will throw an error if the configuration is invalid.
   */
  constructor(config: UniDevKitV4Config) {
    const chain = getChainById(config.chainId)
    const client = createPublicClient({
      chain,
      transport: http(config.rpcUrl || chain.rpcUrls.default.http[0]),
    })

    this.instance = {
      client: client as PublicClient,
      chain,
      contracts: config.contracts,
    }
  }

  /**
   * Returns the FeeTier enum for accessing standard fee tiers.
   * @returns The FeeTier enum containing LOWEST, LOW, MEDIUM, and HIGH fee tiers
   */
  public getFeeTier(): typeof FeeTier {
    return FeeTier
  }

  /**
   * Returns the address of a specific contract.
   * @param name @type {keyof UniDevKitV4Config["contracts"]}
   * @returns The address of the specified contract.
   * @throws Will throw an error if the contract address is not found.
   */
  public getContractAddress(name: keyof UniDevKitV4Config['contracts']): Address {
    const address = this.instance.contracts[name]
    if (!address) {
      throw new Error(`Contract address for ${name} not found.`)
    }
    return address
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
    return getPool(args, this.instance)
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
    return getTokens(args, this.instance)
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
    return getQuote(args, this.instance)
  }

  /**
   * Fetches detailed position information from the V4 PositionManager contract.
   *
   * This method uses multicall to efficiently call V4PositionManager.getPoolAndPositionInfo() and
   * getPositionLiquidity() in a single transaction. It retrieves the position's tick range, liquidity,
   * and associated pool key, then decodes the raw position data to provide structured information.
   *
   * @param tokenId - The NFT token ID of the position
   * @returns Promise<GetPositionDetailsResponse> - Position details including tick range, liquidity, and pool key
   * @throws Error if position data cannot be fetched or position doesn't exist
   */
  public async getPositionDetails(tokenId: string): Promise<GetPositionDetailsResponse> {
    return getPositionDetails(tokenId, this.instance)
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
    return buildSwapCallData(args)
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
  public async buildAddLiquidityCallData(
    args: BuildAddLiquidityArgs,
  ): Promise<BuildAddLiquidityCallDataResult> {
    return buildAddLiquidityCallData(args, this.instance)
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
    return buildRemoveLiquidityCallData(args, this.instance)
  }

  /**
   * Generates V4PositionManager calldata for collecting accumulated fees from positions.
   *
   * This method uses V4PositionManager.collectCallParameters to create calldata for
   * collecting fees earned by a liquidity position. It handles both token0 and token1
   * fee collection with proper recipient addressing. No blockchain calls are made -
   * this is purely a calldata generation method.
   *
   * @param args @type {BuildCollectFeesCallDataArgs} - Fee collection parameters
   * @returns Promise - Calldata and value for the collect transaction
   * @throws Error if position data is invalid or collection parameters are incorrect
   */
  public async buildCollectFeesCallData(args: BuildCollectFeesCallDataArgs) {
    return buildCollectFeesCallData(args, this.instance)
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
  public async preparePermit2BatchData(
    args: PreparePermit2BatchDataArgs,
  ): Promise<PreparePermit2BatchDataResult> {
    return preparePermit2BatchData(args, this.instance)
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
    return preparePermit2Data(args, this.instance)
  }
}
