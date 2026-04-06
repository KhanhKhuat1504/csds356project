# CSDS356 Web Search Privacy — Pipeline

Gervais 2014 linkage attack.
Any questions ask me (Logan), basically the Makefile just stores bash commands for all these files.

---

## First Time Setup

**1. Download the dataset**

Download `user-ct-test-collection-02.txt` from Kaggle and place it in `data/`.

**2. Install Node dependencies for Random Query Injection**

```bash
make setup_npm
```

**3. Set up DP-COMET**

```bash
make setup_dp_comet
conda activate dp-comet
```

> `conda activate` cannot run inside a Makefile — you must run it manually after `setup_dp_comet` completes. You only need to do this once per terminal session.

**4. Install Python dependencies for the attacker**

```bash
cd Attacker && pip install -r requirements.txt
```

---

## Running the Full Pipeline

```bash
conda activate dp-comet
make all
```

This runs in order: `sample → inject → attacker_clean → attacker_split → dp_comet → attack`

---

## Individual Targets

| Target | Description |
|---|---|
| `make sample` | Sample 1000 users from raw AOL dataset → `data/aol_sample.csv` |
| `make inject` | Run Random Query Injection → `Random_Query_Injection/outputs/` |
| `make attacker_clean` | Convert RQI output to pipeline format → `data/pipeline_ready.csv` |
| `make attacker_split` | Split into train and target sets → `data/train_set.csv`, `data/target_set.csv` |
| `make dp_comet` | Run DP-COMET obfuscation → `DP-COMET/data/pipeline_ready.csv/DP-COMET-*/` |
| `make attack` | Run the full linkage attack → `output/results_summary.txt` |

---

## Changing Input Files

Override the default DP-COMET inputs on the command line:

```bash
make dp_comet INPUT=../data/my_file.csv TRAIN_INPUT=../data/my_train.csv
```

To attack a different obfuscated file, edit the `--input` path in `phase2` inside `Attacker/Makefile`.

---

## Configuration Options

**Random Query Injection** — edit the `inject` target arguments:
```
node runRqi.js <ratio_num> <ratio_den> <max_words> <languages>
```
Current default: `1 1 3 english,spanish,french` (1:1 ratio, 1-3 words, three languages)

**DP-COMET** — pass flags to `make dp_comet`:
```bash
make dp_comet                          # defaults: CMP, 50 iterations, all epsilons
make dp_comet INPUT=../data/file.csv   # custom input
```
See `DP-COMET/README.md` for full argument list including `--mechanism`, `--iterations`, `--epsilons`.

---

## Output

Attack results are written to `output/` at the project root:

```
output/
  results_summary.txt     human-readable privacy report
  metrics_table.csv       FP/FN rates, attack accuracy, semantic privacy
  topic_profiles.csv      true vs inferred topic distribution
  cluster_results.csv     per-query cluster assignments
```

DP-COMET outputs are written to:
```
DP-COMET/data/<input_path>/DP-COMET-CMP/obfuscatedText_DP-COMET-CMP_<epsilon>.csv
DP-COMET/data/<input_path>/DP-COMET-Mhl/obfuscatedText_DP-COMET-Mhl_<epsilon>.csv
```

Any questions ask me (Logan), basically the Makefile just stores bash commands for all these files.