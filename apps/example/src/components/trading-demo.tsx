"use client";

import { useCallback, useMemo, useState } from "react";

import { useTrading, type TradingStep } from "@zahastudio/trading-sdk-react";
import type { Address } from "viem";
import { zeroAddress } from "viem";
import { useAccount, useBalance, useChainId } from "wagmi";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { DetailRow } from "@/components/detail-row";
import { StepList, type StepItem } from "@/components/step-list";
import { TokenInput } from "@/components/token-input";
import { TransactionStatus } from "@/components/transaction-status";
import { buildTokenInfo, formatTokenAmount, parseTokenAmount, type TokenInfo } from "@/lib/tokens";
import { shouldShowExecutionError, truncateAddress } from "@/lib/utils";

const MAINNET_CHAIN_ID = 1;
const QUOTE_REFRESH_INTERVAL = 30_000;

const WETH = buildTokenInfo(
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
  "WETH",
  "Wrapped Ether",
  18,
);
const ETH = buildTokenInfo(zeroAddress, "ETH", "Ether", 18);
const USDC = buildTokenInfo(
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address,
  "USDC",
  "USD Coin",
  6,
);
const USDT = buildTokenInfo(
  "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address,
  "USDT",
  "Tether USD",
  6,
);

interface TradingPreset {
  id: string;
  label: string;
  description: string;
  tokenIn: TokenInfo;
  tokenOut: TokenInfo;
  amount: string;
}

const TRADING_PRESETS: TradingPreset[] = [
  {
    id: "eth-usdc",
    label: "ETH -> USDC",
    description: "Classic route with native ETH input",
    tokenIn: ETH,
    tokenOut: USDC,
    amount: "0.05",
  },
  {
    id: "usdc-eth",
    label: "USDC -> ETH",
    description: "Classic route with ERC-20 approval path",
    tokenIn: USDC,
    tokenOut: ETH,
    amount: "100",
  },
  {
    id: "eth-weth",
    label: "ETH -> WETH",
    description: "Wrap route through the Trading API",
    tokenIn: ETH,
    tokenOut: WETH,
    amount: "0.05",
  },
  {
    id: "usdc-usdt",
    label: "USDC -> USDT",
    description: "Classic stablecoin swap with approval + optional Permit2",
    tokenIn: USDC,
    tokenOut: USDT,
    amount: "100",
  },
];

function formatPoolType(type: string): string {
  switch (type) {
    case "v2-pool":
      return "V2";
    case "v3-pool":
      return "V3";
    case "v4-pool":
      return "V4";
    default:
      return type;
  }
}

function formatRouteLeg(routeLeg: NonNullable<NonNullable<ReturnType<typeof useTrading>["steps"]["quote"]["data"]>["quote"]["route"]>[number], legIndex: number): string {
  const hops = routeLeg.map((pool) => {
    const tokenInSymbol = pool.tokenIn.symbol ?? truncateAddress(pool.tokenIn.address);
    const tokenOutSymbol = pool.tokenOut.symbol ?? truncateAddress(pool.tokenOut.address);
    const fee = "fee" in pool && pool.fee !== undefined ? ` ${pool.fee}bps` : "";
    return `${formatPoolType(pool.type)} ${tokenInSymbol}→${tokenOutSymbol}${fee}`;
  });

  return `Leg ${legIndex + 1}: ${hops.join(" | ")}`;
}

