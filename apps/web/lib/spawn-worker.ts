import { spawn } from "node:child_process";
import path from "node:path";

/**
 * Starter Python-workeren for en køet run (InlineRunQueue, lokalt).
 * Detached + unref slik at den lever videre etter at server-handlingen returnerer.
 * uv finnes typisk i ~/.local/bin – legges fremst i PATH for spawn-en.
 */
export function spawnWorker(runId: string): void {
  const workerDir = path.resolve(process.cwd(), "..", "worker-web");
  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const localBin = path.join(home, ".local", "bin");
  const env = {
    ...process.env,
    PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ""}`,
  };

  const child = spawn("uv", ["run", "python", "-m", "worker_web", "--run-id", runId], {
    cwd: workerDir,
    env,
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  child.unref();
}
