import db from "../database.js";
import natural from "natural";
import stringSimilarity from "string-similarity";

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

const stopWords = new Set([
  "what", "is", "the", "how", "much", "does", "do", "can", "i", "a", "an",
  "in", "on", "at", "for", "by", "to", "from", "with", "about", "against",
  "between", "into", "through", "during", "before", "after", "above", "below",
  "of", "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "any", "both", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don",
  "should", "now",
]);

function preprocessText(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text) {
  const processed = preprocessText(text);
  const tokens = tokenizer.tokenize(processed);
  if (!Array.isArray(tokens)) return [];
  return tokens
    .filter((token) => !stopWords.has(token) && token.length > 2)
    .map((token) => stemmer.stem(token));
}

class Retriever {
  constructor() {
    this.kbProcessed = [];
    this.tfidf = new TfIdf();
    this.threshold = 0.35;
    this.initialized = false;
  }

  async initialize() {
    try {
      const knowledgeBase = await db.getKnowledgeBase();
      
      if (!Array.isArray(knowledgeBase)) {
        console.error("[RAG] Knowledge base is not an array");
        this.kbProcessed = [];
        this.initialized = false;
        return;
      }
      
      if (knowledgeBase.length === 0) {
        console.warn("[RAG] Knowledge base is empty");
        this.kbProcessed = [];
        this.initialized = true;
        return;
      }
      
      this.kbProcessed = knowledgeBase.map((item, idx) => {
        if (!item.question || !item.answer) return null;
        
        const processedQuestion = preprocessText(item.question);
        const keywords = extractKeywords(item.question);
        this.tfidf.addDocument(processedQuestion, idx);
        
        return {
          originalQuestion: item.question,
          processedQuestion,
          keywords,
          answer: item.answer,
          docIndex: idx,
        };
      }).filter(item => item !== null);

      const avgLen =
        knowledgeBase.reduce((sum, q) => sum + (q.question?.length ?? 0), 0) /
        knowledgeBase.length;
      
      if (knowledgeBase.length < 10 || avgLen > 50) {
        this.threshold -= 0.05;
      }
      if (avgLen > 80) {
        this.threshold -= 0.03;
      }

      this.initialized = true;
      console.log(`[RAG] Retriever ready - ${this.kbProcessed.length} items, threshold: ${this.threshold.toFixed(3)}`);
    } catch (error) {
      console.error("[RAG] Initialization error:", error);
      this.kbProcessed = [];
      this.initialized = false;
      throw error;
    }
  }

  findBestMatch(question) {
    if (!this.initialized) {
      console.error("[RAG] Not initialized!");
      return { found: false, answer: null, error: "not_initialized" };
    }

    if (!this.kbProcessed.length) {
      return { found: false, answer: null, confidence: 0 };
    }

    try {
      const userProcessed = preprocessText(question);
      const userKeywords = extractKeywords(question);
      
      // Build TF-IDF vector for user query
      const userVector = {};
      const userTerms = tokenizer.tokenize(userProcessed);
      const userTermFreqs = {};
      
      userTerms.forEach((token) => {
        userTermFreqs[token] = (userTermFreqs[token] || 0) + 1;
      });
      
      Object.keys(userTermFreqs).forEach((term) => {
        const tf = userTermFreqs[term] / userTerms.length;
        const idf = this.tfidf.idf(term);
        userVector[term] = tf * idf;
      });

      let bestMatch = null;
      let highestScore = 0;

      this.kbProcessed.forEach((item) => {
        // TF-IDF cosine similarity
        const kbVector = {};
        this.tfidf.listTerms(item.docIndex).forEach((term) => {
          kbVector[term.term] = term.tfidf;
        });

        const allTerms = new Set([
          ...Object.keys(userVector),
          ...Object.keys(kbVector),
        ]);
        
        let dot = 0, magUser = 0, magKB = 0;
        allTerms.forEach((term) => {
          const u = userVector[term] || 0;
          const k = kbVector[term] || 0;
          dot += u * k;
          magUser += u * u;
          magKB += k * k;
        });
        
        const tfidfScore =
          magUser > 0 && magKB > 0
            ? dot / (Math.sqrt(magUser) * Math.sqrt(magKB))
            : 0;

        // String similarity
        const stringSim = stringSimilarity.compareTwoStrings(
          userProcessed,
          item.processedQuestion
        );

        // Keyword matching
        const commonKeywords = userKeywords.filter((kw) =>
          item.keywords.includes(kw)
        ).length;
        const keywordScore =
          commonKeywords / Math.max(userKeywords.length, item.keywords.length, 1);

        // Combined score
        const combinedScore =
          tfidfScore * 0.4 + stringSim * 0.35 + keywordScore * 0.25;

        if (combinedScore > highestScore) {
          highestScore = combinedScore;
          bestMatch = item;
        }
      });

      if (bestMatch && highestScore > this.threshold) {
        console.log(`[RAG] ✓ Match: "${bestMatch.originalQuestion}" (${highestScore.toFixed(3)})`);
        return {
          found: true,
          answer: bestMatch.answer,
          confidence: highestScore,
          matchedQuestion: bestMatch.originalQuestion,
        };
      }

      console.log(`[RAG] ✗ No match (best: ${highestScore.toFixed(3)}, need: ${this.threshold.toFixed(3)})`);
      return {
        found: false,
        answer: null,
        confidence: highestScore,
      };
    } catch (error) {
      console.error("[RAG] Search error:", error);
      return {
        found: false,
        answer: null,
        error: error.message,
      };
    }
  }
}

export async function initializeRetriever() {
  const retriever = new Retriever();
  await retriever.initialize();
  return retriever;
}