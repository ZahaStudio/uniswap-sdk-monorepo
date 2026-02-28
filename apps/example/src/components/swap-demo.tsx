"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

import { usePoolState, useSwap, useToken, useUniswapSDK, type SwapStep } from "@zahastudio/uniswap-sdk-react";
import { zeroAddress, type Address } from "viem";
import { useAccount } from "wagmi";

import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { DetailRow } from "@/components/detail-row";
import { PoolTab } from "@/components/pool-tab";
import { RefreshButton } from "@/components/refresh-button";
import { StepIndicator } from "@/components/step-indicator";
import { SwapDetails } from "@/components/swap-details";
import { TokenInput } from "@/components/token-input";
import { TransactionStatus } from "@/components/transaction-status";
import { POOL_PRESETS, type PoolPreset, buildTokenInfo, parseTokenAmount, formatTokenAmount } from "@/lib/tokens";
import { cn, shouldShowExecutionError, placeholderToken } from "@/lib/utils";

const QUOTE_REFRESH_INTERVAL = 30_000;

export function SwapDemo() {
  const { isConnected } = useAccount();
  const { sdk } = useUniswapSDK({ chainId: 1 });

  const [selectedPreset, setSelectedPreset] = useState<PoolPreset>(POOL_PRESETS[0]!);
  const [zeroForOne, setZeroForOne] = useState(selectedPreset.zeroForOne);
  const [amountInput, setAmountInput] = useState("");
  const [useNativeETH, setUseNativeETH] = useState(false);

  const handlePresetChange = useCallback((preset: PoolPreset) => {
    setSelectedPreset(preset);
    setZeroForOne(preset.zeroForOne);
    setAmountInput("");
  }, []);

  const handleFlipDirection = useCallback(() => {
    setZeroForOne((prev) => !prev);
    setAmountInput("");
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
  const { query: poolQuery } = usePoolState(
    { poolKey },
    { enabled: true, chainId: 1, refetchInterval: QUOTE_REFRESH_INTERVAL },
  );

  const currency0Token = currency0Query.data
    ? buildTokenInfo(
        currency0Query.data.token.address,
        currency0Query.data.token.symbol,
        currency0Query.data.token.name,
        currency0Query.data.token.decimals,
      )
    : placeholderToken(poolKey.currency0 as Address);

  const currency1Token = currency1Query.data
    ? buildTokenInfo(
        currency1Query.data.token.address,
        currency1Query.data.token.symbol,
        currency1Query.data.token.name,
        currency1Query.data.token.decimals,
      )
    : placeholderToken(poolKey.currency1 as Address);

  const tokenIn = zeroForOne ? currency0Token : currency1Token;
  const tokenOut = zeroForOne ? currency1Token : currency0Token;
  const pool = poolQuery.data?.pool;

  const amountInRaw = useMemo(() => parseTokenAmount(amountInput, tokenIn.decimals), [amountInput, tokenIn.decimals]);

  const isNativeInput =
    (useNativeETH && tokenIn.address.toLowerCase() === sdk.getContractAddress("weth").toLowerCase()) ||
    tokenIn.address.toLowerCase() === zeroAddress.toLowerCase();

  // Fetch balance for the input token
  const { query: tokenInQuery } = useToken(
    { tokenAddress: isNativeInput ? zeroAddress : tokenIn.address },
    { enabled: isConnected, chainId: 1, refetchInterval: 15_000 },
  );

  const handleMaxClick = useCallback(() => {
    if (tokenInQuery.data?.balance) setAmountInput(tokenInQuery.data.balance.formatted);
  }, [tokenInQuery.data?.balance]);

  const swap = useSwap(
    { poolKey, amountIn: amountInRaw, zeroForOne, slippageBps: 50, useNativeETH: useNativeETH || undefined },
    { enabled: amountInRaw > 0n, refetchInterval: QUOTE_REFRESH_INTERVAL, chainId: 1 },
  );

  const { steps, currentStep, executeAll, reset } = swap;
  const quoteData = steps.quote.data;
  const quoteLoading = steps.quote.isLoading;
  const quoteError = steps.quote.error;
  const isFetchingQuote = steps.quote.isFetching;

  const isSwapConfirmed = steps.swap.transaction.status === "confirmed";
  const swapTxHash = steps.swap.transaction.txHash;
  const hasInsufficientBalance =
    amountInRaw > 0n && tokenInQuery.data?.balance !== undefined && amountInRaw > tokenInQuery.data.balance.raw;

  // Countdown timer for quote auto-refresh
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
    poolQuery.refetch();
    resetRefreshTimer();
  }, [steps.quote, tokenInQuery, poolQuery, resetRefreshTimer]);

  const outputDisplay = quoteData ? formatTokenAmount(quoteData.amountOut, tokenOut.decimals) : undefined;
  const minOutputDisplay = quoteData ? formatTokenAmount(quoteData.minAmountOut, tokenOut.decimals) : undefined;

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
          await steps.approval.transaction.waitForConfirmation();
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
    poolQuery.refetch();
    resetRefreshTimer();
  }, [reset, steps.quote, tokenInQuery, poolQuery, resetRefreshTimer]);

  const insufficientBalanceError = hasInsufficientBalance ? `Insufficient ${tokenIn.symbol} balance` : null;

  return (
    <div className="flex w-full items-start justify-center gap-6">
      {/* Left panel: Lifecycle + Settings */}
      <div className="sticky top-6 hidden w-120 shrink-0 space-y-4 lg:block">
        {/* Settings panel */}
        <div className="border-border-muted bg-surface rounded-xl border p-4">
          <div className="text-text-muted mb-3 text-xs font-medium">Settings</div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={useNativeETH}
              onChange={(e) => setUseNativeETH(e.target.checked)}
              className="accent-accent h-3.5 w-3.5 rounded"
            />
            <div>
              <div className="text-text-secondary text-xs font-medium">Use native ETH</div>
              <div className="text-text-muted text-[11px]">Wrap/unwrap ETH for WETH pools</div>
            </div>
          </label>
        </div>

        {/* Lifecycle panel */}
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
          <div className="border-border-muted bg-surface rounded-xl border p-4">
            <div className="text-text-muted mb-3 text-xs font-medium">Swap lifecycle</div>
            <p className="text-text-muted text-xs">
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

      {/* Main content */}
      <div className="w-full max-w-120 min-w-120 space-y-4">
        {/* Pool selector tabs */}
        <div className="flex gap-2">
          {POOL_PRESETS.map((preset) => (
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
                disabled={executing || isSwapConfirmed}
                spinning={isFetchingQuote || poolQuery.isFetching}
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
                value={`${pool.token0Price.toSignificant(6)} ${currency1Token.symbol} per ${currency0Token.symbol}`}
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

        {/* Swap card */}
        <div className="border-border-muted bg-surface rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-text-muted text-xs font-medium">Swap</span>
            <RefreshButton
              onClick={handleRefreshAll}
              disabled={executing || isSwapConfirmed}
              spinning={isFetchingQuote}
            />
          </div>

          {/* Input */}
          <TokenInput
            label="You pay"
            token={tokenIn}
            value={amountInput}
            onChange={setAmountInput}
            disabled={executing || isSwapConfirmed}
            balance={tokenInQuery.data?.balance?.formatted}
            balanceLoading={tokenInQuery.isLoading}
            onMaxClick={handleMaxClick}
          />

          {/* Flip direction button */}
          <div className="relative my-1 flex items-center justify-center">
            <div className="bg-border-muted absolute inset-x-0 top-1/2 h-px" />
            <button
              onClick={handleFlipDirection}
              disabled={executing || isSwapConfirmed}
              className="border-border-muted bg-surface-raised hover:bg-surface-hover relative z-10 flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
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

          {/* Output */}
          <TokenInput
            label="You receive"
            token={tokenOut}
            value={outputDisplay ?? ""}
            readOnly
            loading={quoteLoading}
          />

          {/* Quote refresh countdown */}
          {quoteData && !isSwapConfirmed && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-text-tertiary text-xs">Quote refreshes in {secondsUntilRefresh}s</span>
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
              outputSymbol={tokenOut.symbol}
              slippageBps={50}
            />
          )}

          {/* Error display */}
          {(quoteError || txError || insufficientBalanceError) && (
            <div className="bg-error-muted text-error mt-3 rounded-lg p-3 text-xs">
              {insufficientBalanceError ?? quoteError?.message ?? txError}
            </div>
          )}

          {/* Action button */}
          <div className="mt-4">
            {!isConnected ? (
              <ConnectWalletButton />
            ) : isSwapConfirmed ? (
              <button
                onClick={handleReset}
                className="bg-success/10 text-success hover:bg-success/20 w-full rounded-xl py-3.5 text-sm font-semibold transition-all active:scale-[0.98]"
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
                    "bg-accent hover:bg-accent-hover text-white",
                    "disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
                  )}
                >
                  {executing ? getStepActionLabel(currentStep) + "..." : !quoteData ? "Enter an amount" : "Swap"}
                </button>

                {quoteData && !executing && (currentStep === "approval" || currentStep === "permit2") && (
                  <button
                    onClick={handleExecuteStep}
                    disabled={executing || hasInsufficientBalance}
                    className="border-border bg-surface-raised text-text-secondary hover:bg-surface-hover w-full rounded-xl border py-3 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40"
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
