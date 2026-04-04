const fs = require("fs");

/**
 * Loads a wordlist from a file.
 * @param {string} filePath - The path to the wordlist file.
 * @returns {string[]} An array of words.
 */

function loadWordlist(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

function sampleWithoutReplacement(arr, n) {
  const copy = [...arr];
  const result = [];

  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }

  return result;
}

/**
 * Generates a single fake query.
 * @param {string[]} words - The list of words to sample from.
 * @param {number} minWords - The minimum number of words in the query.
 * @param {number} maxWords - The maximum number of words in the query.
 * @returns {string} A generated fake query.
 */
function generateOneFakeQuery(words, minWords = 1, maxWords = 3) {
  const queryLength =
    Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;

  const sampledWords = sampleWithoutReplacement(words, queryLength);
  return sampledWords.join(" ");
}

/**
 * Generates multiple fake queries.
 * @param {number} numQueries - The number of fake queries to generate.
 * @param {string} wordlistPath - The path to the wordlist file.
 * @param {number} minWords - The minimum number of words in each query.
 * @param {number} maxWords - The maximum number of words in each query.
 * @param {string} language - The language of the generated queries.
 * @returns {Object[]} An array of generated fake queries.
 */

function generateFakeQueries(
  numQueries,
  wordlistPath,
  minWords = 1,
  maxWords = 3,
  language = "english",
  ratioLabel = "1:3",
  groupId = ""
) {
  const words = loadWordlist(wordlistPath);
  const fakeQueries = [];

  for (let i = 0; i < numQueries; i++) {
    const generatedQuery = generateOneFakeQuery(words, minWords, maxWords);

    fakeQueries.push({
      Query: generatedQuery,
      label: "fake",
      language,
      ratio_setting: ratioLabel,
      group_id: groupId,
      word_count: generatedQuery.split(/\s+/).length
    });
  }

  return fakeQueries;
}

module.exports = {
  loadWordlist,
  generateOneFakeQuery,
  generateFakeQueries
};