"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWalletButton() {
  return (
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
  );
}
