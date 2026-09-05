import type { metrics as agentMetrics } from "@livekit/agents";

/**
 * Per-turn latency accounting (PLAN.md 1.9).
 *
 * There was no MetricsCollected handler anywhere in the codebase, so every
 * latency change was guesswork. These three numbers are what actually add up to
 * the pause a caller hears after they stop speaking:
 *
 *   EOU  — how long after the caller stopped talking the turn was closed
 *   LLM  — time to first token
 *   TTS  — time to first byte
 *
 * LiveKit's own docs warn that preemptive generation does not always reduce
 * latency and that the metrics are how you find out. This is that.
 */
export type TurnLatency = {
  eouDelayMs?: number;
  transcriptionDelayMs?: number;
  llmTtftMs?: number;
  ttsTtfbMs?: number;
};

/** A single latency figure, aggregated. */
export type Percentiles = { count: number; p50: number; p95: number };

export type LatencyReport = {
  eouDelayMs: Percentiles;
  llmTtftMs: Percentiles;
  ttsTtfbMs: Percentiles;
  /** Best-case perceived pause: EOU + first token + first byte, at p50/p95. */
  responseMs: Percentiles;
};

/**
 * Nearest-rank percentile. Deliberately not interpolated — at the call volumes
 * involved, an interpolated p95 over nine samples implies a precision that is
 * not there.
 */
function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1]!;
}

function summarise(values: number[]): Percentiles {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  };
}

/**
 * Accumulates metrics events for one call and reports percentiles at the end.
 *
 * Per call rather than per process: a worker handles many concurrent calls for
 * many agents, and mixing them produces a number that describes nobody.
 */
export class CallMetrics {
  private readonly eou: number[] = [];
  private readonly transcription: number[] = [];
  private readonly llmTtft: number[] = [];
  private readonly ttsTtfb: number[] = [];

  /**
   * Feed one `MetricsCollected` event.
   *
   * Cancelled LLM requests are skipped: a barge-in cancels generation, and its
   * truncated time-to-first-token is not a latency the caller experienced.
   */
  record(metric: agentMetrics.AgentMetrics): void {
    switch (metric.type) {
      case "eou_metrics":
        if (metric.endOfUtteranceDelayMs > 0) this.eou.push(metric.endOfUtteranceDelayMs);
        if (metric.transcriptionDelayMs > 0) {
          this.transcription.push(metric.transcriptionDelayMs);
        }
        break;
      case "llm_metrics":
        if (!metric.cancelled && metric.ttftMs > 0) this.llmTtft.push(metric.ttftMs);
        break;
      case "tts_metrics":
        if (metric.ttfbMs > 0) this.ttsTtfb.push(metric.ttfbMs);
        break;
      default:
        break;
    }
  }

  get turnCount(): number {
    return Math.max(this.eou.length, this.llmTtft.length, this.ttsTtfb.length);
  }

  report(): LatencyReport {
    // Summed per index rather than p50+p50+p50: adding percentiles from
    // independent distributions overstates the typical case.
    const turns = Math.min(this.eou.length, this.llmTtft.length, this.ttsTtfb.length);
    const response = Array.from(
      { length: turns },
      (_, i) => this.eou[i]! + this.llmTtft[i]! + this.ttsTtfb[i]!
    );

    return {
      eouDelayMs: summarise(this.eou),
      llmTtftMs: summarise(this.llmTtft),
      ttsTtfbMs: summarise(this.ttsTtfb),
      responseMs: summarise(response),
    };
  }

  /** One structured line per call, greppable and cheap to ship to a log sink. */
  logSummary(callId: string, agentId: string): void {
    if (this.turnCount === 0) return;
    const r = this.report();
    console.log(
      `[metrics] call=${callId} agent=${agentId} turns=${this.turnCount} ` +
        `eou_p50=${r.eouDelayMs.p50} eou_p95=${r.eouDelayMs.p95} ` +
        `llm_ttft_p50=${r.llmTtftMs.p50} llm_ttft_p95=${r.llmTtftMs.p95} ` +
        `tts_ttfb_p50=${r.ttsTtfbMs.p50} tts_ttfb_p95=${r.ttsTtfbMs.p95} ` +
        `response_p50=${r.responseMs.p50} response_p95=${r.responseMs.p95}`
    );
  }
}
