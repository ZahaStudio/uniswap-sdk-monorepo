import { Ether, Percent, Token } from "@uniswap/sdk-core";
import type { Currency } from "@uniswap/sdk-core";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";
import { nearestUsableTick, TickMath } from "@uniswap/v3-sdk";
import { Actions, Pool, Position, V4Planner, V4PositionManager } from "@uniswap/v4-sdk";
import { getUniswapContracts } from "hookmate";
import { utility, v4 } from "hookmate/abi";
import { createPublicClient, encodeFunctionData, http } from "viem";
import type { Address } from "viem";
import { unichain } from "viem/chains";

import { ACTIVE_POSITION_TOKEN_ID, TEST_RECIPIENT } from "../test/integration/constants.ts";

type PoolKeyInput = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

const recipient = TEST_RECIPIENT as Address;
const poolKeyInput: PoolKeyInput = {
  currency0: "0x0000000000000000000000000000000000000000",
  currency1: "0x078d782b760474a361dda0af3839290b0ef57ad6",
  fee: 500,
  tickSpacing: 10,
  hooks: "0x0000000000000000000000000000000000000000",
};

const UNICHAIN_FORK_BLOCK_NUMBER = 39629268n;

const client = createPublicClient({
  chain: unichain,
  transport: http("https://mainnet.unichain.org"),
});

const contracts = getUniswapContracts(unichain.id);
const stateView = contracts.v4.stateView;
const positionManager = contracts.v4.positionManager;

const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

function decodeInt24FromInfo(info: bigint, shift: number): number {
  const raw = (info >> BigInt(shift)) & 0xffffffn;
  return raw >= 0x800000n ? Number(raw - 0x1000000n) : Number(raw);
}

async function currencyFromAddress(address: Address): Promise<Currency> {
  if (address.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    return Ether.onChain(unichain.id);
  }

  const [decimals, symbol, name] = await Promise.all([
    client.readContract({ address, abi: ERC20_ABI, functionName: "decimals", blockNumber: UNICHAIN_FORK_BLOCK_NUMBER }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "symbol", blockNumber: UNICHAIN_FORK_BLOCK_NUMBER }),
    client.readContract({ address, abi: ERC20_ABI, functionName: "name", blockNumber: UNICHAIN_FORK_BLOCK_NUMBER }),
  ]);

  return new Token(unichain.id, address, Number(decimals), symbol, name);
}

async function buildPoolFromPoolKey(poolKey: PoolKeyInput): Promise<{ pool: Pool }> {
  const [currency0, currency1] = await Promise.all([
    currencyFromAddress(poolKey.currency0),
    currencyFromAddress(poolKey.currency1),
  ]);

  const poolId = Pool.getPoolId(currency0, currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks);

  const [slot0, liquidity] = await Promise.all([
    client.readContract({
      address: stateView,
      abi: v4.StateViewArtifact.abi,
      functionName: "getSlot0",
      args: [poolId],
      blockNumber: UNICHAIN_FORK_BLOCK_NUMBER,
    }),
    client.readContract({
      address: stateView,
      abi: v4.StateViewArtifact.abi,
      functionName: "getLiquidity",
      args: [poolId],
      blockNumber: UNICHAIN_FORK_BLOCK_NUMBER,
    }),
  ]);

  const [sqrtPriceX96, tick] = slot0 as readonly [bigint, number, bigint, bigint];

  return {
    pool: new Pool(
      currency0,
      currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
      sqrtPriceX96.toString(),
      (liquidity as bigint).toString(),
      tick,
    ),
  };
}

async function getPositionFromChain(tokenId: string): Promise<{ position: Position }> {
  const [poolAndPositionInfo, positionLiquidity] = await Promise.all([
    client.readContract({
      address: positionManager,
      abi: v4.PositionManagerArtifact.abi,
      functionName: "getPoolAndPositionInfo",
      args: [BigInt(tokenId)],
      blockNumber: UNICHAIN_FORK_BLOCK_NUMBER,
    }),
    client.readContract({
      address: positionManager,
      abi: v4.PositionManagerArtifact.abi,
      functionName: "getPositionLiquidity",
      args: [BigInt(tokenId)],
      blockNumber: UNICHAIN_FORK_BLOCK_NUMBER,
    }),
  ]);

  const [poolKey, packedInfo] = poolAndPositionInfo as readonly [PoolKeyInput, bigint];
  const tickLower = decodeInt24FromInfo(packedInfo, 8);
  const tickUpper = decodeInt24FromInfo(packedInfo, 32);

  const { pool } = await buildPoolFromPoolKey(poolKey);

  return {
    position: new Position({
      pool,
      liquidity: (positionLiquidity as bigint).toString(),
      tickLower,
      tickUpper,
    }),
  };
}

const { pool } = await buildPoolFromPoolKey(poolKeyInput);

const v4Planner = new V4Planner();
v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
  {
    poolKey: pool.poolKey,
    zeroForOne: false,
    amountIn: "1000000",
    amountOutMinimum: "0",
    hookData: "0x",
  },
]);
v4Planner.addSettle(pool.currency1, true);
v4Planner.addTake(pool.currency0, recipient);

const routePlanner = new RoutePlanner();
routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.finalize()]);

const swapCalldata = encodeFunctionData({
  abi: utility.UniversalRouterArtifact.abi,
  functionName: "execute",
  args: [routePlanner.commands, routePlanner.inputs, 1767225900n],
});

const slippage100Bips = new Percent(100, 10_000);
const addPosition = Position.fromAmount0({
  pool,
  tickLower: nearestUsableTick(TickMath.MIN_TICK, pool.tickSpacing),
  tickUpper: nearestUsableTick(TickMath.MAX_TICK, pool.tickSpacing),
  amount0: "100000000000000",
  useFullPrecision: true,
});

const addParams = V4PositionManager.addCallParameters(addPosition, {
  recipient: TEST_RECIPIENT,
  slippageTolerance: slippage100Bips,
  deadline: "1770378227",
  createPool: false,
  sqrtPriceX96: pool.sqrtRatioX96.toString(),
  useNative: pool.currency0.isNative ? pool.currency0 : pool.currency1.isNative ? pool.currency1 : undefined,
});

const { position } = await getPositionFromChain(ACTIVE_POSITION_TOKEN_ID);

const removeParams = V4PositionManager.removeCallParameters(position, {
  slippageTolerance: slippage100Bips,
  deadline: "1770378227",
  liquidityPercentage: new Percent(100, 10_000),
  tokenId: ACTIVE_POSITION_TOKEN_ID,
});

const collectParams = V4PositionManager.collectCallParameters(position, {
  tokenId: ACTIVE_POSITION_TOKEN_ID,
  recipient,
  slippageTolerance: new Percent(0, 10_000),
  deadline: "1770378227",
  hookData: "0x",
});

console.log("buildSwapCallData calldata:", swapCalldata);
console.log("buildAddLiquidityCallData calldata:", addParams.calldata);
console.log("buildAddLiquidityCallData value:", addParams.value);
console.log("buildRemoveLiquidityCallData calldata:", removeParams.calldata);
console.log("buildRemoveLiquidityCallData value:", removeParams.value);
console.log("buildCollectFeesCallData calldata:", collectParams.calldata);
console.log("buildCollectFeesCallData value:", collectParams.value);
