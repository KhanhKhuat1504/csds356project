const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const { Parser } = require("json2csv");

function ensureDirectory(dirPath) {
  /*
    Create a directory if it does not already exist.
  */
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readRealQueries(csvPath) {
  /*
    Read real user queries from a CSV file.
    Each row is labeled as "real" and assigned a default language.
    Returns a promise that resolves to a list of objects.
  */
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", row => {
        const queryText = (row.Query || "").trim();
        if (queryText) {
          results.push({
            ...row,
            Query: queryText,
            label: "real",
            language: "english"
          });
        }
      })
      .on("end", () => resolve(results))
      .on("error", err => reject(err));
  });
}

function shuffleQueries(queryList) {
  /*
    Shuffle a list of queries randomly.
  */
  const shuffled = [...queryList];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function writeQueriesToCsv(outputPath, rows) {
  /*
    Write a list of query objects to a CSV file.
  */
  if (!rows || rows.length === 0) return;

  const fields = Array.from(
    new Set(rows.flatMap(row => Object.keys(row)))
  );

  const parser = new Parser({ fields });
  const csvData = parser.parse(rows);

  fs.writeFileSync(outputPath, csvData, "utf-8");
}

module.exports = {
  ensureDirectory,
  readRealQueries,
  shuffleQueries,
  writeQueriesToCsv
};