.PHONY: all setup setup_npm setup_dp_comet sample inject dp_comet attack \
        clean gen_fakes split_train clean_rqi_output \
        phase2 phase3 phase4 phase5 phase6 relative_privacy \
        full_attack sample_base injected all_base all_inject all_dp_inject \
        collect variants


# Setup
# =============================================================================

# Install Node dependencies for Random Query Injection
setup_npm:
	npm install
	cd Random_Query_Injection && npm install csv-parser json2csv@5.0.7

# Initialise DP-COMET submodule and create conda environment
# NOTE: after this completes, manually run: conda activate dp-comet
setup_dp_comet:
	git submodule update --init
	cd DP-COMET && conda env create -f config/environment.yml

# Run both setup steps
setup: setup_npm setup_dp_comet


# Data Preparation
# =============================================================================

# Sample 1000 users from raw AOL dataset -> data/aol_sample.csv
sample:
	python sample_aol.py \
		--input_path data/user-ct-test-collection-02.txt \
		--output_csv data/aol_sample.csv \
		--output_queries_only_csv data/aol_queries_only.csv \
		--target_users 1000 \
		--max_queries_per_user 100 \
		--session_gap_minutes 30


# Obfuscation
# =============================================================================

# Run Random Query Injection (ratio 1:1, 1-3 words, english/spanish/french)
inject:
	cd Random_Query_Injection && node runRqi.js 1 1 3 english,spanish,french

# Run DP-COMET obfuscation
# NOTE: must activate dp-comet conda env before running
# Override defaults: make dp_comet DP_INPUT=data/my_file.csv TRAIN_INPUT=data/my_train.csv
DP_INPUT     ?= data/pipeline_ready_rqi.csv
TRAIN_INPUT  ?= data/train_set.csv
DP_MECHANISM ?= CMP
DP_EPSILONS  ?= 1 5 10 15 20 50
dp_comet:
	cd DP-COMET && python main.py \
		--dataset ../$(DP_INPUT) \
		--training-data ../$(TRAIN_INPUT) \
		--max-training-rows 5000 \
		--mechanism $(DP_MECHANISM) \
		--epsilons $(DP_EPSILONS)	


# Attacker — Data Pipeline
# =============================================================================

# Add Label/Role columns and generate placeholder fakes
# Override input: make gen_fakes INPUT=data/my_file.csv
INPUT ?= data/aol_sample.csv
gen_fakes:
	cd Attacker && python phase1.py \
		--input ../$(INPUT) \
		--output ../data/pipeline_ready_base.csv
	cd Attacker && python gen_fakes.py \
		--input ../data/pipeline_ready_base.csv \
		--output ../data/pipeline_ready_baseline.csv

# Split a pipeline-ready file into train and target sets
# Override: make split_train SPLIT_INPUT=data/my_file.csv
SPLIT_INPUT ?= data/pipeline_ready_rqi.csv
split_train:
	cd Attacker && python split_train_set.py \
		--input ../$(SPLIT_INPUT) \
		--train_out ../data/train_set.csv \
		--target_out ../data/target_set.csv

# Convert RQI output to pipeline format -> data/pipeline_ready_rqi.csv
# Override input: make clean_rqi_output RQI_INPUT=rqi_data/my_rqi_file.csv
RQI_INPUT ?= rqi_data/aol_rqi_ratio_1_1_english_spanish_french_1-3.csv
clean_rqi_output:
	cd Attacker && python temp_clean.py \
		--input ../$(RQI_INPUT) \
		--output ../data/pipeline_ready_rqi.csv

# Convert all DP-COMET Mhl outputs to pipeline format
clean_dpcomet_mhl:
	for eps in 1.0 5.0 10.0 15.0 20.0 50.0; do \
		python Attacker/clean_dpcomet_output.py \
			--rqi_input data/pipeline_ready_rqi.csv \
			--dpcomet DP-COMET/data/pipeline_ready_rqi.csv/DP-COMET-Mhl/obfuscatedText_DP-COMET-Mhl_$${eps}.csv \
			--output data/pipeline_ready_dpcomet_mhl_$${eps}.csv; \
	done

# Attacker — Attack Pipeline
# =============================================================================

# Extract 16 features per query
# Override: make phase2 ATTACK_INPUT=data/my_file.csv
ATTACK_INPUT ?= data/pipeline_ready_rqi.csv
phase2:
	cd Attacker && python phase2_feature_extraction.py \
		--input ../$(ATTACK_INPUT) \
		--output_dir ../output

# Build pairwise features for training and attack
phase3:
	cd Attacker && python phase3_pairwise_features.py \
		--features ../output/query_features.pkl \
		--mode train \
		--output_dir ../output
	cd Attacker && python phase3_pairwise_features.py \
		--features ../output/query_features.pkl \
		--mode target \
		--output_dir ../output

# Train 60 GBRT models on training pairs
phase4:
	cd Attacker && python phase4_gbrt_training.py \
		--pairs ../output/train_pairs.pkl \
		--output_dir ../output

