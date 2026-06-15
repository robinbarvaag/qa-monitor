/**
 * Kø for å trigge kjøringer asynkront. I testfasen kan web-appen kalle
 * workeren direkte; senere kan dette pekes mot Azure Storage Queue,
 * Service Bus, Vercel Cron e.l. uten at kallstedet endres.
 */
export interface RunQueue {
  enqueue(runId: string): Promise<void>;
}

/** Enkel no-op / direkte-kjør-variant for lokal testing. */
export class InlineRunQueue implements RunQueue {
  constructor(private readonly handler: (runId: string) => Promise<void>) {}
  async enqueue(runId: string): Promise<void> {
    await this.handler(runId);
  }
}
