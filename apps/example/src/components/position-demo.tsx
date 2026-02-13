"use client";

import { useState, useCallback, useMemo } from "react";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  usePosition,
  usePositionCollectFees,
  usePositionRemoveLiquidity,
  useUniswapSDK,
  type TransactionStatus,
} from "@zahastudio/uniswap-sdk-react";
import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";

import { formatTokenAmount } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const ERC721_OWNER_ABI = [
  {
    name: "ownerOf",
    type: "function",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

function shouldShowExecutionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return !normalized.includes("user rejected") && !normalized.includes("user denied");
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

const REMOVE_PRESETS = [
  { label: "25%", value: 2500 },
  { label: "50%", value: 5000 },
  { label: "75%", value: 7500 },
  { label: "100%", value: 10000 },
];

export function PositionDemo() {
  const { address, isConnected } = useAccount();
  const { sdk } = useUniswapSDK({ chainId: 1 });

  const [tokenIdInput, setTokenIdInput] = useState("");
  const [activeTokenId, setActiveTokenId] = useState("");

  const handleLoad = useCallback(() => {
    const trimmed = tokenIdInput.trim();
    if (trimmed && /^\d+$/.test(trimmed)) {
      setActiveTokenId(trimmed);
    }
  }, [tokenIdInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleLoad();
    },
    [handleLoad],
  );

  // ── Position data ──────────────────────────────────────────────────────────
  const { query: positionQuery } = usePosition(
    { tokenId: activeTokenId },
    { enabled: !!activeTokenId, chainId: 1, refetchInterval: 15_000 },
  );

  // ── Owner check ────────────────────────────────────────────────────────────
  const positionManagerAddress = sdk?.getContractAddress("positionManager") as Address | undefined;
  const ownerTokenId = activeTokenId ? BigInt(activeTokenId) : 0n;
  const { data: owner, isLoading: ownerLoading } = useReadContract({
    address: positionManagerAddress!,
    abi: ERC721_OWNER_ABI,
    functionName: "ownerOf",
    args: [ownerTokenId],
    query: { enabled: !!activeTokenId && !!positionManagerAddress },
  });

  const isOwner = useMemo(() => {
    if (!address || !owner) return false;
    return address.toLowerCase() === (owner as string).toLowerCase();
  }, [address, owner]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const collectFees = usePositionCollectFees({ tokenId: activeTokenId }, { chainId: 1 });
  const removeLiquidity = usePositionRemoveLiquidity({ tokenId: activeTokenId }, { chainId: 1 });

  const [collectExecuting, setCollectExecuting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [removeExecuting, setRemoveExecuting] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removePercentage, setRemovePercentage] = useState<number | null>(null);

  const handleCollectFees = useCallback(async () => {
    if (!address) return;
    setCollectError(null);
    setCollectExecuting(true);
    try {
      await collectFees.execute({ recipient: address });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) setCollectError(msg);
    } finally {
      setCollectExecuting(false);
    }
  }, [address, collectFees]);

  const handleRemoveLiquidity = useCallback(async () => {
    if (removePercentage === null) return;
    setRemoveError(null);
    setRemoveExecuting(true);
    try {
      await removeLiquidity.execute({ liquidityPercentage: removePercentage });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (shouldShowExecutionError(msg)) setRemoveError(msg);
    } finally {
      setRemoveExecuting(false);
    }
  }, [removePercentage, removeLiquidity]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const data = positionQuery.data;

  const symbol0 = data?.currency0?.symbol ?? "???";
  const symbol1 = data?.currency1?.symbol ?? "???";
  const decimals0 = data?.currency0?.decimals ?? 18;
  const decimals1 = data?.currency1?.decimals ?? 18;

  const inRange = data
    ? data.currentTick >= data.position.tickLower && data.currentTick < data.position.tickUpper
    : false;

  const hasUncollectedFees = data
    ? data.periphery.uncollectedFees.amount0 > 0n || data.periphery.uncollectedFees.amount1 > 0n
    : false;

  return (
    <div className="w-full max-w-120 space-y-4">
      {/* Token ID input */}
      <div className="border-border-muted bg-surface rounded-2xl border p-4">
        <label className="text-text-muted mb-2 block text-xs font-medium">Position Token ID</label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter token ID..."
            value={tokenIdInput}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*$/.test(val)) setTokenIdInput(val);
            }}
            onKeyDown={handleKeyDown}
            className="text-text placeholder:text-text-muted bg-surface-raised min-w-0 flex-1 rounded-xl px-4 py-3 text-sm font-medium outline-none"
          />
          <button
            onClick={handleLoad}
            disabled={!tokenIdInput.trim() || !/^\d+$/.test(tokenIdInput.trim())}
            className={cn(
              "glow-accent rounded-xl px-6 py-3 text-sm font-semibold transition-all active:scale-[0.98]",
              "bg-accent hover:bg-accent-hover text-white",
              "disabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
            )}
          >
            Load
          </button>
        </div>
      </div>

      {/* Loading */}
      {activeTokenId && positionQuery.isLoading && (
        <div className="border-border-muted bg-surface flex items-center justify-center rounded-2xl border p-8">
          <div className="text-text-secondary animate-pulse text-sm">Loading position #{activeTokenId}...</div>
        </div>
      )}

      {/* Error */}
      {positionQuery.error && (
        <div className="bg-error-muted text-error rounded-xl p-3 text-xs">{positionQuery.error.message}</div>
      )}

      {/* Position data */}
      {data && (
        <>
          {/* ── Overview card ── */}
          <div className="border-border-muted bg-surface space-y-4 rounded-2xl border p-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-text text-lg font-semibold">Position #{activeTokenId}</h2>
                <p className="text-text-secondary text-sm">
                  {symbol0} / {symbol1}
                  <span className="text-text-muted ml-2 text-xs">{data.pool.fee / 10000}% fee</span>
                </p>
              </div>
              <div
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  inRange ? "bg-success-muted text-success" : "bg-warning-muted text-warning",
                )}
              >
                {inRange ? "In range" : "Out of range"}
              </div>
            </div>

            {/* Owner */}
            <div className="bg-surface-raised rounded-xl p-3">
              <div className="text-text-muted mb-1 text-xs font-medium">Owner</div>
              <div className="flex items-center gap-2">
                {ownerLoading ? (
                  <span className="text-text-secondary animate-pulse font-mono text-sm">Loading...</span>
                ) : owner ? (
                  <>
                    <span className="text-text font-mono text-sm">{truncateAddress(owner as string)}</span>
                    {isOwner && (
                      <span className="bg-accent-muted text-accent rounded px-1.5 py-0.5 text-[10px] font-semibold">
                        You
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-text-muted text-sm">Unknown</span>
                )}
              </div>
            </div>

            {/* Price range */}
            <div className="bg-surface-raised space-y-2 rounded-xl p-3">
              <div className="text-text-muted text-xs font-medium">Price Range</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-surface rounded-lg p-2.5">
                  <div className="text-text-muted text-[10px] font-medium">Lower</div>
                  <div className="text-text text-sm font-semibold">
                    {data.position.token0PriceLower.toSignificant(6)}
                  </div>
                  <div className="text-text-muted text-[10px]">
                    {symbol1} per {symbol0}
                  </div>
                </div>
                <div className="bg-surface rounded-lg p-2.5">
                  <div className="text-text-muted text-[10px] font-medium">Upper</div>
                  <div className="text-text text-sm font-semibold">
                    {data.position.token0PriceUpper.toSignificant(6)}
                  </div>
                  <div className="text-text-muted text-[10px]">
                    {symbol1} per {symbol0}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted">Current price</span>
                <span className="text-text-secondary font-mono">
                  {data.pool.token0Price.toSignificant(6)} {symbol1} per {symbol0}
                </span>
              </div>
            </div>

            {/* Token amounts */}
            <div className="bg-surface-raised space-y-1.5 rounded-xl p-3">
              <div className="text-text-muted text-xs font-medium">Position Tokens</div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">{symbol0}</span>
                <span className="text-text font-mono text-sm font-medium">
                  {data.position.amount0.toSignificant(6)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">{symbol1}</span>
                <span className="text-text font-mono text-sm font-medium">
                  {data.position.amount1.toSignificant(6)}
                </span>
              </div>
              <div className="border-border-muted border-t pt-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">Liquidity</span>
                  <span className="text-text-secondary font-mono text-xs">
                    {data.position.liquidity.toString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Pool details */}
            <div className="bg-surface-raised space-y-1.5 rounded-xl p-3">
              <div className="text-text-muted text-xs font-medium">Pool Details</div>
              <DetailRow label="Pool ID" value={truncateAddress(data.poolId)} />
              <DetailRow label="Fee tier" value={`${data.pool.fee / 10000}%`} />
              <DetailRow label="Tick spacing" value={data.pool.tickSpacing.toString()} />
              <DetailRow label="Current tick" value={data.currentTick.toString()} />
              <DetailRow label="Tick lower" value={data.position.tickLower.toString()} />
              <DetailRow label="Tick upper" value={data.position.tickUpper.toString()} />
            </div>
          </div>

          {/* ── Uncollected Fees ── */}
          <div className="border-border-muted bg-surface space-y-3 rounded-2xl border p-4">
            <h3 className="text-text text-sm font-semibold">Uncollected Fees</h3>

            <div className="bg-surface-raised space-y-1.5 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">{symbol0}</span>
                <span className="text-text font-mono text-sm font-medium">
                  {formatTokenAmount(data.periphery.uncollectedFees.amount0, decimals0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">{symbol1}</span>
                <span className="text-text font-mono text-sm font-medium">
                  {formatTokenAmount(data.periphery.uncollectedFees.amount1, decimals1)}
                </span>
              </div>
            </div>

            {collectError && (
              <div className="bg-error-muted text-error rounded-lg p-2.5 text-xs">{collectError}</div>
            )}

            {collectFees.transaction.status !== "idle" && (
              <TxStatusBanner
                status={collectFees.transaction.status}
                txHash={collectFees.transaction.txHash}
                label="Fees collected!"
              />
            )}

            {isOwner ? (
              <button
                onClick={handleCollectFees}
                disabled={collectExecuting || !hasUncollectedFees || collectFees.transaction.status === "confirmed"}
                className={cn(
                  "w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]",
                  collectFees.transaction.status === "confirmed"
                    ? "bg-success/10 text-success"
                    : "glow-accent bg-accent hover:bg-accent-hover text-white",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
                )}
              >
                {collectExecuting
                  ? "Collecting..."
                  : collectFees.transaction.status === "confirmed"
                    ? "Fees collected"
                    : !hasUncollectedFees
                      ? "No fees to collect"
                      : "Collect Fees"}
              </button>
            ) : isConnected ? (
              <div className="text-text-muted border-border-muted rounded-xl border py-3 text-center text-xs">
                Only the position owner can collect fees
              </div>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    onClick={openConnectModal}
                    className="glow-accent bg-accent hover:bg-accent-hover w-full rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                  >
                    Connect Wallet
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>

          {/* ── Remove Liquidity ── */}
          <div className="border-border-muted bg-surface space-y-3 rounded-2xl border p-4">
            <h3 className="text-text text-sm font-semibold">Remove Liquidity</h3>

            <div className="flex gap-2">
              {REMOVE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setRemovePercentage(preset.value)}
                  disabled={!isOwner || removeExecuting || removeLiquidity.transaction.status === "confirmed"}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                    removePercentage === preset.value
                      ? "border-accent/30 bg-accent-muted text-accent"
                      : "border-border-muted bg-surface-raised text-text-secondary hover:border-border hover:bg-surface-hover",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {removeError && (
              <div className="bg-error-muted text-error rounded-lg p-2.5 text-xs">{removeError}</div>
            )}

            {removeLiquidity.transaction.status !== "idle" && (
              <TxStatusBanner
                status={removeLiquidity.transaction.status}
                txHash={removeLiquidity.transaction.txHash}
                label="Liquidity removed!"
              />
            )}

            {isOwner ? (
              <button
                onClick={handleRemoveLiquidity}
                disabled={
                  removeExecuting || removePercentage === null || removeLiquidity.transaction.status === "confirmed"
                }
                className={cn(
                  "w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]",
                  removeLiquidity.transaction.status === "confirmed"
                    ? "bg-success/10 text-success"
                    : "glow-accent bg-accent hover:bg-accent-hover text-white",
                  "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
                )}
              >
                {removeExecuting
                  ? "Removing..."
                  : removeLiquidity.transaction.status === "confirmed"
                    ? "Liquidity removed"
                    : removePercentage === null
                      ? "Select amount"
                      : `Remove ${removePercentage / 100}% liquidity`}
              </button>
            ) : isConnected ? (
              <div className="text-text-muted border-border-muted rounded-xl border py-3 text-center text-xs">
                Only the position owner can remove liquidity
              </div>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    onClick={openConnectModal}
                    className="glow-accent bg-accent hover:bg-accent-hover w-full rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-[0.98]"
                  >
                    Connect Wallet
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </>
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

function TxStatusBanner({
  status,
  txHash,
  label,
}: {
  status: TransactionStatus;
  txHash?: `0x${string}`;
  label: string;
}) {
  if (status === "idle") return null;

  const etherscanUrl = txHash ? `https://otterscan-devnet.metacrypt.org/tx/${txHash}` : undefined;

  const config: Record<TransactionStatus, { color: string; bg: string; text: string }> = {
    idle: { color: "", bg: "", text: "" },
    pending: { color: "text-warning", bg: "bg-warning-muted", text: "Waiting for wallet..." },
    confirming: { color: "text-accent", bg: "bg-accent-muted", text: "Confirming transaction..." },
    confirmed: { color: "text-success", bg: "bg-success-muted", text: label },
    error: { color: "text-error", bg: "bg-error-muted", text: "Transaction failed" },
  };

  const c = config[status];

  return (
    <div className={cn("flex items-center justify-between rounded-lg px-3 py-2", c.bg)}>
      <span className={cn("text-xs font-medium", c.color)}>{c.text}</span>
      {etherscanUrl && (
        <a
          href={etherscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-muted hover:text-text-secondary text-[10px] font-medium transition-colors"
        >
          View tx
        </a>
      )}
    </div>
  );
}
