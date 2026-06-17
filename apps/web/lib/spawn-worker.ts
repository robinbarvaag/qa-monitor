import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import path from "node:path";

/**
 * Trigger en køet run.
 * - Hvis `WORKER_URL` er satt (produksjon, f.eks. Railway): POST til den hostede
 *   Python-workeren. Den kvitterer 202 og kjører jobben i bakgrunnen.
 * - Ellers (lokal utvikling): spawn lokal venv-python direkte.
 *
 * Kaster hvis HTTP-triggeren ikke når fram, slik at kallstedet kan markere
 * kjøringen som feilet. Lokal spawn er fire-and-forget som før.
 */
export async function triggerRun(runId: string): Promise<void> {
  const baseUrl = process.env.WORKER_URL;
  if (baseUrl) {
    const secret = process.env.WORKER_SECRET;
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ runId }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Worker svarte ${res.status} ${res.statusText}: ${body}`.trim());
    }
    return;
  }
  spawnWorker(runId);
}

/**
 * Starter Python-workeren lokalt for en køet run (InlineRunQueue, lokalt).
 *
 * Kjører venv-python direkte (apps/worker-web/.venv) i stedet for `uv run`:
 * - ingen cmd-/konsoll-vindu (shell: false + windowsHide)
 * - ingen `uv`-venv-reresolving per start → rask, deterministisk oppstart
 * - stdout/stderr logges til worker.log for diagnose
 * Faller tilbake til `uv run` hvis venv mangler (f.eks. fersk checkout).
 * Detached + unref slik at den lever videre etter at server-handlingen returnerer.
 */
function spawnWorker(runId: string): void {
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
