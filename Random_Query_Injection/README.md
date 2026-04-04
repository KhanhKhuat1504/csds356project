# Random Query Injection (RQI)

This obfuscation method is fake queries are generated and mixed in with a user’s true queries, making it more difficult to profile them. Random query injection that we are using is presented by Firc et. al (2025), which explores the implementation on a few small datasets. We will be using a JavaScript script from this implementation. :contentReference[oaicite:0]{index=0}

## Overview

The RQI pipeline supports the following configurable parameters:

- fake-query ratio (e.g, `1:1`, `1:3`, `1:7`)
- language pool (for example, `english`, `english,spanish,french`)
- minimum and maximum number of words per fake query

The pipeline also includes an analysis script that compares generated RQI datasets against the original AOL dataset using dataset-level statistics and keyword-overlap measurements.

## Folder Structure

    CSDS356PROJECT/
    ├── aol_queries_only.csv
    ├── data/
    ├── DP-COMET/
    ├── Random_Query_Injection/
    │   ├── runRqi.js
    │   ├── mixQueries.js
    │   ├── generateFakeQueries.js
    │   ├── utils.js
    │   ├── compareRatios.js
    │   ├── wordlists/
    │   │   ├── english.txt
    │   │   ├── spanish.txt
    │   │   └── french.txt
    │   └── outputs/
    ├── README.md
    └── requirements.txt

## Requirements

- Node.js
- npm

Install the required packages inside `Random_Query_Injection/`:

    cd Random_Query_Injection
    npm install csv-parser json2csv

If the project has already been initialized with npm, the command above is sufficient.

## Input Dataset

The `aol_queries_only.csv` created by using sample_aol.py from the proejct root will be utilized.


The script reads real user queries from this file and generates fake queries to create obfuscated datasets.

## Wordlists

Language-specific wordlists are placed in:

    Random_Query_Injection/wordlists/

Currently, we have:

- `english.txt`
- `spanish.txt`
- `french.txt`

Each wordlist are under the following format:

- one word per line
- no commas
- no extra metadata
- plain text only

These wordlists contain broad general vocabulary and proper nouns. In Firc et al. (2025)'s experiment, obfuscating queries are generated from language-specific dictionaries and configured through query-length and language-pool settings. 

## Running Random Query Injection

The script format is:

    node runRqi.js <fakeRatio> <minWords> <maxWords> <languages>

### Arguments

- `fakeRatio`: # of fake queries generated per real query. Currently 3 is default.
- `minWords`: minimum # of words per fake query 
- `maxWords`: maximum # of words per fake query 
- `languages`: comma-separated list of languages

minWords must be equal or smaller than maxWords. In the referred paper, they randomly selected 1 to 3 words inspired by research on natural query lengths, following the natural search behaviour. 

### Examples

This generates a `1:1` multilingual dataset with 1–3 words per fake query:

    node runRqi.js 1 1 3 english,spanish,french

This generates a `1:3` multilingual dataset with 1–3 words per fake query:

    node runRqi.js 3 1 3 english,spanish,french

This generates a `1:7` multilingual dataset with 1–3 words per fake query:

    node runRqi.js 7 1 3 english,spanish,french

This generates an English-only dataset with longer fake queries:

    node runRqi.js 3 2 4 english

This generates a bilingual dataset of english and spanish:

    node runRqi.js 3 1 3 english,spanish

## Output Files

Generated files are saved in:

    Random_Query_Injection/outputs/

Example output filenames:

    aol_rqi_ratio_1_1_english_spanish_french_1-3.csv
    aol_rqi_ratio_1_3_english_spanish_french_1-3.csv
    aol_rqi_ratio_1_7_english_spanish_french_1-3.csv

### Filename Format

    aol_rqi_ratio_<real>_<fake>_<languages>_<minWords>-<maxWords>.csv

Example:

    aol_rqi_ratio_1_3_english_spanish_french_1-3.csv

This means that this AOL Dataset has:

- real-to-fake ratio of `1:3`
- `english`, `spanish`, `french` used for fake queries
- `1–3` words used per queries

## Output Columns

Each generated output dataset contains all of original AOL columns and metadata columns.

There are 9 columns total:

- `Query`
- `label`
- `language`
- `ratio_setting`
- `group_id`
- `word_count`
- `AnonID`
- `QueryTime`
- `SessionID`

### Original AOL Columns

These are preserved for real queries when available. AOL datasets have entries where some elements left blank.

- `AnonID`
- `Query`
- `QueryTime`
- `SessionID`

### Added Metadata

- `label`: `real` or `fake`
- `language`: language assigned
- `ratio_setting`: ratio used
- `group_id`: groups one real query with its associated fake queries
- `word_count`: # of words in the query

### Notes on Fake Rows

Fake rows do not come from the original AOL dataset, so some original AOL metadata fields may be blank.

## How the Mixing Works

For each real AOL query:

1. the script generates fake queries
2. fake queries created using random words from selected language wordlists
3. fake queries are grouped with the real query with same `group_id`
4. tAll groups are shuffled before listed on output files

## Comparing Generated Datasets

To compare all generated RQI datasets in the `outputs/` folder against the original AOL dataset, run:

    node compareRatios.js

The comparison script automatically scans the `outputs/` directory and reads all matching RQI CSV files.

## Measurements

The comparison script reports dataset-level statistics for each generated output file.

These include:

- total rows
- number of real rows
- number of fake rows
- proportion of fake queries
- number of unique queries
- duplicate rate
- average number of content words per query
- top-word frequency analysis
- keyword overlap with the original AOL dataset using Jaccard similarity

## Keyword Analysis

The analysis supports:

- adjusting top-word set size
- optional stopword removal
- Jaccard similarity between keyword sets

Higher `topN` will make the analysis more sensitive

## Stopword Removal

The comparison script can be run either with stopword removal enabled not.

You can change this setting on `compareRatios.js`.

If the setting is enabled, common English function words (e.g a, and, an) are filtered during tokenization.