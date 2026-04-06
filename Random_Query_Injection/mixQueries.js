const path = require("path");
const { generateFakeQueries } = require("./generateFakeQueries");
const { shuffleQueries } = require("./utils");

function mixRealAndFakeQueries(
 /**
  * Mixes real queries with generated fake queries based on a specified ratio.
  * @param {Object[]} realQueries - An array of real query objects.
  * @param {number} fakeRatio - The number of fake queries to generate per real query. 
  * Ex) 1:3 means 1 real query + 3 fake queries = 4 total queries.
  * @param {string[]} languages - An array of languages for the fake queries. 
  * Can be just one language or multiple languages.
  * @param {number} minWords - The minimum number of words in each fake query.
  * @param {number} maxWords - The maximum number of words in each fake query.
  * @param {string} ratioLabel - A label representing the ratio setting.
  * @returns {Object[]} An array of mixed query objects with metadata.
  * 
  * For each real query, this function generates a specified number of fake queries,
  * assigns metadata to both real and fake queries, and shuffles them together.
  * Each query is also assigned a group ID to link the real query with its corresponding fake queries.
  *   
  */
  realQueries,
  fakeRatio,
  languages,
  minWords = 1,
  maxWords = 3,
  ratioLabel = "1:3"
) {
  const mixedQueries = [];

   /** Loop through each real query and generate fake queries based on the specified ratio and languages.
    */
  for (let i = 0; i < realQueries.length; i++) {
    const realRow = realQueries[i];
    const groupId = `group_${i + 1}`;
    const realQueryText = (realRow.Query || "").trim();

    const realWithMetadata = {
      ...realRow,
      Query: realQueryText,
      label: "real",
      language: "english",
      ratio_setting: ratioLabel,
      group_id: groupId,
      word_count: realQueryText ? realQueryText.split(/\s+/).length : 0
    };

    const fakeRows = [];

    /**Generate fake queries based on the specified ratio and languages
     * # of fake queries = fakeRatio * # of real queries 
     */
    for (let j = 0; j < fakeRatio; j++) {
      const currentLanguage = languages[j % languages.length];
      const wordlistPath = path.join(__dirname, "wordlists", `${currentLanguage}.txt`);

      const generated = generateFakeQueries(
        1,
        wordlistPath,
        minWords,
        maxWords,
        currentLanguage,
        ratioLabel,
        groupId
      );

      fakeRows.push(...generated);
    }
    
    // Shuffle the real query with its corresponding fake queries.
    const bundle = shuffleQueries([realWithMetadata, ...fakeRows]);
    mixedQueries.push(...bundle);
  }

  return mixedQueries;
}

module.exports = { mixRealAndFakeQueries };