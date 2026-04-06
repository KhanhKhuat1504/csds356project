const path = require("path");
const { ensureDirectory, readRealQueries, writeQueriesToCsv } = require("./utils");
const { mixRealAndFakeQueries } = require("./mixQueries");

/**
 * Main function to run the Random Query Injection process.
 * 
 * This function:
1. Loads real queries from the AOL dataset
2. Generates fake queries based on a word list
3. Mixes real and fake queries according to a specified ratio
4. Saves the resulting dataset to a CSV file
 */

/**
 * In Random_Query_Injection, 
 * type 'node runRqi.js [fakeRatio] [minWords] [maxWords] [languages]'
 * Example: 'node runRqi.js 3 1 3 english,spanish,french'
 * - fakeRatio: # of fake queries to generate per real query (default: 3)
 * - minWords: Minimum # of words in each fake query (default: 1)
 * - maxWords: Maximum # of words in each fake query (default: 3)
 * - languages: Comma-separated list of languages for the fake queries (default: "english")
 * 
 * The output CSV will be saved in the "outputs" directory with a name that reflects the settings used. 
 */

async function main() {
  const inputCsv = path.join(__dirname, "..", "aol_sample.csv");
  const outputDir = path.join(__dirname, "../Random_Query_Injection/outputs");
  const fakeRatio = parseInt(process.argv[2], 10) || 3;
  const minWords = parseInt(process.argv[3], 10) || 1;
  const maxWords = parseInt(process.argv[4], 10) || 3;

  // Comma-separated languages, e.g. "english" or "english,spanish,french"
  const languagesArg = process.argv[5] || "english";
  const languages = languagesArg.split(",").map(x => x.trim()).filter(Boolean);

  const ratioLabel = `1:${fakeRatio}`;
  const languageLabel = languages.join("_");
  const outputCsv = path.join(
    outputDir,
    `AOL_RQI_Ratio_1:${fakeRatio}_${languageLabel} used ${minWords} to ${maxWords} words.csv`
  );

  ensureDirectory(outputDir);

  const realQueries = await readRealQueries(inputCsv);

  const mixedQueries = mixRealAndFakeQueries(
    realQueries,
    fakeRatio,
    languages,
    minWords,
    maxWords,
    ratioLabel
  );

  writeQueriesToCsv(outputCsv, mixedQueries);

  console.log(`Done. Output saved to: ${outputCsv}`);
  console.log(`Real queries: ${realQueries.length}`);
  console.log(`Total queries after injection: ${mixedQueries.length}`);
  console.log(`Languages used: ${languages.join(", ")}`);
  console.log(`Words per fake query: ${minWords}-${maxWords}`);
}

main().catch(err => {
  console.error("Error while running RQI:", err);
});