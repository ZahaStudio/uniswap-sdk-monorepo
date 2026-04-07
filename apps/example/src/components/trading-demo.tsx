"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Address } from "viem";

import { useTrading, type TradingRoute, type TradingStep } from "@zahastudio/trading-sdk-react";
import { zeroAddress } from "viem";
import { useAccount, useBalance, useChainId } from "wagmi";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { DetailRow } from "@/components/detail-row";
import { RefreshButton } from "@/components/refresh-button";
import { StepList, type StepItem } from "@/components/step-list";
import { TokenInput } from "@/components/token-input";
import { TransactionStatus } from "@/components/transaction-status";
import { buildTokenInfo, formatTokenAmount, parseTokenAmount, type TokenInfo } from "@/lib/tokens";
import { cn, shouldShowExecutionError, truncateAddress } from "@/lib/utils";

const MAINNET_CHAIN_ID = 1;
const QUOTE_REFRESH_INTERVAL = 30_000;

const WETH = buildTokenInfo("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address, "WETH", "Wrapped Ether", 18);
const ETH = buildTokenInfo(zeroAddress, "ETH", "Ether", 18);
const USDC = buildTokenInfo("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address, "USDC", "USD Coin", 6);
const USDT = buildTokenInfo("0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address, "USDT", "Tether USD", 6);

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
    label: "ETH / USDC",
    description: "Classic route with native ETH input",
    tokenIn: ETH,
    tokenOut: USDC,
    amount: "0.05",
  },
  {
    id: "usdc-eth",
    label: "USDC / ETH",
    description: "Classic route with ERC-20 approval",
    tokenIn: USDC,
    tokenOut: ETH,
    amount: "100",
  },
  {
    id: "eth-weth",
    label: "ETH / WETH",
    description: "Wrap route through the Trading API",
    tokenIn: ETH,
    tokenOut: WETH,
    amount: "0.05",
  },
  {
    id: "usdc-usdt",
    label: "USDC / USDT",
    description: "Classic stablecoin swap",
    tokenIn: USDC,
    tokenOut: USDT,
    amount: "100",
  },
];

function TradingPresetTab({
  preset,
  isSelected,
  onClick,
}: {
  preset: TradingPreset;
  isSelected: boolean;
  onClick: () => void;
}) {
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
      {preset.label}
    </button>
  );
}

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

function formatRouteLeg(routeLeg: TradingRoute[number], legIndex: number): string {
  const hops = routeLeg.map((pool) => {
    const tokenInSymbol = pool.tokenIn.symbol ?? truncateAddress(pool.tokenIn.address);
    const tokenOutSymbol = pool.tokenOut.symbol ?? truncateAddress(pool.tokenOut.address);
    const fee = "fee" in pool && pool.fee !== undefined ? ` ${pool.fee}bps` : "";
    return `${formatPoolType(pool.type)} ${tokenInSymbol}→${tokenOutSymbol}${fee}`;
  });

  return `Leg ${legIndex + 1}: ${hops.join(" | ")}`;
}

