"use client";

import { useState, useMemo, useCallback } from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { sortTokens } from "@zahastudio/uniswap-sdk";
import { useCreatePosition, type CreatePositionStep } from "@zahastudio/uniswap-sdk-react";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";

import { TokenInput } from "@/components/token-input";
import { TransactionStatus } from "@/components/transaction-status";
import { ETH, USDC, USDT, type TokenInfo, parseTokenAmount } from "@/lib/tokens";
import { cn } from "@/lib/utils";

interface PoolPreset {
  id: string;
  label: string;
  token0: TokenInfo;
  token1: TokenInfo;
  fee: number;
  tickSpacing: number;
}

const POOL_PRESETS: PoolPreset[] = [
  {
    id: "eth-usdc",
    label: "ETH / USDC",
    token0: ETH,
    token1: USDC,
    fee: 3000,
    tickSpacing: 60,
  },
  {
    id: "usdc-usdt",
    label: "USDC / USDT",
    token0: USDC,
    token1: USDT,
    fee: 100,
    tickSpacing: 1,
  },
];

function shouldShowExecutionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return !normalized.includes("user rejected") && !normalized.includes("user denied");
}

function getStepActionLabel(step: CreatePositionStep): string {
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

export function CreatePositionDemo() {
  const { address, isConnected } = useAccount();

  const [selectedPreset, setSelectedPreset] = useState<PoolPreset>(POOL_PRESETS[0]!);
  const [amount0Input, setAmount0Input] = useState("");
  const [amount1Input, setAmount1Input] = useState("");
  const [tickLowerInput, setTickLowerInput] = useState("");
  const [tickUpperInput, setTickUpperInput] = useState("");
  // Track which user-facing token was last manually edited (0 = preset.token0, 1 = preset.token1)
  const [lastEdited, setLastEdited] = useState<0 | 1>(0);

  const handlePresetChange = useCallback((preset: PoolPreset) => {
    setSelectedPreset(preset);
    setAmount0Input("");
    setAmount1Input("");
    setTickLowerInput("");
    setTickUpperInput("");
  }, []);

  const [currency0, currency1] = useMemo(
    () => sortTokens(selectedPreset.token0.address, selectedPreset.token1.address),
    [selectedPreset],
  );

  // Determine which token is currency0 and which is currency1 after sorting
  const token0IsCurrencyA = selectedPreset.token0.address.toLowerCase() === currency0.toLowerCase();
  const sortedToken0 = token0IsCurrencyA ? selectedPreset.token0 : selectedPreset.token1;
  const sortedToken1 = token0IsCurrencyA ? selectedPreset.token1 : selectedPreset.token0;

  // Map user-facing amounts to sorted (pool-order) amounts for the SDK
  const sortedAmount0Input = token0IsCurrencyA ? amount0Input : amount1Input;
  const sortedAmount1Input = token0IsCurrencyA ? amount1Input : amount0Input;

  // Parse the user-edited amount only — the hook computes the other
  const lastEditedIsSorted0 = lastEdited === 0 ? token0IsCurrencyA : !token0IsCurrencyA;
  const parsedAmount0 = useMemo(
    () => parseTokenAmount(sortedAmount0Input, sortedToken0.decimals),
    [sortedAmount0Input, sortedToken0.decimals],
  );
  const parsedAmount1 = useMemo(
    () => parseTokenAmount(sortedAmount1Input, sortedToken1.decimals),
    [sortedAmount1Input, sortedToken1.decimals],
  );
  const hookAmount0 = lastEditedIsSorted0 ? parsedAmount0 : undefined;
  const hookAmount1 = lastEditedIsSorted0 ? undefined : parsedAmount1;

  // Parse tick inputs for the hook
  const hookTickLower = tickLowerInput ? parseInt(tickLowerInput, 10) : undefined;
  const hookTickUpper = tickUpperInput ? parseInt(tickUpperInput, 10) : undefined;

  const create = useCreatePosition(
    {
      poolKey: {
        currency0,
        currency1,
        fee: selectedPreset.fee,
        tickSpacing: selectedPreset.tickSpacing,
        hooks: zeroAddress,
      },
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

  // Auto-fill the other token from the hook's calculated position
  const handleAmount0Change = useCallback(
    (val: string) => {
      setAmount0Input(val);
      setLastEdited(0);
    },
    [],
  );

  const handleAmount1Change = useCallback(
    (val: string) => {
      setAmount1Input(val);
      setLastEdited(1);
    },
    [],
  );

  // Derive the auto-filled display value from the hook's position calculation
  const displayAmount0 = (() => {
    // If token0 is the one the user edited, show their input directly
    if (lastEdited === 0) return amount0Input;
    // Otherwise show the hook's calculated value (mapped back from sorted order)
    if (!position) return amount1Input; // fallback to whatever is typed
    return token0IsCurrencyA ? position.formattedAmount0 : position.formattedAmount1;
  })();

  const displayAmount1 = (() => {
    if (lastEdited === 1) return amount1Input;
    if (!position) return amount0Input;
    return token0IsCurrencyA ? position.formattedAmount1 : position.formattedAmount0;
  })();

  const isExecuteConfirmed = steps.execute.transaction.status === "confirmed";
  const txHash = steps.execute.transaction.txHash;

  const [executing, setExecuting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const handleExecuteAll = useCallback(async () => {
    if (!address) return;
    setTxError(null);
    setExecuting(true);
    try {
      await executeAll({
        recipient: address,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) {
        setTxError(msg);
      }
    } finally {
      setExecuting(false);
    }
  }, [address, executeAll]);

  const handleReset = useCallback(() => {
    reset();
    setTxError(null);
    setExecuting(false);
    setAmount0Input("");
    setAmount1Input("");
  }, [reset]);

  const hasAmount = parsedAmount0 > 0n || parsedAmount1 > 0n;

  return (
    <div className="flex w-full items-start justify-center gap-6">
      {/* Lifecycle panel (left) */}
      <div className="sticky top-6 hidden w-72 shrink-0 space-y-4 lg:block">
        {isConnected && hasAmount && pool && (
          <CreatePositionStepIndicator
            currentStep={currentStep}
            steps={steps}
            isNativeToken0={sortedToken0.address === zeroAddress}
            isNativeToken1={sortedToken1.address === zeroAddress}
          />
        )}

        {steps.execute.transaction.status !== "idle" && (
          <TransactionStatus
            status={steps.execute.transaction.status}
            txHash={txHash}
          />
        )}
      </div>

      {/* Main content (right) */}
      <div className="w-full max-w-120 space-y-4">
        {/* Pool selector tabs */}
        <div className="flex gap-2">
          {POOL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset)}
              className={cn(
                "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                selectedPreset.id === preset.id
                  ? "border-accent/30 bg-accent-muted text-accent"
                  : "border-border-muted bg-surface text-text-secondary hover:border-border hover:bg-surface-hover",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Pool info */}
        {pool && (
          <div className="border-border-muted bg-surface rounded-2xl border p-4">
            <div className="text-text-muted mb-2 text-xs font-medium">Pool Info</div>
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
                value={`${pool.token0Price.toSignificant(6)} ${sortedToken1.symbol} per ${sortedToken0.symbol}`}
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
          {pool && (() => {
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
            label={`${selectedPreset.token0.symbol} amount`}
            token={selectedPreset.token0}
            value={displayAmount0}
            onChange={handleAmount0Change}
            disabled={executing || isExecuteConfirmed}
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
            label={`${selectedPreset.token1.symbol} amount`}
            token={selectedPreset.token1}
            value={displayAmount1}
            onChange={handleAmount1Change}
            disabled={executing || isExecuteConfirmed}
          />

          {/* Error display */}
          {txError && <div className="bg-error-muted text-error mt-3 rounded-lg p-3 text-xs">{txError}</div>}

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
                disabled={executing || !hasAmount || !pool || poolQuery.isLoading}
                className={cn(
                  "glow-accent w-full rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]",
                  "bg-accent hover:bg-accent-hover text-white",
                  "disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
                )}
              >
                {executing ? getStepActionLabel(currentStep) + "..." : !hasAmount ? "Enter an amount" : "Create Position"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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

function CreatePositionStepIndicator({
  currentStep,
  steps,
  isNativeToken0,
  isNativeToken1,
}: {
  currentStep: CreatePositionStep;
  steps: ReturnType<typeof useCreatePosition>["steps"];
  isNativeToken0: boolean;
  isNativeToken1: boolean;
}) {
  const getStepLoading = (stepId: CreatePositionStep): string | undefined => {
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
    id: CreatePositionStep;
    label: string;
    description: string;
  }

  const allSteps: StepItem[] = [
    ...(isNativeToken0
      ? []
      : [
          {
            id: "approval0" as CreatePositionStep,
            label: "Approve Token0",
            description: "Allow Permit2 to spend token0",
          },
        ]),
    ...(isNativeToken1
      ? []
      : [
          {
            id: "approval1" as CreatePositionStep,
            label: "Approve Token1",
            description: "Allow Permit2 to spend token1",
          },
        ]),
    ...(!isNativeToken0 || !isNativeToken1
      ? [
          {
            id: "permit2" as CreatePositionStep,
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

  const getStepStatus = (stepId: CreatePositionStep) => {
    const order: CreatePositionStep[] = ["approval0", "approval1", "permit2", "execute", "completed"];
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
