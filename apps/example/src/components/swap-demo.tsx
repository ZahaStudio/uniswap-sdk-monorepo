"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSwap, useToken, type SwapStep } from "@zahastudio/uniswap-sdk-react";
import { useAccount } from "wagmi";

import { StepIndicator } from "@/components/step-indicator";
import { SwapDetails } from "@/components/swap-details";
import { TokenInput } from "@/components/token-input";
import { TransactionStatus } from "@/components/transaction-status";
import {
  SWAP_PRESETS,
  type SwapPairPreset,
  getPoolKeyFromPreset,
  parseTokenAmount,
  formatTokenAmount,
} from "@/lib/tokens";
import { cn } from "@/lib/utils";

const QUOTE_REFRESH_INTERVAL = 30_000;

function shouldShowExecutionError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return !normalizedMessage.includes("user rejected") && !normalizedMessage.includes("user denied");
}

export function SwapDemo() {
  const { isConnected } = useAccount();

  const [selectedPreset, setSelectedPreset] = useState<SwapPairPreset>(SWAP_PRESETS[1]!);
  const [amountInput, setAmountInput] = useState(selectedPreset.defaultAmount);

  const handlePresetChange = useCallback((preset: SwapPairPreset) => {
    setSelectedPreset(preset);
    setAmountInput(preset.defaultAmount);
  }, []);

  const { poolKey, zeroForOne } = useMemo(() => getPoolKeyFromPreset(selectedPreset), [selectedPreset]);

  const amountInRaw = useMemo(
    () => parseTokenAmount(amountInput, selectedPreset.tokenIn.decimals),
    [amountInput, selectedPreset.tokenIn.decimals],
  );

  const tokenIn = useToken(selectedPreset.tokenIn.address, {
    enabled: isConnected,
    chainId: 1,
    refetchInterval: 15_000,
  });

  const handleMaxClick = useCallback(() => {
    if (tokenIn.balance) {
      setAmountInput(tokenIn.balance.formatted);
    }
  }, [tokenIn.balance]);

  const swap = useSwap(
    {
      poolKey,
      amountIn: amountInRaw,
      zeroForOne,
      slippageBps: 50, // 0.5%
    },
    {
      enabled: amountInRaw > 0n,
      refetchInterval: QUOTE_REFRESH_INTERVAL,
      chainId: 1,
    },
  );

  const { steps, currentStep, executeAll, reset } = swap;

  const quoteData = steps.quote.data;
  const quoteLoading = steps.quote.isLoading;
  const quoteError = steps.quote.error;
  const quoteRefetch = steps.quote.refetch;
  const isFetchingQuote = steps.quote.isFetching;

  const isSwapConfirmed = steps.swap.transaction.status === "confirmed";
  const swapTxHash = steps.swap.transaction.txHash;

  // Countdown timer for next auto-refresh
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(QUOTE_REFRESH_INTERVAL / 1000);
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    if (!quoteData || isSwapConfirmed) return;
    lastRefreshRef.current = Date.now();
    setSecondsUntilRefresh(QUOTE_REFRESH_INTERVAL / 1000);
  }, [quoteData, isSwapConfirmed]);

  useEffect(() => {
    if (!quoteData || isSwapConfirmed) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastRefreshRef.current;
      const remaining = Math.max(0, Math.ceil((QUOTE_REFRESH_INTERVAL - elapsed) / 1000));
      setSecondsUntilRefresh(remaining);
    }, 1000);
    return () => clearInterval(timer);
  }, [quoteData, isSwapConfirmed]);

  const handleRefreshQuote = useCallback(() => {
    quoteRefetch();
    lastRefreshRef.current = Date.now();
    setSecondsUntilRefresh(QUOTE_REFRESH_INTERVAL / 1000);
  }, [quoteRefetch]);

  const outputDisplay = quoteData
    ? formatTokenAmount(quoteData.amountOut, selectedPreset.tokenOut.decimals)
    : undefined;
  const minOutputDisplay = quoteData
    ? formatTokenAmount(quoteData.minAmountOut, selectedPreset.tokenOut.decimals)
    : undefined;

  const [executing, setExecuting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const handleExecuteStep = useCallback(async () => {
    setTxError(null);
    setExecuting(true);
    try {
      switch (currentStep) {
        case "approval":
          await steps.approval.approve();
          await steps.approval.transaction.waitForConfirmation();
          break;
        case "permit2":
          await steps.permit2.sign();
          break;
        case "swap":
          await steps.swap.execute();
          break;
        default:
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) {
        setTxError(msg);
      }
    } finally {
      setExecuting(false);
    }
  }, [currentStep, steps]);

  const handleExecuteAll = useCallback(async () => {
    setTxError(null);
    setExecuting(true);
    try {
      await executeAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) {
        setTxError(msg);
      }
    } finally {
      setExecuting(false);
    }
  }, [executeAll]);

  const handleReset = useCallback(() => {
    reset();
    setTxError(null);
    setExecuting(false);
    // Refresh quote for the next swap
    quoteRefetch();
    lastRefreshRef.current = Date.now();
    setSecondsUntilRefresh(QUOTE_REFRESH_INTERVAL / 1000);
  }, [reset, quoteRefetch]);

  return (
    <div className="w-full max-w-120 space-y-4">
      {/* Pair selector tabs */}
      <div className="flex gap-2">
        {SWAP_PRESETS.map((preset) => (
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

      {/* Swap card */}
      <div className="border-border-muted bg-surface rounded-2xl border p-4">
        {/* Input */}
        <TokenInput
          label="You pay"
          token={selectedPreset.tokenIn}
          value={amountInput}
          onChange={setAmountInput}
          disabled={executing || isSwapConfirmed}
          balance={tokenIn.balance?.formatted}
          balanceLoading={tokenIn.isLoadingBalance}
          onMaxClick={handleMaxClick}
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
                d="M12 5v14M19 12l-7 7-7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Output */}
        <TokenInput
          label="You receive"
          token={selectedPreset.tokenOut}
          value={outputDisplay ?? ""}
          readOnly
          loading={quoteLoading}
        />

        {/* Refresh quote */}
        {quoteData && !isSwapConfirmed && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-text-tertiary text-xs">
              Quote refreshes in {secondsUntilRefresh}s
            </span>
            <button
              onClick={handleRefreshQuote}
              disabled={isFetchingQuote || executing}
              className="text-accent hover:text-accent-hover flex items-center gap-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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

        {/* Swap details */}
        {quoteData && (
          <SwapDetails
            minOutput={minOutputDisplay!}
            outputSymbol={selectedPreset.tokenOut.symbol}
            slippageBps={50}
            gasEstimate={quoteData.estimatedGasUsed}
          />
        )}

        {/* Error display */}
        {(quoteError || txError) && (
          <div className="bg-error-muted text-error mt-3 rounded-lg p-3 text-xs">{quoteError?.message ?? txError}</div>
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
          ) : isSwapConfirmed ? (
            <button
              onClick={handleReset}
              className="bg-success/10 text-success hover:bg-success/20 w-full rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
            >
              Swap another
            </button>
          ) : (
            <div className="space-y-2">
              {/* Execute all button */}
              <button
                onClick={handleExecuteAll}
                disabled={executing || !quoteData || quoteLoading || amountInput === "" || amountInput === "0"}
                className={cn(
                  "glow-accent w-full rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]",
                  "bg-accent hover:bg-accent-hover text-white",
                  "disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
                )}
              >
                {executing ? getStepActionLabel(currentStep) + "..." : !quoteData ? "Enter an amount" : "Swap"}
              </button>

              {/* Individual step button (when not using executeAll) */}
              {quoteData && currentStep !== "quote" && currentStep !== "completed" && (
                <button
                  onClick={handleExecuteStep}
                  disabled={executing}
                  className="border-border bg-surface-raised text-text-secondary hover:bg-surface-hover w-full rounded-xl border py-3 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {executing ? getStepActionLabel(currentStep) + "..." : `Step: ${getStepActionLabel(currentStep)}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Step indicator */}
      {isConnected && quoteData && (
        <StepIndicator
          currentStep={currentStep}
          approval={steps.approval}
          permit2={steps.permit2}
          swapTx={steps.swap.transaction}
          isNativeInput={selectedPreset.tokenIn.address === "0x0000000000000000000000000000000000000000"}
        />
      )}

      {/* Transaction status */}
      {steps.swap.transaction.status !== "idle" && (
        <TransactionStatus
          status={steps.swap.transaction.status}
          txHash={swapTxHash}
        />
      )}
    </div>
  );
}

function getStepActionLabel(step: SwapStep): string {
  switch (step) {
    case "quote":
      return "Fetching quote";
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
