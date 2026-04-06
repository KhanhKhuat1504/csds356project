const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
// # of top words to compare between original and obfuscated datasets
const TOP_N_MEASURE = 50; 
// # of top words to print 
const TOP_N_PRINT = 15;

// list of common English stopwords to exclude from the analysis if wanted
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by",
  "for", "from", "has", "have", "he", "her", "his", "i",
  "in", "is", "it", "its", "me", "my", "of", "on", "or",
  "our", "she", "that", "the", "their", "them", "they",
  "this", "to", "was", "we", "were", "will", "with", "you",
  "your", "yours", "us", "do", "does", "did", "not", "so",
  "if", "then", "than", "too", "very", "can", "could",
  "should", "would", "about", "into", "over", "under",
  "again", "once", "there", "here", "when", "where", "why",
  "how", "all", "any", "both", "each", "few", "more",
  "most", "other", "some", "such", "no", "nor", "only",
  "own", "same", "just"
]);

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", row => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", err => reject(err));
  });
}

function normalizeQuery(text) {
  return (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Cleans and tokenizes a query string, optionally removing stopwords. 
// For this analysis, we keep all words to better
function tokenize(text) {
  const cleaned = normalizeQuery(text).replace(/[^a-z0-9\s]/g, " ");

  return cleaned
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
     // .filter(token => !STOPWORDS.has(token));
     // If stopword removal is desired, uncomment the above line. For now, we keep all words to better analyze the impact of RQI on common terms.
}

function getWordFrequency(rows) {
  const freq = {};

  for (const row of rows) {
    const query = row.Query || "";
    const tokens = tokenize(query);

    for (const token of tokens) {
      freq[token] = (freq[token] || 0) + 1;
    }
  }

  return freq;
}

function sortFrequencyMap(freqMap) {
  return Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
}

function getTopWords(freqMap, topN = 100) {
  return sortFrequencyMap(freqMap).slice(0, topN);
}

function jaccardSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

function averageWordCount(rows) {
  if (rows.length === 0) return 0;

  let totalWords = 0;
  for (const row of rows) {
    totalWords += tokenize(row.Query || "").length;
  }

  return totalWords / rows.length;
}

function duplicateRate(rows) {
  if (rows.length === 0) return 0;

  const seen = new Set();
  let duplicateCount = 0;

  for (const row of rows) {
    const query = normalizeQuery(row.Query || "");
    if (!query) continue;

    if (seen.has(query)) {
      duplicateCount += 1;
    } else {
      seen.add(query);
    }
  }

  return duplicateCount / rows.length;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function printDatasetSummary(name, rows) {
  const realRows = rows.filter(row => row.label === "real");
  const fakeRows = rows.filter(row => row.label === "fake");

  const uniqueQueries = new Set(
    rows.map(row => normalizeQuery(row.Query || "")).filter(Boolean)
  ).size;

  console.log(`\n=== ${name} ===`);
  console.log(`Total rows: ${rows.length}`);
  console.log(`Real rows: ${realRows.length}`);
  console.log(`Fake rows: ${fakeRows.length}`);
  console.log(`Fake proportion: ${formatPercent(fakeRows.length / rows.length)}`);
  console.log(`Unique queries: ${uniqueQueries}`);
  console.log(`Average content words/query: ${averageWordCount(rows).toFixed(2)}`);
  console.log(`Duplicate rate: ${formatPercent(duplicateRate(rows))}`);
}

function printTopWords(title, freqMap, topN = 15) {
  const topWords = getTopWords(freqMap, topN);

  console.log(`\n${title}`);
  for (const [word, count] of topWords) {
    console.log(`${word}: ${count}`);
  }
}

function compareAgainstOriginal(originalRows, obfuscatedRows, datasetName, topN = 100) {
  const originalFreq = getWordFrequency(originalRows);
  const obfuscatedFreq = getWordFrequency(obfuscatedRows);

  const originalTop = getTopWords(originalFreq, topN).map(([word]) => word);
  const obfuscatedTop = getTopWords(obfuscatedFreq, topN).map(([word]) => word);

  const originalSet = new Set(originalTop);
  const obfuscatedSet = new Set(obfuscatedTop);

  const jaccard = jaccardSimilarity(originalSet, obfuscatedSet);

  const retainedWords = originalTop.filter(word => obfuscatedSet.has(word));
  const droppedWords = originalTop.filter(word => !obfuscatedSet.has(word));

  console.log(`\n=== Keyword Comparison: Original vs ${datasetName} ===`);
  console.log(`Top-${topN} Jaccard similarity: ${jaccard.toFixed(4)}`);
  console.log(`Retained original top words: ${retainedWords.length}/${topN}`);
  console.log(`Dropped original top words: ${droppedWords.length}/${topN}`);

  console.log(`Retained words: ${retainedWords.length ? retainedWords.join(", ") : "(none)"}`);
  console.log(`Dropped words: ${droppedWords.length ? droppedWords.join(", ") : "(none)"}`);
}

function extractRatioValue(filename) {
  const match = filename.match(/aol_rqi_ratio_(\d+)_(\d+)_/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const realPart = parseInt(match[1], 10);
  const fakePart = parseInt(match[2], 10);

  if (realPart === 0) return Number.MAX_SAFE_INTEGER;
  return fakePart / realPart;
}

function extractDisplayName(filename) {
  return filename.replace(".csv", "");
}

function getRqiFiles(outputsDir) {
  return fs.readdirSync(outputsDir)
    .filter(file => file.endsWith(".csv"))
    .filter(file => file.startsWith("AOL_RQI_Ratio_"))
    .sort((a, b) => extractRatioValue(a) - extractRatioValue(b));
}

async function main() {
  const baseDir = __dirname;
  const outputsDir = path.join(__dirname, "outputs");
  const originalPath = path.join(baseDir, "..", "aol_queries_only.csv");

  const originalRows = await readCsv(originalPath);
  const originalFreq = getWordFrequency(originalRows);

  printDatasetSummary("Original AOL Queries", originalRows);
  printTopWords(
    `Top ${TOP_N_PRINT} words in Original AOL Queries (stopwords removed)`,
    originalFreq,
    TOP_N_PRINT
  );

  const rqiFiles = getRqiFiles(outputsDir);

  if (rqiFiles.length === 0) {
    console.log("No RQI output CSV files found in the outputs directory.");
    return;
  }

  for (const file of rqiFiles) {
    const filePath = path.join(outputsDir, file);
    const rows = await readCsv(filePath);
    const name = extractDisplayName(file);

    printDatasetSummary(name, rows);
    const freqMap = getWordFrequency(rows);
    printTopWords(
      `Top ${TOP_N_PRINT} words in ${name} (stopwords removed)`,
      freqMap,
      TOP_N_PRINT
    );
    compareAgainstOriginal(originalRows, rows, name, TOP_N_MEASURE);
  }
}

main().catch(err => {
  console.error("Error while comparing ratio outputs:", err);
});