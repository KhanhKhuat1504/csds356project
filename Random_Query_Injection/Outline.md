# Random Query Injection

## Input Data

This will use sampled `user-ct-test-collection-02.txt` from Kaggle, which is aol_queries_only.csv

## Output
injected_queries.csv

## Output Format
AnonID, Query, QueryTime, SessionID, label

Label will binary: real / fake

## Fake Query Injection Strategy

In the queries, the following will be added:

- Random words (1~3 words)
- Dictionary-based (or simple random)
- English only (initial version)

Fake queries will be inserted in real queries.