function TradingLifecycle({
  currentStep,
  approvalRequired,
  permitRequired,
  permit2Disabled,
  approvalStatus,
  permitPending,
  swapStatus,
}: {
  currentStep: TradingStep;
  approvalRequired: boolean;
  permitRequired: boolean;
  permit2Disabled: boolean;
  approvalStatus: "idle" | "pending" | "confirming" | "confirmed" | "error";
  permitPending: boolean;
  swapStatus: "idle" | "pending" | "confirming" | "confirmed" | "error";
}) {
  const steps = useMemo(() => {
    const order: TradingStep[] = [
      "quote",
      ...(approvalRequired ? (["approval"] as const) : []),
      ...(!permit2Disabled && permitRequired ? (["permit2"] as const) : []),
      "swap",
      "completed",
    ];

    const getStatus = (stepId: TradingStep): StepItem["status"] => {
      if (currentStep === "completed") return "completed";
      const currentIdx = order.indexOf(currentStep);
      const stepIdx = order.indexOf(stepId);
      if (stepIdx < currentIdx) return "completed";
      if (stepIdx === currentIdx) return "active";
      return "pending";
    };

    const getLoading = (stepId: TradingStep): string | undefined => {
      if (stepId === "approval") {
        if (approvalStatus === "pending") return "Awaiting wallet...";
        if (approvalStatus === "confirming") return "Confirming...";
      }
      if (stepId === "permit2" && permitPending) return "Awaiting signature...";
      if (stepId === "swap") {
        if (swapStatus === "pending") return "Awaiting wallet...";
        if (swapStatus === "confirming") return "Confirming...";
      }
      return undefined;
    };

    const list: Array<{ id: TradingStep; label: string; description: string }> = [
      { id: "quote", label: "Quote", description: "Request a Trading API quote" },
      ...(approvalRequired
        ? [{ id: "approval" as const, label: "Approve", description: "Broadcast the ERC-20 approval transaction" }]
        : []),
      ...(!permit2Disabled && permitRequired
        ? [{ id: "permit2" as const, label: "Permit2", description: "Sign the permit returned by the quote" }]
        : []),
      { id: "swap", label: "Swap", description: "Create and send the swap transaction" },
    ];

    return list.map((step) => ({
      ...step,
      status: getStatus(step.id),
      loadingLabel: getLoading(step.id),
    }));
  }, [approvalRequired, approvalStatus, currentStep, permit2Disabled, permitPending, permitRequired, swapStatus]);

  return (
    <StepList
      title="Trading lifecycle"
      steps={steps}
    />
  );
}

