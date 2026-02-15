"use client";

import { useState, useMemo, useCallback, useEffect } from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { sortTokens, Position, nearestUsableTick, TickMath } from "@zahastudio/uniswap-sdk";
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

/**
 * Resolve the effective tick bounds.
 * Falls back to full-range ticks (nearest usable MIN/MAX) when inputs are empty.
 */
function resolveTickRange(
  tickLowerInput: string,
  tickUpperInput: string,
  tickSpacing: number,
): { tickLower: number; tickUpper: number } {
  const tickLower = tickLowerInput ? parseInt(tickLowerInput, 10) : nearestUsableTick(TickMath.MIN_TICK, tickSpacing);
  const tickUpper = tickUpperInput ? parseInt(tickUpperInput, 10) : nearestUsableTick(TickMath.MAX_TICK, tickSpacing);

  return {
    tickLower,
    tickUpper,
  };
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

  const [currencyA, currencyB] = useMemo(
    () => sortTokens(selectedPreset.token0.address, selectedPreset.token1.address),
    [selectedPreset],
  );

  // Determine which token is currency0 and which is currency1 after sorting
  const token0IsCurrencyA = selectedPreset.token0.address.toLowerCase() === currencyA.toLowerCase();
  const sortedToken0 = token0IsCurrencyA ? selectedPreset.token0 : selectedPreset.token1;
  const sortedToken1 = token0IsCurrencyA ? selectedPreset.token1 : selectedPreset.token0;

  // Map user-facing amounts to sorted (pool-order) amounts for the SDK
  const sortedAmount0Input = token0IsCurrencyA ? amount0Input : amount1Input;
  const sortedAmount1Input = token0IsCurrencyA ? amount1Input : amount0Input;

  // Parse amounts for proactive approval checking
  const approvalAmount0 = useMemo(
    () => parseTokenAmount(sortedAmount0Input, sortedToken0.decimals),
    [sortedAmount0Input, sortedToken0.decimals],
  );
  const approvalAmount1 = useMemo(
    () => parseTokenAmount(sortedAmount1Input, sortedToken1.decimals),
    [sortedAmount1Input, sortedToken1.decimals],
  );

  const create = useCreatePosition(
    {
      currencyA,
      currencyB,
      fee: selectedPreset.fee,
      tickSpacing: selectedPreset.tickSpacing,
      hooks: zeroAddress,
    },
    {
      amount0: approvalAmount0,
      amount1: approvalAmount1,
      chainId: 1,
    },
  );

  const { pool: poolQuery, steps, currentStep, executeAll, reset } = create;
  const pool = poolQuery.data;

  /**
   * Compute the complementary token amount using Position.fromAmount0 / fromAmount1.
   * Works in pool-sorted order (currency0/currency1), then maps back to user-facing tokens.
   *
   * @param editedToken - which user-facing token was edited (0 = preset.token0, 1 = preset.token1)
   * @param rawAmount   - the raw (smallest-unit) amount of the edited token
   */
  const computeOtherAmount = useCallback(
    (editedToken: 0 | 1, rawAmount: string): string | null => {
      if (!pool) return null;
      try {
        const { tickLower, tickUpper } = resolveTickRange(tickLowerInput, tickUpperInput, pool.tickSpacing);

        // Map user-facing token index to pool-sorted token index
        const editedIsSortedToken0 = editedToken === 0 ? token0IsCurrencyA : !token0IsCurrencyA;

        if (editedIsSortedToken0) {
          // User edited pool.currency0 → compute pool.currency1
          const pos = Position.fromAmount0({
            pool,
            tickLower,
            tickUpper,
            amount0: rawAmount,
            useFullPrecision: true,
          });
          return pos.amount1.toExact();
        } else {
          // User edited pool.currency1 → compute pool.currency0
          const pos = Position.fromAmount1({
            pool,
            tickLower,
            tickUpper,
            amount1: rawAmount,
          });
          return pos.amount0.toExact();
        }
      } catch {
        return null;
      }
    },
    [pool, tickLowerInput, tickUpperInput, token0IsCurrencyA],
  );

  /**
   * Recalculate the auto-filled (non-edited) token amount.
   * Called when the user types an amount OR when ticks change.
   */
  const recalculateOtherAmount = useCallback(
    (edited: 0 | 1, inputValue: string) => {
      const token = edited === 0 ? selectedPreset.token0 : selectedPreset.token1;
      const setOther = edited === 0 ? setAmount1Input : setAmount0Input;

      if (!pool || !inputValue || inputValue === "." || inputValue === "0.") {
        if (!inputValue) setOther("");
        return;
      }
      const raw = parseTokenAmount(inputValue, token.decimals);
      if (raw <= 0n) {
        setOther("");
        return;
      }
      const other = computeOtherAmount(edited, raw.toString());
      if (other !== null) setOther(other);
    },
    [pool, computeOtherAmount, selectedPreset.token0, selectedPreset.token1],
  );

  // Auto-fill the other token when the user edits one
  const handleAmount0Change = useCallback(
    (val: string) => {
      setAmount0Input(val);
      setLastEdited(0);
      recalculateOtherAmount(0, val);
    },
    [recalculateOtherAmount],
  );

  const handleAmount1Change = useCallback(
    (val: string) => {
      setAmount1Input(val);
      setLastEdited(1);
      recalculateOtherAmount(1, val);
    },
    [recalculateOtherAmount],
  );

  // When ticks change, recalculate the auto-filled token based on the last-edited token
  useEffect(() => {
    const editedInput = lastEdited === 0 ? amount0Input : amount1Input;
    recalculateOtherAmount(lastEdited, editedInput);
    // Only trigger when ticks or pool change, not when amounts change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickLowerInput, tickUpperInput, pool]);

  const isExecuteConfirmed = steps.execute.transaction.status === "confirmed";
  const txHash = steps.execute.transaction.txHash;

  const [executing, setExecuting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const handleExecuteAll = useCallback(async () => {
    if (!address) return;
    setTxError(null);
    setExecuting(true);
    try {
      const tickLower = tickLowerInput ? parseInt(tickLowerInput, 10) : undefined;
      const tickUpper = tickUpperInput ? parseInt(tickUpperInput, 10) : undefined;

      // Only pass the primary (user-edited) amount to the SDK.
      // This ensures buildAddLiquidityCallData uses Position.fromAmount0/fromAmount1
      // (the same path the auto-fill used) instead of Position.fromAmounts which can
      // produce a different liquidity due to rounding and cause a revert.
      const lastEditedIsSorted0 = lastEdited === 0 ? token0IsCurrencyA : !token0IsCurrencyA;
      const editedInput = lastEdited === 0 ? amount0Input : amount1Input;
      const editedToken = lastEditedIsSorted0 ? sortedToken0 : sortedToken1;
      const rawAmount = editedInput ? parseTokenAmount(editedInput, editedToken.decimals).toString() : undefined;

      await executeAll({
        amount0: lastEditedIsSorted0 ? rawAmount : undefined,
        amount1: lastEditedIsSorted0 ? undefined : rawAmount,
        recipient: address,
        tickLower,
        tickUpper,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) {
        setTxError(msg);
      }
    } finally {
      setExecuting(false);
    }
  }, [
    address,
    executeAll,
    amount0Input,
    amount1Input,
    lastEdited,
    token0IsCurrencyA,
    sortedToken0,
    sortedToken1,
    tickLowerInput,
    tickUpperInput,
  ]);

  const handleReset = useCallback(() => {
    reset();
    setTxError(null);
    setExecuting(false);
    setAmount0Input("");
    setAmount1Input("");
  }, [reset]);

  const hasAmount = approvalAmount0 > 0n || approvalAmount1 > 0n;

  return (
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
          value={amount0Input}
          onChange={handleAmount0Change}
          disabled={executing || isExecuteConfirmed}
        />

        <div className="my-2" />

        <TokenInput
          label={`${selectedPreset.token1.symbol} amount`}
          token={selectedPreset.token1}
          value={amount1Input}
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

      {/* Step indicator */}
      {isConnected && hasAmount && pool && (
        <CreatePositionStepIndicator
          currentStep={currentStep}
          steps={steps}
          isNativeToken0={sortedToken0.address === zeroAddress}
          isNativeToken1={sortedToken1.address === zeroAddress}
        />
      )}

      {/* Transaction status */}
      {steps.execute.transaction.status !== "idle" && (
        <TransactionStatus
          status={steps.execute.transaction.status}
          txHash={txHash}
        />
      )}
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
