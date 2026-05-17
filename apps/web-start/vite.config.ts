import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  ssr: {
    noExternal: ["@zahastudio/uniswap-sdk", "@zahastudio/uniswap-sdk-react", /^@uniswap\//],
  },
});

export default config;
