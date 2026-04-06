.PHONY: all sample inject dp_comet setup_npm setup_dp_comet

# Install Node dependencies for Random Query Injection
setup_npm:
	npm install
	cd Random_Query_Injection && npm install csv-parser json2csv@5.0.7

# Initialise DP-COMET submodule and create conda environment - NOTE: must activate dp-comet env after
setup_dp_comet:
	git submodule update --init
	cd DP-COMET && conda env create -f config/environment.yml

# Sample users from raw AOL dataset -> data/aol_sample.csv + data/aol_queries_only.csv
sample:
	python sample_aol.py \
		--input_path data/user-ct-test-collection-02.txt \
		--output_csv data/aol_sample.csv \
		--output_queries_only_csv data/aol_queries_only.csv

# Run Random Query Injection (ratio 1:1, 1-3 words, english/spanish/french)
inject:
	cd Random_Query_Injection && node runRqi.js 1 1 3 english,spanish,french

# run clean_rqi_output
attacker_clean:
	cd Attacker && make clean_rqi_output

# split_rqi_output to get final CSVs for DP-COMET
attacker_split:
	cd Attacker && make split_train

# Run DP-COMET obfuscation on queries-only CSV
# NOTE: must run `make setup_dp_comet` one time first and activate dp-comet conda env if your env isn't already set up
# Note this data is saved into a differetn location to the rest of the pipeline outputs
INPUT ?= ../data/pipeline_ready.csv
TRAIN_INPUT ?= ../data/train_set.csv
dp_comet:
	cd DP-COMET && python main.py \
		--dataset $(INPUT) \
		--training-data $(TRAIN_INPUT) \
		--max-training-rows 5000

# Run all_ob_injected_fakes in the conda environment
attack:
	cd Attacker && make all_ob_injected_fakes


# Full process
setup:
	make setup_npm
	make setup_dp_comet
# activate env if not already
# run full process (sample -> attack), 
# you will need to re-run attack on different files (for now edit the Makefle paths in Attack directory)
# this assumes a default dp-comet and injection process, change those according to their respective configuration options if needed
all: sample inject attacker_clean attacker_split dp_comet attack
