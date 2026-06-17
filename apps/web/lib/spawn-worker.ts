import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import path from "node:path";

/**
 * Starter Python-workeren for en køet run (InlineRunQueue, lokalt).
 *
 * Kjører venv-python direkte (apps/worker-web/.venv) i stedet for `uv run`:
 * - ingen cmd-/konsoll-vindu (shell: false + windowsHide)
 * - ingen `uv`-venv-reresolving per start → rask, deterministisk oppstart
 * - stdout/stderr logges til worker.log for diagnose
 * Faller tilbake til `uv run` hvis venv mangler (f.eks. fersk checkout).
 * Detached + unref slik at den lever videre etter at server-handlingen returnerer.
 */
export function spawnWorker(runId: string): void {
  const workerDir = path.resolve(process.cwd(), "..", "worker-web");
  const isWin = process.platform === "win32";
  const venvPython = path.join(workerDir, ".venv", isWin ? "Scripts/python.exe" : "bin/python");
  const useVenv = existsSync(venvPython);

  const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
  const localBin = path.join(home, ".local", "bin");
  const env = {
    ...process.env,
    PATH: `${localBin}${path.delimiter}${process.env.PATH ?? ""}`,
    PYTHONUTF8: "1",
  };

  let out: number | "ignore" = "ignore";
  try {
    out = openSync(path.join(workerDir, "worker.log"), "a");
  } catch {
    out = "ignore";
  }

  const cmd = useVenv ? venvPython : "uv";
  const args = useVenv
    ? ["-m", "worker_web", "--run-id", runId]
    : ["run", "python", "-m", "worker_web", "--run-id", runId];

  const child = spawn(cmd, args, {
    cwd: workerDir,
    env,
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
    shell: !useVenv,
  });
  child.on("error", () => {
    /* svelges – feilen havner uansett i worker.log / run-status */
  });
  child.unref();
}
