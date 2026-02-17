"use client";

import { useState, useMemo, useCallback } from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useCreatePosition, useToken, type AddLiquidityStep } from "@zahastudio/uniswap-sdk-react";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";

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
import { cn } from "@/lib/utils";

/** Presets available for position creation (subset of all pools). */
const POSITION_PRESETS: PoolPreset[] = [ETH_USDC_POOL, USDC_USDT_POOL];

function shouldShowExecutionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return !normalized.includes("user rejected") && !normalized.includes("user denied");
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

/** Fallback TokenInfo while on-chain data is loading. */
function placeholderToken(address: Address): TokenInfo {
  return buildTokenInfo(address, "...", "", 18);
}

export function CreatePositionDemo() {
  const { address, isConnected } = useAccount();

  const [selectedPreset, setSelectedPreset] = useState<PoolPreset>(POSITION_PRESETS[0]!);
  const [amount0Input, setAmount0Input] = useState("");
  const [amount1Input, setAmount1Input] = useState("");
  const [tickLowerInput, setTickLowerInput] = useState("");
  const [tickUpperInput, setTickUpperInput] = useState("");
  // Track which currency was last manually edited (0 = currency0, 1 = currency1)
  const [lastEdited, setLastEdited] = useState<0 | 1>(0);

  const handlePresetChange = useCallback((preset: PoolPreset) => {
    setSelectedPreset(preset);
    setAmount0Input("");
    setAmount1Input("");
    setTickLowerInput("");
    setTickUpperInput("");
  }, []);

  const { poolKey } = selectedPreset;

  // Fetch on-chain token metadata for both currencies
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

  // Parse amounts — the user edits one, the hook computes the other
  const parsedAmount0 = useMemo(() => parseTokenAmount(amount0Input, token0.decimals), [amount0Input, token0.decimals]);
  const parsedAmount1 = useMemo(() => parseTokenAmount(amount1Input, token1.decimals), [amount1Input, token1.decimals]);
  const hookAmount0 = lastEdited === 0 ? parsedAmount0 : undefined;
  const hookAmount1 = lastEdited === 0 ? undefined : parsedAmount1;

  // Parse tick inputs for the hook
  const hookTickLower = tickLowerInput ? parseInt(tickLowerInput, 10) : undefined;
  const hookTickUpper = tickUpperInput ? parseInt(tickUpperInput, 10) : undefined;

  const create = useCreatePosition(
    {
      poolKey,
      amount0: hookAmount0,
      amount1: hookAmount1,
      tickLower: hookTickLower,
      tickUpper: hookTickUpper,
    },
    {
      chainId: 1,
    },
  );

  const { pool: poolQuery, steps, currentStep, executeAll, reset, position } = create;
  const pool = poolQuery.data;

  // Token balance queries
  const { query: token0BalQuery } = useToken(
    { tokenAddress: poolKey.currency0 as Address },
    { enabled: isConnected, chainId: 1, refetchInterval: 15_000 },
  );
  const { query: token1BalQuery } = useToken(
    { tokenAddress: poolKey.currency1 as Address },
    { enabled: isConnected, chainId: 1, refetchInterval: 15_000 },
  );

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

  const handleAmount0Change = useCallback((val: string) => {
    setAmount0Input(val);
    setLastEdited(0);
  }, []);

  const handleAmount1Change = useCallback((val: string) => {
    setAmount1Input(val);
    setLastEdited(1);
  }, []);

  // Derive the auto-filled display value from the hook's position calculation
  const displayAmount0 = (() => {
    if (lastEdited === 0) return amount0Input;
    if (!position) return amount0Input;
    return position.formattedAmount0;
  })();

  const displayAmount1 = (() => {
    if (lastEdited === 1) return amount1Input;
    if (!position) return amount1Input;
    return position.formattedAmount1;
  })();

  const effectiveAmount0Raw = useMemo(
    () => parseTokenAmount(displayAmount0, token0.decimals),
    [displayAmount0, token0.decimals],
  );
  const effectiveAmount1Raw = useMemo(
    () => parseTokenAmount(displayAmount1, token1.decimals),
    [displayAmount1, token1.decimals],
  );

  const hasInsufficientToken0Balance =
    effectiveAmount0Raw > 0n &&
    token0BalQuery.data?.balance !== undefined &&
    effectiveAmount0Raw > token0BalQuery.data.balance.raw;
  const hasInsufficientToken1Balance =
    effectiveAmount1Raw > 0n &&
    token1BalQuery.data?.balance !== undefined &&
    effectiveAmount1Raw > token1BalQuery.data.balance.raw;

  const hasInsufficientBalance = hasInsufficientToken0Balance || hasInsufficientToken1Balance;
  const insufficientBalanceError =
    hasInsufficientToken0Balance && hasInsufficientToken1Balance
      ? `Insufficient ${token0.symbol} and ${token1.symbol} balance`
      : hasInsufficientToken0Balance
        ? `Insufficient ${token0.symbol} balance`
        : hasInsufficientToken1Balance
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
      await executeAll({
        recipient: address,
      });
      token0BalQuery.refetch();
      token1BalQuery.refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) {
        setTxError(msg);
      }
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

      {/* Main content (right) */}
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
              <button
                onClick={handleRefreshAll}
                disabled={executing || isExecuteConfirmed}
                className="text-text-muted hover:text-accent flex items-center gap-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={cn(poolQuery.isFetching && "animate-spin")}
                >
                  <path
                    d="M21 12a9 9 0 1 1-2.636-6.364"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M21 3v6h-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
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

        {/* Pool loading */}
        {poolQuery.isLoading && (
          <div className="border-border-muted bg-surface flex items-center justify-center rounded-2xl border p-6">
            <div className="text-text-secondary animate-pulse text-sm">Loading pool...</div>
          </div>
        )}

        {/* Pool error */}
        {poolQuery.error && (
          <div className="bg-error-muted text-error rounded-xl p-3 text-xs">{poolQuery.error.message}</div>
        )}

        {/* Tick range + Amount inputs */}
        <div className="border-border-muted bg-surface rounded-2xl border p-4">
          {/* Tick range sliders — first, since amounts depend on range */}
          {pool &&
            (() => {
              const ts = pool.tickSpacing;
              const centerTick = Math.round(pool.tickCurrent / ts) * ts;
              const sliderMin = centerTick - 100 * ts;
              const sliderMax = centerTick + 100 * ts;
              const lowerValue = tickLowerInput ? parseInt(tickLowerInput, 10) : sliderMin;
              const upperValue = tickUpperInput ? parseInt(tickUpperInput, 10) : sliderMax;

              return (
                <div className="mb-4">
                  <div className="text-text-muted mb-2 text-xs font-medium">
                    Tick Range <span className="text-text-muted/60">(current tick: {pool.tickCurrent})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-raised rounded-xl p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-text-muted text-[10px] font-medium">Lower tick</label>
                        <span className="text-text font-mono text-xs font-medium">{lowerValue}</span>
                      </div>
                      <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step={ts}
                        value={lowerValue}
                        onChange={(e) => {
                          const val = Math.round(parseInt(e.target.value, 10) / ts) * ts;
                          setTickLowerInput(val.toString());
                        }}
                        disabled={executing || isExecuteConfirmed}
                        className="accent-accent w-full"
                      />
                      <div className="text-text-muted mt-1 flex justify-between text-[10px]">
                        <span>{sliderMin}</span>
                        <span>{sliderMax}</span>
                      </div>
                    </div>
                    <div className="bg-surface-raised rounded-xl p-3">
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-text-muted text-[10px] font-medium">Upper tick</label>
                        <span className="text-text font-mono text-xs font-medium">{upperValue}</span>
                      </div>
                      <input
                        type="range"
                        min={sliderMin}
                        max={sliderMax}
                        step={ts}
                        value={upperValue}
                        onChange={(e) => {
                          const val = Math.round(parseInt(e.target.value, 10) / ts) * ts;
                          setTickUpperInput(val.toString());
                        }}
                        disabled={executing || isExecuteConfirmed}
                        className="accent-accent w-full"
                      />
                      <div className="text-text-muted mt-1 flex justify-between text-[10px]">
                        <span>{sliderMin}</span>
                        <span>{sliderMax}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

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

          {/* Arrow divider */}
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
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    onClick={openConnectModal}
                    className="glow-accent bg-accent hover:bg-accent-hover w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                  >
                    Connect Wallet
                  </button>
                )}
              </ConnectButton.Custom>
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

/**
 * Pool selector tab that derives its label from on-chain token symbols.
 */
function PoolTab({ preset, isSelected, onClick }: { preset: PoolPreset; isSelected: boolean; onClick: () => void }) {
  const { query: c0 } = useToken({ tokenAddress: preset.poolKey.currency0 as Address }, { enabled: true, chainId: 1 });
  const { query: c1 } = useToken({ tokenAddress: preset.poolKey.currency1 as Address }, { enabled: true, chainId: 1 });

  const label = c0.data && c1.data ? `${c0.data.token.symbol} / ${c1.data.token.symbol}` : "...";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
        isSelected
          ? "border-accent/30 bg-accent-muted text-accent"
          : "border-border-muted bg-surface text-text-secondary hover:border-border hover:bg-surface-hover",
      )}
    >
      {label}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary font-mono">{value}</span>
    </div>
  );
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
  const getStepLoading = (stepId: AddLiquidityStep): string | undefined => {
    if (stepId === "approval0") {
      const s = steps.approvalToken0.transaction.status;
      if (s === "pending") return "Awaiting wallet...";
      if (s === "confirming") return "Confirming...";
    }
    if (stepId === "approval1") {
      const s = steps.approvalToken1.transaction.status;
      if (s === "pending") return "Awaiting wallet...";
      if (s === "confirming") return "Confirming...";
    }
    if (stepId === "permit2") {
      if (steps.permit2.isPending) return "Awaiting signature...";
    }
    if (stepId === "execute") {
      const s = steps.execute.transaction.status;
      if (s === "pending") return "Awaiting wallet...";
      if (s === "confirming") return "Confirming...";
    }
    return undefined;
  };

  interface StepItem {
    id: AddLiquidityStep;
    label: string;
    description: string;
  }

  const allSteps: StepItem[] = [
    ...(isNativeToken0
      ? []
      : [
          {
            id: "approval0" as AddLiquidityStep,
            label: "Approve Token0",
            description: "Allow Permit2 to spend token0",
          },
        ]),
    ...(isNativeToken1
      ? []
      : [
          {
            id: "approval1" as AddLiquidityStep,
            label: "Approve Token1",
            description: "Allow Permit2 to spend token1",
          },
        ]),
    ...(!isNativeToken0 || !isNativeToken1
      ? [
          {
            id: "permit2" as AddLiquidityStep,
            label: "Permit2",
            description: "Sign off-chain spending permit",
          },
        ]
      : []),
    {
      id: "execute",
      label: "Create Position",
      description: "Mint the position NFT",
    },
  ];

  const getStepStatus = (stepId: AddLiquidityStep) => {
    const order: AddLiquidityStep[] = ["approval0", "approval1", "permit2", "execute", "completed"];
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepId);

    if (currentStep === "completed") return "completed";
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="border-border-muted bg-surface rounded-xl border p-4">
      <div className="text-text-muted mb-3 text-xs font-medium">Create position lifecycle</div>

      <div className="space-y-1">
        {allSteps.map((step, i) => {
          const status = getStepStatus(step.id);
          const loadingLabel = getStepLoading(step.id);
          return (
            <div
              key={step.id}
              className="flex items-start gap-3"
            >
              <div className="flex flex-col items-center pt-0.5">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                    status === "completed" && "border-success bg-success text-white",
                    status === "active" && "border-accent bg-accent-muted text-accent",
                    status === "pending" && "border-border text-text-muted bg-transparent",
                  )}
                >
                  {status === "completed" ? (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M20 6L9 17l-5-5"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : status === "active" ? (
                    <div className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
                  ) : (
                    <div className="bg-text-muted/40 h-1.5 w-1.5 rounded-full" />
                  )}
                </div>
                {i < allSteps.length - 1 && (
                  <div
                    className={cn(
                      "my-0.5 h-4 w-0.5 rounded-full",
                      status === "completed" ? "bg-success/40" : "bg-border-muted",
                    )}
                  />
                )}
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <div
                  className={cn(
                    "text-xs font-medium",
                    status === "completed" && "text-success",
                    status === "active" && "text-accent",
                    status === "pending" && "text-text-muted",
                  )}
                >
                  {step.label}
                </div>
                <div className="text-text-muted text-[11px]">{step.description}</div>
              </div>

              {loadingLabel && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-accent animate-spin"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-20"
                    />
                    <path
                      d="M22 12a10 10 0 0 0-10-10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="text-accent text-[11px] font-medium whitespace-nowrap">{loadingLabel}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