export function TradingDemo() {
  const { address, isConnected } = useAccount();
  const connectedChainId = useChainId();

  const [presetId, setPresetId] = useState<TradingPreset["id"]>(TRADING_PRESETS[0]!.id);
  const [amountInput, setAmountInput] = useState(TRADING_PRESETS[0]!.amount);
  const [permit2Disabled, setPermit2Disabled] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);

  const selectedPreset = TRADING_PRESETS.find((preset) => preset.id === presetId) ?? TRADING_PRESETS[0]!;
  const tokenIn = selectedPreset.tokenIn;
  const tokenOut = selectedPreset.tokenOut;
  const amountIn = useMemo(() => parseTokenAmount(amountInput, tokenIn.decimals), [amountInput, tokenIn.decimals]);

  const balanceQuery = useBalance({
    address,
    chainId: MAINNET_CHAIN_ID,
    token: tokenIn.address === zeroAddress ? undefined : tokenIn.address,
    query: {
      enabled: !!address,
      refetchInterval: 15_000,
    },
  });

  const trading = useTrading(
    {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn,
      permit2Disabled,
    },
    {
      enabled: amountIn > 0n && !!address,
      chainId: MAINNET_CHAIN_ID,
      refetchInterval: QUOTE_REFRESH_INTERVAL,
    },
  );

  const { steps, currentStep, executeAll, reset } = trading;
  const quote = steps.quote.data;
  const approvalRequired = steps.approval.isRequired;
  const permitRequired = steps.permit2.isRequired;
  const quoteOutput = quote ? formatTokenAmount(BigInt(quote.quote.output.amount), tokenOut.decimals) : "";
  const routeLines = quote?.quote.route?.map((routeLeg, index) => formatRouteLeg(routeLeg, index)) ?? [];
  const rawBalance = balanceQuery.data?.value;
  const hasInsufficientBalance = rawBalance !== undefined && amountIn > rawBalance;
  const canExecute = isConnected && amountIn > 0n && !hasInsufficientBalance && !!quote;

  const handlePresetChange = useCallback((preset: TradingPreset) => {
    setPresetId(preset.id);
    setAmountInput(preset.amount);
    setExecutionError(null);
    setExecuting(false);
    reset();
  }, [reset]);

  const handleMaxClick = useCallback(() => {
    if (balanceQuery.data?.formatted) {
      setAmountInput(balanceQuery.data.formatted);
    }
  }, [balanceQuery.data?.formatted]);

  const runWithHandling = useCallback(async (action: () => Promise<unknown>) => {
    setExecutionError(null);
    setExecuting(true);

    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (shouldShowExecutionError(message)) {
        setExecutionError(message);
      }
    } finally {
      setExecuting(false);
    }
  }, []);

  const handlePrimaryAction = useCallback(async () => {
    if (!canExecute) return;

    switch (currentStep) {
      case "quote":
        await runWithHandling(() => steps.quote.refetch());
        break;
      case "approval":
        await runWithHandling(() => steps.approval.execute());
        break;
      case "permit2":
        await runWithHandling(() => steps.permit2.sign());
        break;
      case "swap":
        await runWithHandling(() => steps.swap.execute());
        break;
      case "completed":
        break;
    }
  }, [canExecute, currentStep, runWithHandling, steps]);

  const handleExecuteAll = useCallback(async () => {
    if (!canExecute) return;
    await runWithHandling(() => executeAll());
  }, [canExecute, executeAll, runWithHandling]);

  const handleReset = useCallback(() => {
    reset();
    setExecuting(false);
    setExecutionError(null);
    steps.quote.refetch();
    balanceQuery.refetch();
  }, [balanceQuery, reset, steps.quote]);

  const primaryLabel =
    currentStep === "approval"
      ? "Approve token"
      : currentStep === "permit2"
        ? "Sign permit"
        : currentStep === "swap"
          ? "Send swap"
          : currentStep === "completed"
            ? "Completed"
            : "Refresh quote";

  return (
    <div className="flex w-full items-start justify-center gap-6">
      <div className="sticky top-6 hidden w-110 shrink-0 space-y-4 xl:block">
        <div className="border-border-muted bg-surface rounded-xl border p-4">
          <div className="text-text-muted mb-3 text-xs font-medium">Presets</div>
          <div className="space-y-2">
            {TRADING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetChange(preset)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                  preset.id === selectedPreset.id
                    ? "border-accent/40 bg-accent-muted text-text"
                    : "border-border-muted bg-surface-raised text-text-secondary hover:border-accent/20 hover:bg-surface-hover"
                }`}
              >
                <div className="text-sm font-semibold">{preset.label}</div>
                <div className="mt-1 text-xs opacity-80">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-border-muted bg-surface rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-text-muted text-xs font-medium">Approval mode</div>
              <div className="text-text-secondary mt-1 text-[11px]">Toggle Permit2 vs proxy approval</div>
            </div>
            <button
              type="button"
              onClick={() => setPermit2Disabled((current) => !current)}
              className={`relative h-7 w-13 rounded-full transition-colors ${
                permit2Disabled ? "bg-warning-muted" : "bg-accent-muted"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
                  permit2Disabled ? "translate-x-1" : "translate-x-7"
                }`}
              />
            </button>
          </div>
          <div className="text-text text-sm font-semibold">{permit2Disabled ? "Proxy approval" : "Permit2"}</div>
        </div>

        <TradingLifecycle
          currentStep={currentStep}
          approvalRequired={approvalRequired}
          permitRequired={permitRequired}
          permit2Disabled={permit2Disabled}
          approvalStatus={steps.approval.transaction.status}
          permitPending={steps.permit2.isPending}
          swapStatus={steps.swap.transaction.status}
        />

        {quote && (
          <div className="border-border-muted bg-surface rounded-xl border p-4">
            <div className="text-text-muted mb-3 text-xs font-medium">Quote snapshot</div>
            <div className="space-y-2">
              <DetailRow
                label="Routing"
                value={quote.routing}
              />
              <DetailRow
                label="Route"
                value={quote.quote.routeString ?? (routeLines[0] ?? "Unavailable")}
              />
              <DetailRow
                label="Output"
                value={`${quoteOutput} ${tokenOut.symbol}`}
              />
              <DetailRow
                label="Request ID"
                value={truncateAddress(quote.requestId)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="w-full max-w-2xl">
        <div className="border-border-muted bg-surface rounded-2xl border p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <div className="text-text text-xl font-semibold">{selectedPreset.label}</div>
              <div className="text-text-secondary mt-1 text-sm">{selectedPreset.description}</div>
            </div>
            <div className="border-border-muted bg-surface-raised rounded-lg border px-3 py-2 text-right text-[11px]">
              <div className="text-text-muted">Chain</div>
              <div className={connectedChainId === MAINNET_CHAIN_ID ? "text-success" : "text-warning"}>
                {connectedChainId === MAINNET_CHAIN_ID ? "Mainnet ready" : "Switch to Mainnet"}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <TokenInput
              label="You pay"
              token={tokenIn}
              value={amountInput}
              onChange={setAmountInput}
              balance={balanceQuery.data?.formatted}
              balanceLoading={balanceQuery.isLoading}
              onMaxClick={handleMaxClick}
            />

            <div className="flex justify-center">
              <div className="border-border-muted bg-surface-raised text-text-secondary rounded-full border px-3 py-1 text-[11px] font-medium">
                Trading API route
              </div>
            </div>

            <TokenInput
              label="You receive"
              token={tokenOut}
              value={quoteOutput}
              readOnly
              loading={steps.quote.isFetching}
            />
          </div>

          <div className="bg-surface-raised mt-4 rounded-xl p-4">
            <div className="space-y-2">
              <DetailRow
                label="Approval mode"
                value={permit2Disabled ? "Proxy" : "Permit2"}
              />
              <DetailRow
                label="Current step"
                value={currentStep}
              />
              <DetailRow
                label="Quote status"
                value={steps.quote.isFetching ? "refreshing" : quote ? "ready" : "idle"}
              />
              {quote && (
                <DetailRow
                  label="Routing"
                  value={quote.routing}
                />
              )}
              {quote?.quote.routeString && (
                <DetailRow
                  label="Route"
                  value={quote.quote.routeString}
                />
              )}
            </div>
          </div>

          {!isConnected && <div className="mt-5"><ConnectWalletButton /></div>}

          {isConnected && (
            <div className="mt-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={!canExecute || executing || currentStep === "completed"}
                  className="glow-accent bg-accent hover:bg-accent-hover disabled:bg-surface-hover disabled:text-text-muted rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed"
                >
                  {executing ? "Working..." : primaryLabel}
                </button>

                <button
                  type="button"
                  onClick={handleExecuteAll}
                  disabled={!canExecute || executing || currentStep === "completed"}
                  className="border-border-muted text-text hover:bg-surface-hover disabled:text-text-muted rounded-xl border px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed"
                >
                  {executing ? "Working..." : "Execute full flow"}
                </button>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-text-secondary hover:text-text text-xs font-medium transition-colors"
              >
                Reset flow
              </button>
            </div>
          )}

          {hasInsufficientBalance && (
            <div className="bg-warning-muted text-warning mt-4 rounded-xl px-4 py-3 text-sm font-medium">
              Insufficient {tokenIn.symbol} balance for this trade.
            </div>
          )}

          {steps.quote.error && (
            <div className="bg-error-muted text-error mt-4 rounded-xl px-4 py-3 text-sm font-medium">
              {steps.quote.error.message}
            </div>
          )}

          {executionError && (
            <div className="bg-error-muted text-error mt-4 rounded-xl px-4 py-3 text-sm font-medium">{executionError}</div>
          )}

          <div className="mt-4 space-y-3">
            <TransactionStatus
              status={steps.approval.transaction.status}
              txHash={steps.approval.transaction.txHash}
            />
            <TransactionStatus
              status={steps.swap.transaction.status}
              txHash={steps.swap.transaction.txHash}
            />
          </div>

          {routeLines.length > 0 && (
            <div className="border-border-muted bg-surface-raised mt-4 rounded-xl border p-4">
              <div className="text-text-muted mb-3 text-xs font-medium">Route breakdown</div>
              <div className="space-y-2">
                {routeLines.map((routeLine) => (
                  <div
                    key={routeLine}
                    className="text-text-secondary rounded-lg border border-white/5 px-3 py-2 font-mono text-[11px]"
                  >
                    {routeLine}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-border-muted text-text-secondary mt-5 rounded-xl border px-4 py-3 text-xs leading-5">
            Uses <code className="font-mono">@zahastudio/trading-sdk-react</code> with mainnet presets. When Permit2 is
            disabled, the demo sends <code className="font-mono">x-permit2-disabled: true</code> on quote, approval, and
            swap requests.
          </div>
        </div>
      </div>
    </div>
  );
}
