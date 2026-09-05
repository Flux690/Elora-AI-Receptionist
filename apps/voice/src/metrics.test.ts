import { describe, it, expect, vi } from "vitest";
import type { metrics as agentMetrics } from "@livekit/agents";
import { CallMetrics } from "./metrics.js";

const eou = (delay: number, transcription = 10) =>
  ({
    type: "eou_metrics",
    timestamp: 0,
    endOfUtteranceDelayMs: delay,
    transcriptionDelayMs: transcription,
    onUserTurnCompletedDelayMs: 0,
    lastSpeakingTimeMs: 0,
  }) as agentMetrics.AgentMetrics;

const llm = (ttft: number, cancelled = false) =>
  ({
    type: "llm_metrics",
    label: "llm",
    requestId: "r",
    timestamp: 0,
    durationMs: ttft * 2,
    ttftMs: ttft,
    cancelled,
    completionTokens: 1,
    promptTokens: 1,
    promptCachedTokens: 0,
  }) as agentMetrics.AgentMetrics;

const tts = (ttfb: number) =>
  ({
    type: "tts_metrics",
    label: "tts",
    requestId: "r",
    timestamp: 0,
    ttfbMs: ttfb,
    durationMs: 100,
    audioDurationMs: 500,
  }) as agentMetrics.AgentMetrics;

describe("CallMetrics", () => {
  it("reports nothing for a call with no turns", () => {
    const m = new CallMetrics();
    expect(m.turnCount).toBe(0);
    expect(m.report().responseMs).toEqual({ count: 0, p50: 0, p95: 0 });
  });

  it("tracks the three figures that make up the perceived pause", () => {
    const m = new CallMetrics();
    m.record(eou(300));
    m.record(llm(400));
    m.record(tts(200));

    const r = m.report();
    expect(r.eouDelayMs.p50).toBe(300);
    expect(r.llmTtftMs.p50).toBe(400);
    expect(r.ttsTtfbMs.p50).toBe(200);
    // The number the caller actually experiences.
    expect(r.responseMs.p50).toBe(900);
  });

  it("ignores cancelled LLM requests — a barge-in is not a latency the caller felt", () => {
    const m = new CallMetrics();
    m.record(llm(400));
    m.record(llm(5, true));

    expect(m.report().llmTtftMs).toEqual({ count: 1, p50: 400, p95: 400 });
  });

  it("ignores zeroed metrics, which mean 'not detected' rather than 'instant'", () => {
    const m = new CallMetrics();
    m.record(eou(0));
    m.record(tts(0));

    expect(m.report().eouDelayMs.count).toBe(0);
    expect(m.report().ttsTtfbMs.count).toBe(0);
  });

  it("computes p50 and p95 by nearest rank", () => {
    const m = new CallMetrics();
    for (const v of [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]) m.record(llm(v));

    const r = m.report().llmTtftMs;
    expect(r.count).toBe(10);
    expect(r.p50).toBe(500);
    expect(r.p95).toBe(1000);
  });

  it("sums response time per turn, not percentile-plus-percentile", () => {
    const m = new CallMetrics();
    // One fast turn and one slow one. Adding the three p50s would give 600;
    // the real p50 of the summed turns is 300.
    m.record(eou(100));
    m.record(llm(100));
    m.record(tts(100));
    m.record(eou(1000));
    m.record(llm(1000));
    m.record(tts(1000));

    const r = m.report().responseMs;
    expect(r.count).toBe(2);
    expect(r.p50).toBe(300);
    expect(r.p95).toBe(3000);
  });

  it("logs one structured line per call", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const m = new CallMetrics();
    m.record(eou(300));
    m.record(llm(400));
    m.record(tts(200));

    m.logSummary("call-1", "agent-1");

    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0]![0] as string;
    expect(line).toContain("call=call-1");
    expect(line).toContain("agent=agent-1");
    expect(line).toContain("response_p50=900");
    spy.mockRestore();
  });

  it("stays silent for a call that produced no turns", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    new CallMetrics().logSummary("call-2", "agent-1");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
