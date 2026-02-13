import type { Metadata } from "next";

import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Uniswap SDK — Example",
  description: "",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className="dark"
    >
      <body className="bg-background min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
