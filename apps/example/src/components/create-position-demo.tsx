"use client";

import { useState, useMemo, useCallback } from "react";

import { useCreatePosition, useToken, type AddLiquidityStep } from "@zahastudio/uniswap-sdk-react";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { DetailRow } from "@/components/detail-row";
import { PoolTab } from "@/components/pool-tab";
import { RefreshButton } from "@/components/refresh-button";
import { StepList, type StepItem } from "@/components/step-list";
import { TokenInput } from "@/components/token-input";
import { TransactionStatus } from "@/components/transaction-status";
import {
  ETH_USDC_POOL,
  USDC_USDT_POOL,
  type PoolPreset,
  type TokenInfo,
  buildTokenInfo,
  parseTokenAmount,
} from "@/lib/tokens";
import { cn, shouldShowExecutionError, placeholderToken } from "@/lib/utils";

const POSITION_PRESETS: PoolPreset[] = [ETH_USDC_POOL, USDC_USDT_POOL];

export function CreatePositionDemo() {
  const { address, isConnected } = useAccount();

  const [selectedPreset, setSelectedPreset] = useState<PoolPreset>(POSITION_PRESETS[0]!);
  const [amount0Input, setAmount0Input] = useState("");
  const [amount1Input, setAmount1Input] = useState("");
  const [tickLowerInput, setTickLowerInput] = useState("");
  const [tickUpperInput, setTickUpperInput] = useState("");
  const [lastEdited, setLastEdited] = useState<0 | 1>(0);

  const handlePresetChange = useCallback((preset: PoolPreset) => {
    setSelectedPreset(preset);
    setAmount0Input("");
    setAmount1Input("");
    setTickLowerInput("");
    setTickUpperInput("");
  }, []);

  const { poolKey } = selectedPreset;

  const { query: currency0Query } = useToken(
    { tokenAddress: poolKey.currency0 as Address },
    { enabled: true, chainId: 1 },
  );
  const { query: currency1Query } = useToken(
    { tokenAddress: poolKey.currency1 as Address },
    { enabled: true, chainId: 1 },
  );

  const token0: TokenInfo = currency0Query.data
    ? buildTokenInfo(
        currency0Query.data.token.address,
        currency0Query.data.token.symbol,
        currency0Query.data.token.name,
        currency0Query.data.token.decimals,
      )
    : placeholderToken(poolKey.currency0 as Address);

  const token1: TokenInfo = currency1Query.data
    ? buildTokenInfo(
        currency1Query.data.token.address,
        currency1Query.data.token.symbol,
        currency1Query.data.token.name,
        currency1Query.data.token.decimals,
      )
    : placeholderToken(poolKey.currency1 as Address);

  // Parse amounts — user edits one, the hook computes the other
  const parsedAmount0 = useMemo(() => parseTokenAmount(amount0Input, token0.decimals), [amount0Input, token0.decimals]);
  const parsedAmount1 = useMemo(() => parseTokenAmount(amount1Input, token1.decimals), [amount1Input, token1.decimals]);

  const create = useCreatePosition(
    {
      poolKey,
      amount0: lastEdited === 0 ? parsedAmount0 : undefined,
      amount1: lastEdited === 0 ? undefined : parsedAmount1,
      tickLower: tickLowerInput ? parseInt(tickLowerInput, 10) : undefined,
      tickUpper: tickUpperInput ? parseInt(tickUpperInput, 10) : undefined,
    },
    { chainId: 1 },
  );

  const { pool: poolQuery, steps, currentStep, executeAll, reset, position } = create;
  const pool = poolQuery.data?.pool;

  // Token balance queries
  const { query: token0BalQuery } = useToken(
    { tokenAddress: poolKey.currency0 as Address },
    { enabled: isConnected, chainId: 1, refetchInterval: 15_000 },
  );
  const { query: token1BalQuery } = useToken(
    { tokenAddress: poolKey.currency1 as Address },
    { enabled: isConnected, chainId: 1, refetchInterval: 15_000 },
  );

  const handleAmount0Change = useCallback((val: string) => {
    setAmount0Input(val);
    setLastEdited(0);
  }, []);
  const handleAmount1Change = useCallback((val: string) => {
    setAmount1Input(val);
    setLastEdited(1);
  }, []);
  const handleMax0Click = useCallback(() => {
    if (token0BalQuery.data?.balance) {
      setAmount0Input(token0BalQuery.data.balance.formatted);
      setLastEdited(0);
    }
  }, [token0BalQuery.data?.balance]);
  const handleMax1Click = useCallback(() => {
    if (token1BalQuery.data?.balance) {
      setAmount1Input(token1BalQuery.data.balance.formatted);
      setLastEdited(1);
    }
  }, [token1BalQuery.data?.balance]);

  // Derive auto-filled display values from the hook's position calculation
  const displayAmount0 = lastEdited === 0 || !position ? amount0Input : position.formattedAmount0;
  const displayAmount1 = lastEdited === 1 || !position ? amount1Input : position.formattedAmount1;

  const effectiveAmount0Raw = useMemo(
    () => parseTokenAmount(displayAmount0, token0.decimals),
    [displayAmount0, token0.decimals],
  );
  const effectiveAmount1Raw = useMemo(
    () => parseTokenAmount(displayAmount1, token1.decimals),
    [displayAmount1, token1.decimals],
  );

  const hasInsufficientToken0 =
    effectiveAmount0Raw > 0n &&
    token0BalQuery.data?.balance !== undefined &&
    effectiveAmount0Raw > token0BalQuery.data.balance.raw;
  const hasInsufficientToken1 =
    effectiveAmount1Raw > 0n &&
    token1BalQuery.data?.balance !== undefined &&
    effectiveAmount1Raw > token1BalQuery.data.balance.raw;
  const hasInsufficientBalance = hasInsufficientToken0 || hasInsufficientToken1;

  const insufficientBalanceError =
    hasInsufficientToken0 && hasInsufficientToken1
      ? `Insufficient ${token0.symbol} and ${token1.symbol} balance`
      : hasInsufficientToken0
        ? `Insufficient ${token0.symbol} balance`
        : hasInsufficientToken1
          ? `Insufficient ${token1.symbol} balance`
          : null;

  const isExecuteConfirmed = steps.execute.transaction.status === "confirmed";
  const txHash = steps.execute.transaction.txHash;

  const [executing, setExecuting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const handleExecuteAll = useCallback(async () => {
    if (!address) return;
    setTxError(null);
    if (insufficientBalanceError) {
      setTxError(insufficientBalanceError);
      return;
    }
    setExecuting(true);
    try {
      await executeAll({ recipient: address });
      token0BalQuery.refetch();
      token1BalQuery.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) setTxError(msg);
    } finally {
      setExecuting(false);
    }
  }, [address, executeAll, insufficientBalanceError, token0BalQuery, token1BalQuery]);

  const handleRefreshAll = useCallback(() => {
    poolQuery.refetch();
    token0BalQuery.refetch();
    token1BalQuery.refetch();
  }, [poolQuery, token0BalQuery, token1BalQuery]);

  const handleReset = useCallback(() => {
    reset();
    setTxError(null);
    setExecuting(false);
    setAmount0Input("");
    setAmount1Input("");
    token0BalQuery.refetch();
    token1BalQuery.refetch();
  }, [reset, token0BalQuery, token1BalQuery]);

  const hasAmount = parsedAmount0 > 0n || parsedAmount1 > 0n;

  return (
    <div className="flex w-full items-start justify-center gap-6">
      {/* Lifecycle panel (left) */}
      <div className="sticky top-6 hidden w-120 shrink-0 space-y-4 lg:block">
        {isConnected && hasAmount && pool ? (
          <>
            <AddLiquidityStepIndicator
              currentStep={currentStep}
              steps={steps}
              isNativeToken0={token0.address === zeroAddress}
              isNativeToken1={token1.address === zeroAddress}
            />
            {steps.execute.transaction.status !== "idle" && (
              <TransactionStatus
                status={steps.execute.transaction.status}
                txHash={txHash}
              />
            )}
          </>
        ) : (
          <div className="border-border-muted bg-surface rounded-xl border p-4">
            <div className="text-text-muted mb-3 text-xs font-medium">Create position lifecycle</div>
            <p className="text-text-muted text-xs">
              {!isConnected
                ? "Connect wallet to begin"
                : poolQuery.isLoading
                  ? "Loading pool data..."
                  : !hasAmount
                    ? "Enter amounts and tick range"
                    : "Loading..."}
            </p>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="w-full max-w-120 min-w-120 space-y-4">
        {/* Pool selector tabs */}
        <div className="flex gap-2">
          {POSITION_PRESETS.map((preset) => (
            <PoolTab
              key={preset.poolId}
              preset={preset}
              isSelected={selectedPreset.poolId === preset.poolId}
              onClick={() => handlePresetChange(preset)}
            />
          ))}
        </div>

        {/* Pool info */}
        {pool && (
          <div className="border-border-muted bg-surface rounded-2xl border p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-text-muted text-xs font-medium">Pool Info</span>
              <RefreshButton
                onClick={handleRefreshAll}
                disabled={executing || isExecuteConfirmed}
                spinning={poolQuery.isFetching}
              />
            </div>
            <div className="bg-surface-raised space-y-1.5 rounded-xl p-3">
              <DetailRow
                label="Fee tier"
                value={`${pool.fee / 10000}%`}
              />
              <DetailRow
                label="Tick spacing"
                value={pool.tickSpacing.toString()}
              />
              <DetailRow
                label="Current tick"
                value={pool.tickCurrent.toString()}
              />
              <DetailRow
                label="Current price"
                value={`${pool.token0Price.toSignificant(6)} ${token1.symbol} per ${token0.symbol}`}
              />
              <DetailRow
                label="Liquidity"
                value={pool.liquidity.toString()}
              />
            </div>
          </div>
        )}

        {poolQuery.isLoading && (
          <div className="border-border-muted bg-surface flex items-center justify-center rounded-2xl border p-6">
            <div className="text-text-secondary animate-pulse text-sm">Loading pool...</div>
          </div>
        )}

        {poolQuery.error && (
          <div className="bg-error-muted text-error rounded-xl p-3 text-xs">{poolQuery.error.message}</div>
        )}

        {/* Tick range + Amount inputs */}
        <div className="border-border-muted bg-surface rounded-2xl border p-4">
          {/* Tick range sliders */}
          {pool && (
            <TickRangeSliders
              pool={pool}
              tickLowerInput={tickLowerInput}
              tickUpperInput={tickUpperInput}
              onTickLowerChange={setTickLowerInput}
              onTickUpperChange={setTickUpperInput}
              disabled={executing || isExecuteConfirmed}
            />
          )}

          {/* Amount inputs */}
          <TokenInput
            label={`${token0.symbol} amount`}
            token={token0}
            value={displayAmount0}
            onChange={handleAmount0Change}
            disabled={executing || isExecuteConfirmed}
            balance={token0BalQuery.data?.balance?.formatted}
            balanceLoading={token0BalQuery.isLoading}
            onMaxClick={handleMax0Click}
          />

          {/* Plus divider */}
          <div className="relative my-1 flex items-center justify-center">
            <div className="bg-border-muted absolute inset-x-0 top-1/2 h-px" />
            <div className="border-border-muted bg-surface-raised relative z-10 flex h-8 w-8 items-center justify-center rounded-lg border">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="text-text-secondary"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <TokenInput
            label={`${token1.symbol} amount`}
            token={token1}
            value={displayAmount1}
            onChange={handleAmount1Change}
            disabled={executing || isExecuteConfirmed}
            balance={token1BalQuery.data?.balance?.formatted}
            balanceLoading={token1BalQuery.isLoading}
            onMaxClick={handleMax1Click}
          />

          {/* Error display */}
          {(insufficientBalanceError || txError) && (
            <div className="bg-error-muted text-error mt-3 rounded-lg p-3 text-xs">
              {insufficientBalanceError ?? txError}
            </div>
          )}

          {/* Action button */}
          <div className="mt-4">
            {!isConnected ? (
              <ConnectWalletButton />
            ) : isExecuteConfirmed ? (
              <button
                onClick={handleReset}
                className="bg-success/10 text-success hover:bg-success/20 w-full rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
              >
                Create another position
              </button>
            ) : (
              <button
                onClick={handleExecuteAll}
                disabled={executing || !hasAmount || !pool || poolQuery.isLoading || hasInsufficientBalance}
                className={cn(
                  "glow-accent w-full rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]",
                  "bg-accent hover:bg-accent-hover text-white",
                  "disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
                )}
              >
                {executing
                  ? getStepActionLabel(currentStep) + "..."
                  : !hasAmount
                    ? "Enter an amount"
                    : "Create Position"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TickRangeSliders({
  pool,
  tickLowerInput,
  tickUpperInput,
  onTickLowerChange,
  onTickUpperChange,
  disabled,
}: {
  pool: { tickSpacing: number; tickCurrent: number };
  tickLowerInput: string;
  tickUpperInput: string;
  onTickLowerChange: (val: string) => void;
  onTickUpperChange: (val: string) => void;
  disabled: boolean;
}) {
  const ts = pool.tickSpacing;
  const centerTick = Math.round(pool.tickCurrent / ts) * ts;
  const sliderMin = centerTick - 100 * ts;
  const sliderMax = centerTick + 100 * ts;
  const lowerValue = tickLowerInput ? parseInt(tickLowerInput, 10) : sliderMin;
  const upperValue = tickUpperInput ? parseInt(tickUpperInput, 10) : sliderMax;

  const snapToTick = (val: number) => (Math.round(val / ts) * ts).toString();

  return (
    <div className="mb-4">
      <div className="text-text-muted mb-2 text-xs font-medium">
        Tick Range <span className="text-text-muted/60">(current tick: {pool.tickCurrent})</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <TickSlider
          label="Lower tick"
          value={lowerValue}
          min={sliderMin}
          max={sliderMax}
          step={ts}
          onChange={(v) => onTickLowerChange(snapToTick(v))}
          disabled={disabled}
        />
        <TickSlider
          label="Upper tick"
          value={upperValue}
          min={sliderMin}
          max={sliderMax}
          step={ts}
          onChange={(v) => onTickUpperChange(snapToTick(v))}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function TickSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="bg-surface-raised rounded-xl p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-text-muted text-[10px] font-medium">{label}</label>
        <span className="text-text font-mono text-xs font-medium">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="accent-accent w-full"
      />
      <div className="text-text-muted mt-1 flex justify-between text-[10px]">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function getStepActionLabel(step: AddLiquidityStep): string {
  switch (step) {
    case "approval0":
      return "Approve token0";
    case "approval1":
      return "Approve token1";
    case "permit2":
      return "Sign permit";
    case "execute":
      return "Create position";
    case "completed":
      return "Completed";
  }
}

function AddLiquidityStepIndicator({
  currentStep,
  steps,
  isNativeToken0,
  isNativeToken1,
}: {
  currentStep: AddLiquidityStep;
  steps: ReturnType<typeof useCreatePosition>["steps"];
  isNativeToken0: boolean;
  isNativeToken1: boolean;
}) {
  const order: AddLiquidityStep[] = ["approval0", "approval1", "permit2", "execute", "completed"];

  function getStatus(stepId: AddLiquidityStep): StepItem["status"] {
    if (currentStep === "completed") return "completed";
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepId);
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  }

  function getLoading(stepId: AddLiquidityStep): string | undefined {
    if (stepId === "approval0") {
      if (steps.approvalToken0.transaction.status === "pending") return "Awaiting wallet...";
      if (steps.approvalToken0.transaction.status === "confirming") return "Confirming...";
    }
    if (stepId === "approval1") {
      if (steps.approvalToken1.transaction.status === "pending") return "Awaiting wallet...";
      if (steps.approvalToken1.transaction.status === "confirming") return "Confirming...";
    }
    if (stepId === "permit2" && steps.permit2.isPending) return "Awaiting signature...";
    if (stepId === "execute") {
      if (steps.execute.transaction.status === "pending") return "Awaiting wallet...";
      if (steps.execute.transaction.status === "confirming") return "Confirming...";
    }
    return undefined;
  }

  const stepDefs: StepItem[] = [
    ...(isNativeToken0
      ? []
      : [{ id: "approval0", label: "Approve Token0", description: "Allow Permit2 to spend token0" }]),
    ...(isNativeToken1
      ? []
      : [{ id: "approval1", label: "Approve Token1", description: "Allow Permit2 to spend token1" }]),
    ...(!isNativeToken0 || !isNativeToken1
      ? [{ id: "permit2", label: "Permit2", description: "Sign off-chain spending permit" }]
      : []),
    { id: "execute", label: "Create Position", description: "Mint the position NFT" },
  ].map((s) => ({
    ...s,
    status: getStatus(s.id as AddLiquidityStep),
    loadingLabel: getLoading(s.id as AddLiquidityStep),
  }));

  return (
    <StepList
      title="Create position lifecycle"
      steps={stepDefs}
    />
  );
}
