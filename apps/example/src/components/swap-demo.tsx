"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

import { useQuery } from "@tanstack/react-query";
import { TradeType } from "@zahastudio/uniswap-sdk";
import { useSwap, useToken, useUniswapSDK, type SwapStep } from "@zahastudio/uniswap-sdk-react";
import { zeroAddress } from "viem";
import { useAccount } from "wagmi";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { DetailRow } from "@/components/detail-row";
import { RefreshButton } from "@/components/refresh-button";
import { StepIndicator } from "@/components/step-indicator";
import { SwapDetails } from "@/components/swap-details";
import { TokenInput } from "@/components/token-input";
import { TransactionStatus } from "@/components/transaction-status";
import {
  SWAP_PRESETS,
  type SwapPreset,
  buildTokenInfo,
  formatTokenAmount,
  parseTokenAmount,
  resolveRouteOutputCurrency,
  reverseSwapRoute,
} from "@/lib/tokens";
import { cn, placeholderToken, shouldShowExecutionError } from "@/lib/utils";

const QUOTE_REFRESH_INTERVAL = 30_000;
const SWAP_CHAIN_ID = 1;

export function SwapDemo() {
  const { isConnected } = useAccount();
  const { sdk } = useUniswapSDK({ chainId: SWAP_CHAIN_ID });

  const [tradeType, setTradeType] = useState<typeof TradeType.ExactInput | typeof TradeType.ExactOutput>(
    TradeType.ExactInput,
  );
  const [selectedPreset, setSelectedPreset] = useState<SwapPreset>(SWAP_PRESETS[0]!);
  const [isReversed, setIsReversed] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [useNativeETH, setUseNativeETH] = useState(false);

  const defaultOutputCurrency = useMemo(
    () => resolveRouteOutputCurrency(selectedPreset.currencyIn, selectedPreset.route),
    [selectedPreset],
  );
  const activeCurrencyIn = isReversed ? defaultOutputCurrency : selectedPreset.currencyIn;
  const activeRoute = useMemo(
    () => (isReversed ? reverseSwapRoute(selectedPreset.route) : selectedPreset.route),
    [isReversed, selectedPreset.route],
  );
  const activeCurrencyOut = useMemo(
    () => resolveRouteOutputCurrency(activeCurrencyIn, activeRoute),
    [activeCurrencyIn, activeRoute],
  );

  const handlePresetChange = useCallback((preset: SwapPreset) => {
    setSelectedPreset(preset);
    setIsReversed(false);
    setAmountInput("");
  }, []);

  const handleFlipDirection = useCallback(() => {
    setIsReversed((prev) => !prev);
    setAmountInput("");
  }, []);

  const wethAddress = sdk.getContractAddress("weth").toLowerCase();
  const displayCurrencyIn =
    useNativeETH && activeCurrencyIn.toLowerCase() === wethAddress ? zeroAddress : activeCurrencyIn;
  const displayCurrencyOut =
    useNativeETH && activeCurrencyOut.toLowerCase() === wethAddress ? zeroAddress : activeCurrencyOut;

  const { query: inputTokenDisplayQuery } = useToken(
    { tokenAddress: displayCurrencyIn },
    { enabled: true, chainId: SWAP_CHAIN_ID },
  );
  const { query: outputTokenDisplayQuery } = useToken(
    { tokenAddress: displayCurrencyOut },
    { enabled: true, chainId: SWAP_CHAIN_ID },
  );

  const tokenIn = inputTokenDisplayQuery.data
    ? buildTokenInfo(
        inputTokenDisplayQuery.data.token.address,
        inputTokenDisplayQuery.data.token.symbol,
        inputTokenDisplayQuery.data.token.name,
        inputTokenDisplayQuery.data.token.decimals,
      )
    : placeholderToken(displayCurrencyIn);

  const tokenOut = outputTokenDisplayQuery.data
    ? buildTokenInfo(
        outputTokenDisplayQuery.data.token.address,
        outputTokenDisplayQuery.data.token.symbol,
        outputTokenDisplayQuery.data.token.name,
        outputTokenDisplayQuery.data.token.decimals,
      )
    : placeholderToken(displayCurrencyOut);

  const exactAmountRaw = useMemo(
    () => parseTokenAmount(amountInput, tradeType === TradeType.ExactOutput ? tokenOut.decimals : tokenIn.decimals),
    [amountInput, tokenIn.decimals, tokenOut.decimals, tradeType],
  );
  const isNativeInput = displayCurrencyIn.toLowerCase() === zeroAddress.toLowerCase();

  const { query: tokenInQuery } = useToken(
    { tokenAddress: displayCurrencyIn },
    { enabled: isConnected, chainId: SWAP_CHAIN_ID, refetchInterval: 15_000 },
  );

  const routePoolsQuery = useQuery({
    queryKey: ["swap-demo-route-pools", selectedPreset.poolId, isReversed],
    queryFn: () => Promise.all(activeRoute.map(({ poolKey }) => sdk.getPool(poolKey))),
    enabled: true,
    refetchInterval: QUOTE_REFRESH_INTERVAL,
  });

  const handleMaxClick = useCallback(() => {
    if (tradeType === TradeType.ExactInput && tokenInQuery.data?.balance) {
      setAmountInput(tokenInQuery.data.balance.formatted);
    }
  }, [tokenInQuery.data?.balance, tradeType]);

  const swapParams = useMemo(
    () =>
      tradeType === TradeType.ExactOutput
        ? {
            tradeType: TradeType.ExactOutput,
            currencyOut: activeCurrencyOut,
            route: activeRoute,
            amountOut: exactAmountRaw,
            slippageBps: 50,
            useNativeETH: useNativeETH,
          }
        : {
            tradeType: TradeType.ExactInput,
            currencyIn: activeCurrencyIn,
            route: activeRoute,
            amountIn: exactAmountRaw,
            slippageBps: 50,
            useNativeETH: useNativeETH,
          },
    [activeCurrencyIn, activeCurrencyOut, activeRoute, exactAmountRaw, tradeType, useNativeETH],
  );

  const swap = useSwap(swapParams, {
    enabled: exactAmountRaw > 0n,
    refetchInterval: QUOTE_REFRESH_INTERVAL,
    chainId: SWAP_CHAIN_ID,
  });

  const { steps, currentStep, executeAll, reset } = swap;
  const quoteData = steps.quote.data;
  const quoteLoading = steps.quote.isLoading;
  const quoteError = steps.quote.error;
  const isFetchingQuote = steps.quote.isFetching;
  const routePools = routePoolsQuery.data;

  const isSwapConfirmed = steps.swap.transaction.status === "confirmed";
  const swapTxHash = steps.swap.transaction.txHash;
  const maxSpendAmount =
    tradeType === TradeType.ExactOutput && quoteData?.tradeType === TradeType.ExactOutput
      ? quoteData.maxAmountIn
      : exactAmountRaw;
  const hasInsufficientBalance =
    maxSpendAmount > 0n && tokenInQuery.data?.balance !== undefined && maxSpendAmount > tokenInQuery.data.balance.raw;

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
      setSecondsUntilRefresh(Math.max(0, Math.ceil((QUOTE_REFRESH_INTERVAL - elapsed) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [quoteData, isSwapConfirmed]);

  const resetRefreshTimer = useCallback(() => {
    lastRefreshRef.current = Date.now();
    setSecondsUntilRefresh(QUOTE_REFRESH_INTERVAL / 1000);
  }, []);

  const handleRefreshQuote = useCallback(() => {
    steps.quote.refetch();
    resetRefreshTimer();
  }, [steps.quote, resetRefreshTimer]);

  const handleRefreshAll = useCallback(() => {
    steps.quote.refetch();
    tokenInQuery.refetch();
    routePoolsQuery.refetch();
    resetRefreshTimer();
  }, [steps.quote, tokenInQuery, routePoolsQuery, resetRefreshTimer]);

  const outputDisplay =
    tradeType === TradeType.ExactOutput
      ? amountInput
      : quoteData
        ? formatTokenAmount(quoteData.amountOut, tokenOut.decimals)
        : undefined;
  const inputDisplay =
    tradeType === TradeType.ExactOutput
      ? quoteData
        ? formatTokenAmount(quoteData.amountIn, tokenIn.decimals)
        : ""
      : amountInput;
  const minOutputDisplay =
    quoteData?.tradeType === TradeType.ExactInput
      ? formatTokenAmount(quoteData.minAmountOut, tokenOut.decimals)
      : undefined;
  const maxInputDisplay =
    quoteData?.tradeType === TradeType.ExactOutput
      ? formatTokenAmount(quoteData.maxAmountIn, tokenIn.decimals)
      : undefined;
  const routeLabel = `${activeRoute.length} hop${activeRoute.length === 1 ? "" : "s"} via ${selectedPreset.label}`;

  const [executing, setExecuting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const handleExecuteStep = useCallback(async () => {
    setTxError(null);
    if (hasInsufficientBalance) {
      setTxError(`Insufficient ${tokenIn.symbol} balance`);
      return;
    }
    setExecuting(true);
    try {
      switch (currentStep) {
        case "approval":
          await steps.approval.approve();
          break;
        case "permit2":
          await steps.permit2.sign();
          break;
        case "swap":
          await steps.swap.execute();
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) setTxError(msg);
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) setTxError(msg);
    } finally {
      setExecuting(false);
    }
  }, [executeAll, hasInsufficientBalance, tokenIn.symbol]);

  const handleReset = useCallback(() => {
    reset();
    setTxError(null);
    setExecuting(false);
    tokenInQuery.refetch();
    steps.quote.refetch();
    routePoolsQuery.refetch();
    resetRefreshTimer();
  }, [reset, steps.quote, tokenInQuery, routePoolsQuery, resetRefreshTimer]);

  const insufficientBalanceError = hasInsufficientBalance ? `Insufficient ${tokenIn.symbol} balance` : null;

  const handleTradeTypeChange = useCallback(
    (nextTradeType: typeof TradeType.ExactInput | typeof TradeType.ExactOutput) => {
      setTradeType(nextTradeType);
      setAmountInput("");
    },
    [],
  );

  return (
    <div className="flex w-full items-start justify-center gap-6">
      <div className="sticky top-6 hidden w-120 shrink-0 space-y-4 lg:block">
        <div className="rounded-xl border border-border-muted bg-surface p-4">
          <div className="mb-3 text-xs font-medium text-text-muted">Settings</div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={useNativeETH}
              onChange={(e) => setUseNativeETH(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-accent"
            />
            <div>
              <div className="text-xs font-medium text-text-secondary">Use native ETH</div>
              <div className="text-[11px] text-text-muted">Wrap/unwrap ETH for WETH route edges</div>
            </div>
          </label>
        </div>

        {isConnected && quoteData ? (
          <>
            <StepIndicator
              currentStep={currentStep}
              approval={steps.approval}
              permit2={steps.permit2}
              swapTx={steps.swap.transaction}
              isNativeInput={isNativeInput}
            />
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
          {SWAP_PRESETS.map((preset) => (
            <button
              key={preset.poolId}
              onClick={() => handlePresetChange(preset)}
              className={cn(
                "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                selectedPreset.poolId === preset.poolId
                  ? "border-accent/30 bg-accent-muted text-accent"
                  : "border-border-muted bg-surface text-text-secondary hover:border-border hover:bg-surface-hover",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {routePools && (
          <div className="rounded-2xl border border-border-muted bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Route Info</span>
              <RefreshButton
                onClick={handleRefreshAll}
                disabled={executing || isSwapConfirmed}
                spinning={isFetchingQuote || routePoolsQuery.isFetching}
              />
            </div>
            <div className="space-y-3 rounded-xl bg-surface-raised p-3">
              <DetailRow
                label="Route"
                value={routeLabel}
              />
              <DetailRow
                label="Input"
                value={tokenIn.symbol}
              />
              <DetailRow
                label="Output"
                value={tokenOut.symbol}
              />
              {routePools.map((pool, index) => (
                <div
                  key={`${pool.poolId}-${index}`}
                  className="rounded-lg border border-border-muted/60 bg-surface px-3 py-2"
                >
                  <div className="mb-2 text-xs font-medium text-text-secondary">Hop {index + 1}</div>
                  <div className="space-y-1.5">
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
                      label="Liquidity"
                      value={pool.liquidity.toString()}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {routePoolsQuery.isLoading && (
          <div className="flex items-center justify-center rounded-2xl border border-border-muted bg-surface p-6">
            <div className="animate-pulse text-sm text-text-secondary">Loading route...</div>
          </div>
        )}

        {routePoolsQuery.error && (
          <div className="rounded-xl bg-error-muted p-3 text-xs text-error">{routePoolsQuery.error.message}</div>
        )}

        <div className="rounded-2xl border border-border-muted bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Swap</span>
            <RefreshButton
              onClick={handleRefreshAll}
              disabled={executing || isSwapConfirmed}
              spinning={isFetchingQuote}
            />
          </div>

          <div className="mb-3 flex gap-2">
            <button
              onClick={() => handleTradeTypeChange(TradeType.ExactInput)}
              disabled={executing || isSwapConfirmed}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                tradeType === TradeType.ExactInput
                  ? "border-accent/30 bg-accent-muted text-accent"
                  : "border-border-muted bg-surface-raised text-text-secondary hover:border-border hover:bg-surface-hover",
              )}
            >
              Exact input
            </button>
            <button
              onClick={() => handleTradeTypeChange(TradeType.ExactOutput)}
              disabled={executing || isSwapConfirmed}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                tradeType === TradeType.ExactOutput
                  ? "border-accent/30 bg-accent-muted text-accent"
                  : "border-border-muted bg-surface-raised text-text-secondary hover:border-border hover:bg-surface-hover",
              )}
            >
              Exact output
            </button>
          </div>

          <TokenInput
            label="You pay"
            token={tokenIn}
            value={inputDisplay}
            onChange={tradeType === TradeType.ExactInput ? setAmountInput : undefined}
            readOnly={tradeType === TradeType.ExactOutput}
            disabled={executing || isSwapConfirmed}
            loading={tradeType === TradeType.ExactOutput && quoteLoading}
            balance={tokenInQuery.data?.balance?.formatted}
            balanceLoading={tokenInQuery.isLoading}
            onMaxClick={tradeType === TradeType.ExactInput ? handleMaxClick : undefined}
          />

          <div className="relative my-1 flex items-center justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border-muted" />
            <button
              onClick={handleFlipDirection}
              disabled={executing || isSwapConfirmed}
              className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-border-muted bg-surface-raised transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
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
            </button>
          </div>

          <TokenInput
            label="You receive"
            token={tokenOut}
            value={outputDisplay ?? ""}
            onChange={tradeType === TradeType.ExactOutput ? setAmountInput : undefined}
            readOnly={tradeType === TradeType.ExactInput}
            loading={tradeType === TradeType.ExactInput && quoteLoading}
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

          {quoteData && (
            <SwapDetails
              tradeType={tradeType}
              inputSymbol={tokenIn.symbol}
              outputSymbol={tokenOut.symbol}
              slippageBps={50}
              routeLabel={routeLabel}
              minOutput={minOutputDisplay}
              maxInput={maxInputDisplay}
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
                  {executing
                    ? getStepActionLabel(currentStep) + "..."
                    : !quoteData
                      ? `Enter a ${tradeType === TradeType.ExactOutput ? "receive" : "pay"} amount`
                      : "Swap"}
                </button>

                {quoteData && !executing && (currentStep === "approval" || currentStep === "permit2") && (
                  <button
                    onClick={handleExecuteStep}
                    disabled={executing || hasInsufficientBalance}
                    className="w-full rounded-xl border border-border bg-surface-raised py-3 text-xs font-medium text-text-secondary transition-all hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {executing ? getStepActionLabel(currentStep) + "..." : `Step: ${getStepActionLabel(currentStep)}`}
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
