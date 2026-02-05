import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

type AnvilInstance = {
  url: string;
  process: ReturnType<typeof spawn>;
};

const waitForAnvilReady = async (child: ReturnType<typeof spawn>) => {
  const started = new Promise<void>((resolve, reject) => {
    const startupTimeoutMs = Number(process.env.ANVIL_STARTUP_TIMEOUT_MS ?? "60000");
    const timeout = setTimeout(() => {
      reject(new Error(`Anvil did not start within ${startupTimeoutMs}ms`));
    }, startupTimeoutMs);

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("Listening on")) {
        clearTimeout(timeout);
        resolve();
      }
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  await started;
};

export const startAnvil = async (): Promise<AnvilInstance> => {
  const rpcUrl = process.env.MAINNET_RPC_URL ?? "https://unichain.drpc.org";

  const port = process.env.ANVIL_PORT ?? String(10_000 + Math.floor(Math.random() * 10_000));
  const chainId = process.env.FORK_CHAIN_ID ?? "130";

  const args = ["--fork-url", rpcUrl, "--port", port, "--chain-id", chainId];

  const child = spawn("anvil", args, { stdio: ["ignore", "pipe", "pipe"] });

  await waitForAnvilReady(child);
  await delay(250);

  return {
    url: `http://127.0.0.1:${port}`,
    process: child,
  };
};

export const stopAnvil = async (instance: AnvilInstance) => {
  instance.process.kill("SIGTERM");
  await new Promise((resolve) => instance.process.once("exit", resolve));
};
