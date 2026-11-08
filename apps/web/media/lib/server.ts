/**
 * The recorder's own `astro dev`: on APP_URL's port (Better Auth trusts only that
 * origin), with its own throwaway local state (MEDIA_STATE_DIR, read by
 * astro.config.mjs): a fresh, migrated one for the seed, then a copy of the seeded one
 * for each video, so every video starts from the same data. Your own `.wrangler/state`
 * is never read or written. A busy port stops the run: stop your own dev server first.
 */
import { execFileSync, spawn } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { createConnection } from "node:net";

function portBusy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "localhost" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** A fresh, migrated local state in `stateDir` (the old one is deleted). */
export function freshState(appDir: string, stateDir: string): void {
  rmSync(stateDir, { recursive: true, force: true });
  execFileSync(
    "bunx",
    [
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--persist-to",
      stateDir,
    ],
    { cwd: appDir, stdio: "ignore", env: { ...process.env, CI: "1" } }
  );
}

/** Copies a stopped server's state. */
export function copyState(from: string, to: string): void {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

export interface DevServer {
  readonly baseURL: string;
  stop(): Promise<void>;
}

export async function startDevServer(options: {
  readonly appDir: string;
  readonly stateDir: string;
  readonly port: number;
}): Promise<DevServer> {
  const { appDir, stateDir, port } = options;
  const baseURL = `http://localhost:${port}`;
  if (await portBusy(port)) {
    throw new Error(
      `Port ${port} (APP_URL in apps/web/.dev.vars) is in use. Stop your dev server, then run the recorder again.`
    );
  }
  const child = spawn(
    "bun",
    ["run", "dev", "--ignore-lock", "--port", String(port)],
    {
      cwd: appDir,
      env: {
        ...process.env,
        MEDIA_STATE_DIR: stateDir,
        E2E_LOCAL_TURNSTILE: "1",
      },
      stdio: ["ignore", "ignore", "pipe"],
      detached: true,
    }
  );
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-4000);
  });

  const deadline = Date.now() + 120_000;
  for (;;) {
    if (child.exitCode !== null)
      throw new Error(`astro dev exited:\n${stderr}`);
    try {
      const response = await fetch(`${baseURL}/health/live`);
      if (response.ok) break;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline)
      throw new Error(`astro dev did not start in 120 s:\n${stderr}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    baseURL,
    async stop() {
      if (child.pid && child.exitCode === null) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          child.kill("SIGTERM");
        }
      }
      for (let i = 0; i < 40 && (await portBusy(port)); i++) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
  };
}
