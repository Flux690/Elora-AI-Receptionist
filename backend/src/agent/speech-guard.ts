import type { llm } from "@livekit/agents";

/**
 * A turn either calls a tool or it talks. Never both.
 *
 * ## Why this exists
 *
 * A caller once heard the agent say, out loud:
 *
 *   "_1} Wait, the user did not offer their name yet, so I will book it directly
 *    (I can't call rememberCallerName without a name, but bookAppointment only
 *    requires slotId). I should confirm the booking. Let's call bookAppointment."
 *
 * `_1}` is the tail of `{"slotId": "slot_1"}` — tool-call JSON — followed by the
 * model's private deliberation. It arrived in the same turn as the
 * `bookAppointment` call.
 *
 * ## Why this is a structural rule and not a filter
 *
 * The obvious fix is to pattern-match the garbage. It does not work. `_1}` is
 * catchable, but "Wait, the user did not offer their name yet" is ordinary
 * English with no JSON, no tool name and no tell. Any regex strong enough to
 * catch it will eventually swallow a real sentence a caller needed to hear, and
 * a filter that is *usually* right is not a guarantee.
 *
 * So the rule is about the SHAPE of the turn rather than the content of the
 * words: if the model decided to call a tool, nothing it wrote in that same turn
 * reaches the speaker. Deterministic, no judgement, no vocabulary to maintain.
 *
 * It costs nothing the product wanted. The agent is supposed to speak *after* a
 * tool returns, with the answer — never alongside deciding to call one. The
 * "one moment while I check" gap is covered by `RunContext.filler`, which is
 * built for exactly that and yields to real speech instead of racing it.
 *
 * ## The tradeoff, stated plainly
 *
 * The turn is buffered to end-of-stream before anything is emitted, because a
 * tool call can arrive after the text that must be suppressed. So text-to-speech
 * starts once the model has finished writing rather than mid-sentence.
 *
 * That cost is small here and measurable: preemptive generation still runs the
 * LLM ahead of turn confirmation, and `[metrics]` reports `tts_ttfb` per call.
 * A guarantee that is cheap to verify beats a filter nobody can prove.
 */

/** True when this chunk carries words the caller would hear. */
function carriesSpeech(chunk: llm.ChatChunk | string): boolean {
  if (typeof chunk === "string") return chunk.length > 0;
  return Boolean(chunk.delta?.content);
}

function carriesToolCall(chunk: llm.ChatChunk | string): boolean {
  if (typeof chunk === "string") return false;
  return (chunk.delta?.toolCalls?.length ?? 0) > 0;
}

/**
 * Strips spoken text from a chunk while keeping everything else — the tool call
 * itself, usage, and any provider metadata such as Gemini's thought signature,
 * all of which the session still needs.
 */
function withoutSpeech(chunk: llm.ChatChunk): llm.ChatChunk {
  if (!chunk.delta) return chunk;
  const { content: _dropped, ...delta } = chunk.delta;
  return { ...chunk, delta: { ...delta } as llm.ChoiceDelta };
}

/**
 * What a chunk looks like when we inspect it. The stream itself stays generic so
 * the caller's exact element type — which includes a `unique symbol` for flush —
 * passes through unchanged; `ReadableStream`'s generic is invariant in
 * TypeScript, so restating it here would not unify with the SDK's signature.
 */
type Inspectable = llm.ChatChunk | string | symbol;

/**
 * Buffers one turn, then emits it — minus any spoken text, if the turn turned
 * out to be a tool call.
 *
 * Flush sentinels pass straight through: they are stream control, not content.
 */
export function suppressSpeechOnToolTurns(
  source: ReadableStream<unknown>
): ReadableStream<unknown> {
  return new ReadableStream<unknown>({
    async start(controller) {
      const reader = source.getReader();
      const buffered: unknown[] = [];
      let sawToolCall = false;

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = value as Inspectable;
          if (typeof chunk !== "symbol" && carriesToolCall(chunk)) sawToolCall = true;
          buffered.push(value);
        }

        for (const value of buffered) {
          const chunk = value as Inspectable;
          if (!sawToolCall || typeof chunk === "symbol") {
            controller.enqueue(value);
            continue;
          }
          // A tool turn: drop plain-string speech outright, and strip the text
          // off structured chunks while keeping the tool call they carry.
          if (typeof chunk === "string") continue;
          if (!carriesSpeech(chunk)) {
            controller.enqueue(value);
            continue;
          }
          const stripped = withoutSpeech(chunk);
          if (carriesToolCall(stripped) || stripped.usage) {
            controller.enqueue(stripped);
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      return source.cancel(reason);
    },
  });
}
