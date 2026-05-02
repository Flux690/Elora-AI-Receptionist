import natural from "natural";
import compromise from "compromise";

const sentimentAnalyzer = new natural.SentimentAnalyzer(
  "English",
  natural.PorterStemmer,
  "afinn"
);

export function isEndingConversation(text) {
  const norm = text.toLowerCase().trim();
  const doc = compromise(text);
  const words = norm.split(/\s+/);

  const closurePhrases = [
    "that's it",
    "thats it",
    "that is it",
    "that's all",
    "thats all",
    "that is all",
    "that's everything",
    "thats everything",
    "nothing else",
    "no more",
    "all done",
    "all set",
    "i'm done",
    "im done",
    "finished",
    "done",
    "that'll be all",
    "that will be all",
    "no thanks",
    "no thank you",
  ];

  if (closurePhrases.some((phrase) => norm.includes(phrase))) return true;

  const hasFarewell =
    doc.has("#Goodbye") || doc.has("#Farewell") || doc.has("bye");
  const hasThanks = doc.has("#Thanks") || doc.has("thank");
  const hasNegative = doc.has("#Negative") || doc.has("no");
  const hasComplete = doc.has("done") || doc.has("finished");
  const isShort = words.length <= 7;
  const sentiment = sentimentAnalyzer.getSentiment(words);
  const isStatement = !norm.includes("?");

  return (
    (hasFarewell && isShort) ||
    (hasThanks && isShort && isStatement) ||
    (hasNegative && isShort && isStatement) ||
    (hasComplete && isShort && isStatement) ||
    (hasThanks && sentiment >= -1 && isStatement) ||
    (hasNegative && hasThanks && isShort) ||
    (hasNegative && hasComplete && isShort) ||
    ((hasThanks || hasFarewell) && isShort && isStatement) ||
    (sentiment > 1 && isShort && isStatement)
  );
}
