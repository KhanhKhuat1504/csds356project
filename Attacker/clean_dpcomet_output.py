"""
clean_dpcomet_output.py

Applies DP-COMET obfuscation to the real queries in an RQI output CSV,
preserving the RQI format so temp_clean.py can process it as normal.

DP-COMET runs 50 iterations per query producing 50 obfuscated candidates.
This script picks the mode (most frequently selected text) as the
representative obfuscated query for each (user, query) pair.

Only real queries are obfuscated — fake queries are left unchanged.

Input : RQI output CSV   (AnonID, Query, QueryTime, ..., label, group_id, ...)
        DP-COMET output  (id, text, obfuscatedText, epsilon, mechanism)
Output: Same RQI format with real Query text replaced by obfuscatedText

Usage:
    python clean_dpcomet_output.py \\
        --rqi_input  data/aol_rqi_ratio_1_1_english_spanish_french_1-3.csv \\
        --dpcomet    DP-COMET/results/.../obfuscatedText_DP-COMET-CMP_10.csv \\
        --output     data/aol_rqi_dpcomet_eps10.csv
"""

import argparse
import pandas as pd
import os


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--rqi_input",  required=True,
                   help="Path to RQI output CSV")
    p.add_argument("--dpcomet",    required=True,
                   help="Path to DP-COMET output CSV for one epsilon")
    p.add_argument("--output",     default=None,
                   help="Output path. Auto-named from epsilon if omitted.")
    return p.parse_args()


def get_mode(series):
    return series.mode().iloc[0]


def main():
    args = parse_args()

    print(f"\n[CLEAN DP-COMET] Applying obfuscation to RQI file\n")

    # ---- load inputs ----
    rqi = pd.read_csv(args.rqi_input)
    dp  = pd.read_csv(args.dpcomet)

    epsilon   = dp["epsilon"].iloc[0]
    mechanism = dp["mechanism"].iloc[0]
    print(f"  RQI rows    : {len(rqi):,}")
    print(f"  DP-COMET    : {len(dp):,} rows | epsilon={epsilon} | {mechanism}")

    # ---- get one representative obfuscated text per (user, query) ----
    print("  Selecting mode obfuscated text per query...")
    dp["id"]         = dp["id"].astype(int)
    dp["text_lower"] = dp["text"].str.lower().str.strip()

    representative = (
        dp.groupby(["id", "text_lower"])["obfuscatedText"]
        .agg(get_mode)
        .reset_index()
        .rename(columns={
            "id":             "AnonID",
            "text_lower":     "query_lower",
            "obfuscatedText": "ObfuscatedQuery",
        })
    )
    print(f"  Representative pairs: {len(representative):,}")

    # ---- join onto real rows only ----
    rqi["query_lower"] = rqi["Query"].str.lower().str.strip()
    rqi["AnonID_int"]  = rqi["AnonID"].fillna(-1).astype(int)

    merged = rqi.merge(
        representative,
        left_on=["AnonID_int", "query_lower"],
        right_on=["AnonID",    "query_lower"],
        how="left",
        suffixes=("", "_dp"),
    )

    # Only replace Query for real rows that have a match
    label_col = "Label" if "Label" in merged.columns else "label"
    
    # Replace Query for ALL rows that have a match (real and fake)
    has_obfusc   = merged["ObfuscatedQuery"].notna()
    replace_mask = has_obfusc

    # define masks
    real_mask    = merged[label_col] == "real"
    has_obfusc   = merged["ObfuscatedQuery"].notna()
    replace_mask = has_obfusc  # apply to ALL rows, not just real

    matched   = replace_mask.sum()
    unmatched = (~replace_mask).sum()
    print(f"  Queries obfuscated : {matched:,}")
    print(f"  Queries unmatched  : {unmatched:,}  (kept original)")
    print(f"  Real obfuscated    : {(real_mask & has_obfusc).sum():,}")
    print(f"  Fake obfuscated    : {(~real_mask & has_obfusc).sum():,}")

    merged.loc[replace_mask, "Query"] = merged.loc[replace_mask, "ObfuscatedQuery"]

    merged.loc[replace_mask, "Query"] = merged.loc[replace_mask, "ObfuscatedQuery"]

    # ---- restore original columns only ----
    out = merged[list(rqi.columns.difference(["query_lower", "AnonID_int"]))].copy()
    # drop helper cols that may have leaked in
    out = out.drop(columns=["query_lower", "AnonID_int", "ObfuscatedQuery",
                             "AnonID_dp"], errors="ignore")
    # restore original column order
    original_cols = [c for c in rqi.columns if c not in ["query_lower", "AnonID_int"]]
    out = out[original_cols]

    # ---- auto-name output ----
    if args.output is None:
        mech_short = mechanism.replace("DP-COMET-", "").lower()
        base       = os.path.splitext(os.path.basename(args.rqi_input))[0]
        args.output = f"data/{base}_dpcomet_{mech_short}_eps{epsilon}.csv"

    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)
    out.to_csv(args.output, index=False)

    print(f"\n  Wrote: {args.output}")
    print(f"  Next : python temp_clean.py --input {args.output}")


if __name__ == "__main__":
    main()