function TradingStepIndicator({
  currentStep,
  approvalResetRequired,
  approvalApproveRequired,
  permitRequired,
  permit2Disabled,
  approvalStatus,
  permitPending,
  swapStatus,
}: {
  currentStep: TradingStep;
  approvalResetRequired: boolean;
  approvalApproveRequired: boolean;
  permitRequired: boolean;
  permit2Disabled: boolean;
  approvalStatus: "idle" | "pending" | "confirming" | "confirmed" | "error";
  permitPending: boolean;
  swapStatus: "idle" | "pending" | "confirming" | "confirmed" | "error";
}) {
  const order: TradingStep[] = [
    "quote",
    ...(approvalResetRequired ? (["approval-reset"] as const) : []),
    ...(approvalApproveRequired ? (["approval"] as const) : []),
    ...(!permit2Disabled && permitRequired ? (["permit2"] as const) : []),
    "swap",
    "completed",
  ];

  function getStatus(stepId: TradingStep): StepItem["status"] {
    if (currentStep === "completed") return "completed";
    const currentIdx = order.indexOf(currentStep);
    const stepIdx = order.indexOf(stepId);
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  }

  function getLoading(stepId: TradingStep): string | undefined {
    if (stepId === "approval-reset" || stepId === "approval") {
      if (approvalStatus === "pending") return "Awaiting wallet...";
      if (approvalStatus === "confirming") return "Confirming...";
    }
    if (stepId === "permit2" && permitPending) return "Awaiting signature...";
    if (stepId === "swap") {
      if (swapStatus === "pending") return "Awaiting wallet...";
      if (swapStatus === "confirming") return "Confirming...";
    }
    return undefined;
  }

  const stepItems: Array<{ id: TradingStep; label: string; description: string }> = [
    { id: "quote", label: "Quote", description: "Fetch price from the Trading API" },
    ...(approvalResetRequired
      ? [
          {
            id: "approval-reset" as const,
            label: "Reset approval",
            description: "Clear the token allowance before re-approving",
          },
        ]
      : []),
    ...(approvalApproveRequired
      ? [{ id: "approval" as const, label: "Approve", description: "Broadcast approval for the router flow" }]
      : []),
    ...(!permit2Disabled && permitRequired
      ? [{ id: "permit2" as const, label: "Permit2", description: "Sign the permit returned by the quote" }]
      : []),
    { id: "swap", label: "Swap", description: "Create and execute the final swap transaction" },
  ];

  const steps: StepItem[] = stepItems.map((step) => ({
    ...step,
    status: getStatus(step.id),
    loadingLabel: getLoading(step.id),
  }));

  return (
    <StepList
      title="Swap lifecycle"
      steps={steps}
    />
  );
}