# Run linkage attack — k-means k=2, compute FP/FN
phase5:
	cd Attacker && python phase5_linkage_attack.py \
		--target_pairs ../output/target_pairs.pkl \
		--models_dir ../output/models \
		--output_dir ../output

# Build topic profiles and save human-readable summary
phase6:
	cd Attacker && python phase6_results.py \
		--cluster_results ../output/cluster_results.csv \
		--attack_metrics ../output/attack_metrics.pkl \
		--output_dir ../output

# Compare two attack output directories for relative privacy
# Override: make relative_privacy CONTROL=output_baseline EXPERIMENT=output_rqi
CONTROL    ?= output_baseline
EXPERIMENT ?= output_rqi
relative_privacy:
	cd Attacker && python relative_privacy.py \
		--control ../$(CONTROL) \
		--experiment ../$(EXPERIMENT) \
		--output_dir ../output_comparison


# Full Pipeline Targets
# =============================================================================

# Pipeline Ready => full attack
full_attack: phase2 phase3 phase4 phase5 phase6

# Placeholder fakes -> full attack
sample_base: gen_fakes full_attack

# RQI Output => clean -> full attack
injected: clean_rqi_output full_attack

# Raw Data => Sample -> placeholder fakes -> full attack
all_base: sample gen_fakes full_attack

# Raw Data => Sample -> RQI inject -> clean -> full attack
all_inject: sample inject injected

# Raw Data => Sample -> RQI inject -> clean -> split -> DP-COMET -> attack
all_dp_inject: sample inject clean_rqi_output split_train dp_comet full_attack

# Collect all data needed for variants:
#   1. Sample raw AOL data
#   2. Run RQI injection
#   3. Clean RQI output -> data/pipeline_ready_rqi.csv
#   4. Generate placeholder fakes -> data/pipeline_ready_baseline.csv
#   5. Split RQI file for train/target sets
#   6. Run DP-COMET CMP and Mhl on RQI output
collect: sample inject clean_rqi_output gen_fakes split_train
	$(MAKE) dp_comet DP_MECHANISM=CMP
	$(MAKE) dp_comet DP_MECHANISM=Mhl
	$(MAKE) clean_dpcomet_mhl


# Variants — Run attack on multiple input files, save each to its own output dir
# =============================================================================
#
# Each variant: NAME:INPUT_FILE
# First variant is treated as the control for relative privacy comparisons.
#
# Output directories:
#   output_<name>/        attack results per variant
#   output_comparison/    relative privacy CSVs

# 	baseline:data/pipeline_ready_baseline.csv \
	rqi:data/pipeline_ready_rqi.csv \

VARIANTS = \
	dpcomet_mhl_1:data/pipeline_ready_dpcomet_mhl_1.0.csv \
	dpcomet_mhl_5:data/pipeline_ready_dpcomet_mhl_5.0.csv \
	dpcomet_mhl_10:data/pipeline_ready_dpcomet_mhl_10.0.csv \
	dpcomet_mhl_15:data/pipeline_ready_dpcomet_mhl_15.0.csv \
	dpcomet_mhl_20:data/pipeline_ready_dpcomet_mhl_20.0.csv \
	dpcomet_mhl_50:data/pipeline_ready_dpcomet_mhl_50.0.csv

variants:
	@$(eval FIRST_NAME := $(word 1,$(subst :, ,$(word 1,$(VARIANTS)))))
	@for variant in $(VARIANTS); do \
		NAME=$$(echo $$variant | cut -d: -f1); \
		FILE=$$(echo $$variant | cut -d: -f2-); \
		echo ""; \
		echo "================================================================"; \
		echo "  Running variant: $$NAME"; \
		echo "  Input: $$FILE"; \
		echo "================================================================"; \
		$(MAKE) full_attack ATTACK_INPUT=$$FILE; \
		mv output output_$$NAME; \
		echo "  Saved -> output_$$NAME/"; \
	done
	@echo ""
	@echo "================================================================"
	@echo "  All variants complete. Running relative privacy comparisons..."
	@echo "================================================================"
	@for variant in $(VARIANTS); do \
		NAME=$$(echo $$variant | cut -d: -f1); \
		if [ "$$NAME" != "$(FIRST_NAME)" ]; then \
			echo "  Comparing $(FIRST_NAME) vs $$NAME..."; \
			$(MAKE) relative_privacy \
				CONTROL=output_$(FIRST_NAME) \
				EXPERIMENT=output_$$NAME; \
			cp output_comparison/relative_privacy.csv \
			   output_comparison/relative_privacy_$(FIRST_NAME)_vs_$$NAME.csv; \
		fi; \
	done
	@echo ""
	@echo "  Done. Results saved to output_*/ and output_comparison/"

visualize:
	cd Attacker && python generate_cluster_plots.py

# Cleanup
# =============================================================================
clean:
	rm -rf output output_baseline output_rqi output_dpcomet* output_comparison
	rm -f data/aol_sample.csv data/aol_queries_only.csv \
	      data/pipeline_ready.csv data/pipeline_ready_base.csv \
	      data/pipeline_ready_baseline.csv data/pipeline_ready_rqi.csv \
	      data/train_set.csv data/target_set.csv