function TradingQuoteDetails({
  outputDisplay,
  outputSymbol,
  routing,
  routeString,
  routeLines,
  approvalMode,
}: {
  outputDisplay: string;
  outputSymbol: string;
  routing: string;
  routeString?: string;
  routeLines: string[];
  approvalMode: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-surface-raised"
      >
        <span>
          Route: <span className="font-medium text-text">{routeString ?? routing}</span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={cn("transition-transform", expanded && "rotate-180")}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="mt-1 space-y-2 rounded-lg bg-surface-raised/50 px-3 py-2.5">
          <DetailRow
            label="Expected output"
            value={`${outputDisplay} ${outputSymbol}`}
          />
          <DetailRow
            label="Routing"
            value={routing}
          />
          <DetailRow
            label="Approval mode"
            value={approvalMode}
          />
          {routeLines.map((routeLine) => (
            <DetailRow
              key={routeLine}
              label="Route leg"
              value={routeLine}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TradingDemo() {
  const { address, isConnected } = useAccount();
  const connectedChainId = useChainId();

  const [selectedPreset, setSelectedPreset] = useState<TradingPreset>(TRADING_PRESETS[0]!);
  const [isReversed, setIsReversed] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [permit2Disabled, setPermit2Disabled] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const tokenIn = isReversed ? selectedPreset.tokenOut : selectedPreset.tokenIn;
  const tokenOut = isReversed ? selectedPreset.tokenIn : selectedPreset.tokenOut;
  const amountInRaw = useMemo(() => parseTokenAmount(amountInput, tokenIn.decimals), [amountInput, tokenIn.decimals]);
  const approvalModeLabel = permit2Disabled ? "Proxy approval" : "Permit2";
  const isNativeInput = tokenIn.address.toLowerCase() === zeroAddress.toLowerCase();

  const balanceQuery = useBalance({
    address,
    chainId: MAINNET_CHAIN_ID,
    token: isNativeInput ? undefined : tokenIn.address,
    query: {
      enabled: !!address,
      refetchInterval: 15_000,
    },
  });

  const trading = useTrading(
    {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn: amountInRaw,
      permit2Disabled,
    },
    {
      enabled: amountInRaw > 0n && !!address,
      chainId: MAINNET_CHAIN_ID,
      refetchInterval: QUOTE_REFRESH_INTERVAL,
    },
  );

  const { steps, currentStep, executeAll, reset } = trading;
  const quoteData = steps.quote.data;
  const quoteLoading = steps.quote.isLoading;
  const quoteError = steps.quote.error;
  const isFetchingQuote = steps.quote.isFetching;
  const approvalResetRequired = steps.approvalReset.isRequired;
  const approvalApproveRequired = steps.approval.isRequired;
  const approvalStepStatus =
    currentStep === "approval-reset" ? steps.approvalReset.transaction.status : steps.approval.transaction.status;
  const approvalResetTxHash = steps.approvalReset.transaction.txHash;
  const approvalTxHash = steps.approval.transaction.txHash;
  const permitRequired = steps.permit2.isRequired;
  const isSwapConfirmed = steps.swap.transaction.status === "confirmed";
  const swapTxHash = steps.swap.transaction.txHash;
  const outputDisplay = quoteData
    ? formatTokenAmount(BigInt(quoteData.quote.output.amount), tokenOut.decimals)
    : undefined;
  const routeLines = quoteData?.quote.route?.map((routeLeg, index) => formatRouteLeg(routeLeg, index)) ?? [];
  const rawBalance = balanceQuery.data?.value;
  const hasInsufficientBalance = rawBalance !== undefined && amountInRaw > rawBalance;
  const insufficientBalanceError = hasInsufficientBalance ? `Insufficient ${tokenIn.symbol} balance` : null;

  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(QUOTE_REFRESH_INTERVAL / 1000);
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    if (!quoteData || isSwapConfirmed) return;
    lastRefreshRef.current = Date.now();
    setSecondsUntilRefresh(QUOTE_REFRESH_INTERVAL / 1000);
  }, [quoteData, isSwapConfirmed]);

  useEffect(() => {
    if (!quoteData || isSwapConfirmed) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - lastRefreshRef.current;
      setSecondsUntilRefresh(Math.max(0, Math.ceil((QUOTE_REFRESH_INTERVAL - elapsed) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [quoteData, isSwapConfirmed]);

  const resetRefreshTimer = useCallback(() => {
    lastRefreshRef.current = Date.now();
    setSecondsUntilRefresh(QUOTE_REFRESH_INTERVAL / 1000);
  }, []);

  const handlePresetChange = useCallback(
    (preset: TradingPreset) => {
      setSelectedPreset(preset);
      setIsReversed(false);
      setAmountInput("");
      setTxError(null);
      setExecuting(false);
      reset();
    },
    [reset],
  );

  const handleFlipDirection = useCallback(() => {
    setIsReversed((current) => !current);
    setAmountInput("");
    setTxError(null);
    setExecuting(false);
    reset();
  }, [reset]);

  const handleMaxClick = useCallback(() => {
    if (balanceQuery.data?.formatted) {
      setAmountInput(balanceQuery.data.formatted);
    }
  }, [balanceQuery.data?.formatted]);

  const handleRefreshQuote = useCallback(() => {
    steps.quote.refetch();
    resetRefreshTimer();
  }, [resetRefreshTimer, steps.quote]);

  const handleRefreshAll = useCallback(() => {
    steps.quote.refetch();
    balanceQuery.refetch();
    resetRefreshTimer();
  }, [balanceQuery, resetRefreshTimer, steps.quote]);

  const handleExecuteStep = useCallback(async () => {
    setTxError(null);
    if (hasInsufficientBalance) {
      setTxError(`Insufficient ${tokenIn.symbol} balance`);
      return;
    }

    setExecuting(true);
    try {
      switch (currentStep) {
        case "approval-reset":
          await steps.approvalReset.execute();
          break;
        case "approval":
          await steps.approval.execute();
          break;
        case "permit2":
          await steps.permit2.sign();
          break;
        case "swap":
          await steps.swap.execute();
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (shouldShowExecutionError(message)) {
        setTxError(message);
      }
    } finally {
      setExecuting(false);
    }
  }, [currentStep, hasInsufficientBalance, steps, tokenIn.symbol]);

  const handleExecuteAll = useCallback(async () => {
    setTxError(null);
    if (hasInsufficientBalance) {
      setTxError(`Insufficient ${tokenIn.symbol} balance`);
      return;
    }

    setExecuting(true);
    try {
      await executeAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (shouldShowExecutionError(message)) {
        setTxError(message);
      }
    } finally {
      setExecuting(false);
    }
  }, [executeAll, hasInsufficientBalance, tokenIn.symbol]);

  const handleReset = useCallback(() => {
    reset();
    setTxError(null);
    setExecuting(false);
    balanceQuery.refetch();
    steps.quote.refetch();
    resetRefreshTimer();
  }, [balanceQuery, reset, resetRefreshTimer, steps.quote]);

  return (
    <div className="flex w-full items-start justify-center gap-6">
      <div className="sticky top-6 hidden w-120 shrink-0 space-y-4 lg:block">
        <div className="rounded-xl border border-border-muted bg-surface p-4">
          <div className="mb-3 text-xs font-medium text-text-muted">Settings</div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={permit2Disabled}
              onChange={(event) => setPermit2Disabled(event.target.checked)}
              className="h-3.5 w-3.5 rounded accent-accent"
            />
            <div>
              <div className="text-xs font-medium text-text-secondary">Disable Permit2</div>
              <div className="text-[11px] text-text-muted">Send x-permit2-disabled for proxy approval flows</div>
            </div>
          </label>
        </div>

        {isConnected && quoteData ? (
          <>
            <TradingStepIndicator
              currentStep={currentStep}
              approvalResetRequired={approvalResetRequired}
              approvalApproveRequired={approvalApproveRequired}
              permitRequired={permitRequired}
              permit2Disabled={permit2Disabled}
              approvalStatus={approvalStepStatus}
              permitPending={steps.permit2.isPending}
              swapStatus={steps.swap.transaction.status}
            />
            {steps.approvalReset.transaction.status !== "idle" && (
              <TransactionStatus
                status={steps.approvalReset.transaction.status}
                txHash={approvalResetTxHash}
              />
            )}
            {steps.approval.transaction.status !== "idle" && (
              <TransactionStatus
                status={steps.approval.transaction.status}
                txHash={approvalTxHash}
              />
            )}
            {steps.swap.transaction.status !== "idle" && (
              <TransactionStatus
                status={steps.swap.transaction.status}
                txHash={swapTxHash}
              />
            )}
          </>
        ) : (
          <div className="rounded-xl border border-border-muted bg-surface p-4">
            <div className="mb-3 text-xs font-medium text-text-muted">Swap lifecycle</div>
            <p className="text-xs text-text-muted">
              {!isConnected
                ? "Connect wallet to begin"
                : !amountInput || amountInput === "0"
                  ? "Enter an amount to get a quote"
                  : quoteLoading
                    ? "Fetching quote..."
                    : "Enter an amount to get a quote"}
            </p>
          </div>
        )}
      </div>

      <div className="w-full max-w-120 min-w-120 space-y-4">
        <div className="flex gap-2">
          {TRADING_PRESETS.map((preset) => (
            <TradingPresetTab
              key={preset.id}
              preset={preset}
              isSelected={selectedPreset.id === preset.id}
              onClick={() => handlePresetChange(preset)}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-border-muted bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Trade Info</span>
            <RefreshButton
              onClick={handleRefreshAll}
              disabled={executing || isSwapConfirmed}
              spinning={isFetchingQuote}
            />
          </div>
          <div className="space-y-1.5 rounded-xl bg-surface-raised p-3">
            <DetailRow
              label="Chain"
              value={connectedChainId === MAINNET_CHAIN_ID ? "Mainnet ready" : "Switch to Mainnet"}
            />
            <DetailRow
              label="Approval mode"
              value={approvalModeLabel}
            />
            <DetailRow
              label="Preset"
              value={selectedPreset.description}
            />
            <DetailRow
              label="Direction"
              value={`${tokenIn.symbol} → ${tokenOut.symbol}`}
            />
            {quoteData && (
              <>
                <DetailRow
                  label="Routing"
                  value={quoteData.routing}
                />
                <DetailRow
                  label="Route"
                  value={quoteData.quote.routeString ?? routeLines[0] ?? "Unavailable"}
                />
                <DetailRow
                  label="Request ID"
                  value={truncateAddress(quoteData.requestId)}
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border-muted bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Swap</span>
            <RefreshButton
              onClick={handleRefreshAll}
              disabled={executing || isSwapConfirmed}
              spinning={isFetchingQuote}
            />
          </div>

          <TokenInput
            label="You pay"
            token={tokenIn}
            value={amountInput}
            onChange={setAmountInput}
            disabled={executing || isSwapConfirmed}
            balance={balanceQuery.data?.formatted}
            balanceLoading={balanceQuery.isLoading}
            onMaxClick={handleMaxClick}
          />

          <div className="relative my-1 flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border-muted" />
            <button
              onClick={handleFlipDirection}
              disabled={executing || isSwapConfirmed}
              className="relative z-10 flex h-8 items-center justify-center gap-2 rounded-lg border border-border-muted bg-surface-raised px-3 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="text-text-secondary"
              >
                <path
                  d="M7 4v16M7 20l-4-4m4 4 4-4M17 20V4m0 0 4 4m-4-4-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[11px] font-medium text-text-secondary">Flip pair</span>
            </button>
          </div>

          <TokenInput
            label="You receive"
            token={tokenOut}
            value={outputDisplay ?? ""}
            readOnly
            loading={quoteLoading}
          />

          {quoteData && !isSwapConfirmed && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-text-tertiary text-xs">Quote refreshes in {secondsUntilRefresh}s</span>
              <button
                onClick={handleRefreshQuote}
                disabled={isFetchingQuote || executing}
                className="flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  className={cn(isFetchingQuote && "animate-spin")}
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
                Refresh quote
              </button>
            </div>
          )}

          {quoteData && outputDisplay && (
            <TradingQuoteDetails
              outputDisplay={outputDisplay}
              outputSymbol={tokenOut.symbol}
              routing={quoteData.routing}
              routeString={quoteData.quote.routeString}
              routeLines={routeLines}
              approvalMode={approvalModeLabel}
            />
          )}

          {(quoteError || txError || insufficientBalanceError) && (
            <div className="mt-3 rounded-lg bg-error-muted p-3 text-xs text-error">
              {insufficientBalanceError ?? quoteError?.message ?? txError}
            </div>
          )}

          <div className="mt-4">
            {!isConnected ? (
              <ConnectWalletButton />
            ) : isSwapConfirmed ? (
              <button
                onClick={handleReset}
                className="w-full rounded-xl bg-success/10 py-3.5 text-sm font-semibold text-success transition-all hover:bg-success/20 active:scale-[0.98]"
              >
                Swap another
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={handleExecuteAll}
                  disabled={
                    executing ||
                    !quoteData ||
                    quoteLoading ||
                    hasInsufficientBalance ||
                    amountInput === "" ||
                    amountInput === "0"
                  }
                  className={cn(
                    "glow-accent w-full rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]",
                    "bg-accent text-white hover:bg-accent-hover",
                    "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:bg-accent",
                  )}
                >
                  {executing ? `${getStepActionLabel(currentStep)}...` : !quoteData ? "Enter an amount" : "Swap"}
                </button>

                {quoteData &&
                  !executing &&
                  (currentStep === "approval-reset" || currentStep === "approval" || currentStep === "permit2") && (
                    <button
                      onClick={handleExecuteStep}
                      disabled={executing || hasInsufficientBalance}
                      className="w-full rounded-xl border border-border bg-surface-raised py-3 text-xs font-medium text-text-secondary transition-all hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {executing ? `${getStepActionLabel(currentStep)}...` : `Step: ${getStepActionLabel(currentStep)}`}
                    </button>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getStepActionLabel(step: TradingStep): string {
  switch (step) {
    case "quote":
      return "Refreshing quote";
    case "approval-reset":
      return "Reset approval";
    case "approval":
      return "Approve token";
    case "permit2":
      return "Sign permit";
    case "swap":
      return "Execute swap";
    case "completed":
      return "Completed";
  }
}
