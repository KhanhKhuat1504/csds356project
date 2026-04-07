from __future__ import annotations

import math
import pickle
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE


PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = Path(__file__).resolve().parent / "generated_plots"
RUN_DIRS = [
    "target_results/output_baseline", # remove targert_results unless you moved them to this directory
    "target_results/output_rqi",
    "target_results/output_dpcomet_mhl_1",
    "target_results/output_dpcomet_mhl_5",
    "target_results/output_dpcomet_mhl_10",
    "target_results/output_dpcomet_mhl_15",
    "target_results/output_dpcomet_mhl_20",
    "target_results/output_dpcomet_mhl_50",
]

CLUSTER_PALETTE = {0: "#1002d9", 1: "#1b9e77"}
LABEL_MARKERS = {"real": "o", "fake": "X"}


def ensure_output_root() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)


def load_run_frame(run_name: str) -> pd.DataFrame:
    run_path = PROJECT_ROOT / run_name
    cluster_df = pd.read_csv(run_path / "cluster_results.csv")

    with open(run_path / "query_features.pkl", "rb") as handle:
        features = pickle.load(handle)

    feature_rows = []
    for item in features:
        row = {k: v for k, v in item.items() if k != "embedding"}
        row["embedding"] = item["embedding"]
        feature_rows.append(row)

    feature_df = pd.DataFrame(feature_rows)
    cluster_df["QueryTime"] = pd.to_datetime(cluster_df["QueryTime"]).astype(str)
    feature_df["QueryTime"] = pd.to_datetime(feature_df["QueryTime"]).astype(str)

    merged = cluster_df.merge(
        feature_df[["query_id", "Query", "QueryTime", "embedding"]],
        on=["query_id", "Query", "QueryTime"],
        how="left",
        validate="one_to_one",
    )

    if merged["embedding"].isna().any():
        missing = int(merged["embedding"].isna().sum())
        raise ValueError(f"{run_name}: missing embeddings for {missing} target queries")

    embedding_matrix = np.vstack(merged["embedding"].to_numpy())
    merged["pca_x"], merged["pca_y"] = project_pca(embedding_matrix)
    merged["tsne_x"], merged["tsne_y"] = project_tsne(embedding_matrix)
    merged["minutes_from_start"] = (
        pd.to_datetime(merged["QueryTime"]) - pd.to_datetime(merged["QueryTime"]).min()
    ).dt.total_seconds() / 60.0
    merged["run_name"] = run_name.replace("output_", "")
    return merged


def project_pca(embeddings: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    coords = PCA(n_components=2, random_state=42).fit_transform(embeddings)
    return coords[:, 0], coords[:, 1]


def project_tsne(embeddings: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    perplexity = min(30, max(5, len(embeddings) // 8))
    coords = TSNE(
        n_components=2,
        init="pca",
        learning_rate="auto",
        perplexity=perplexity,
        random_state=42,
    ).fit_transform(embeddings)
    return coords[:, 0], coords[:, 1]


def save_pca_plot(df: pd.DataFrame, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(10, 7))
    draw_cluster_scatter(
        ax=ax,
        df=df,
        x="pca_x",
        y="pca_y",
        title=f"{df['run_name'].iloc[0]}: PCA projection of target-stream clusters",
        xlabel="PCA 1",
        ylabel="PCA 2",
    )
    fig.tight_layout()
    fig.savefig(out_path, dpi=220)
    plt.close(fig)


def save_tsne_plot(df: pd.DataFrame, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(10, 7))
    draw_cluster_scatter(
        ax=ax,
        df=df,
        x="tsne_x",
        y="tsne_y",
        title=f"{df['run_name'].iloc[0]}: t-SNE view of target-stream clusters",
        xlabel="t-SNE 1",
        ylabel="t-SNE 2",
    )
    fig.tight_layout()
    fig.savefig(out_path, dpi=220)
    plt.close(fig)


def draw_cluster_scatter(
    ax: plt.Axes,
    df: pd.DataFrame,
    x: str,
    y: str,
    title: str,
    xlabel: str,
    ylabel: str,
) -> None:
    for label, marker in LABEL_MARKERS.items():
        subset = df[df["TrueLabel"] == label]
        ax.scatter(
            subset[x],
            subset[y],
            c=subset["ClusterLabel"].map(CLUSTER_PALETTE),
            marker=marker,
            s=70 if label == "real" else 85,
            alpha=0.82,
            edgecolors=np.where(subset["Correct"], "#111111", "#b2182b"),
            linewidths=np.where(subset["Correct"], 1, 2.5),
            label=f"{label} queries",
        )

    ax.set_title(title)
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    ax.grid(alpha=0.2, linestyle="--")

    cluster_handles = [
        plt.Line2D([0], [0], marker="o", color="w", label=f"Cluster {cluster_id}",
                   markerfacecolor=color, markeredgecolor="#333333", markersize=10)
        for cluster_id, color in CLUSTER_PALETTE.items()
    ]
    label_handles = [
        plt.Line2D([0], [0], marker=marker, color="#555555", linestyle="",
                   label=f"{label} shape", markerfacecolor="#cccccc", markersize=10)
        for label, marker in LABEL_MARKERS.items()
    ]
    mismatch_handle = plt.Line2D(
        [0],
        [0],
        marker="o",
        color="w",
        linestyle="",
        label="Red outline = misclassified",
        markerfacecolor="#cccccc",
        markeredgecolor="#b2182b",
        markersize=10,
        markeredgewidth=1.6,
    )
    ax.legend(
        handles=cluster_handles + label_handles + [mismatch_handle],
        loc="best",
        frameon=True,
    )


def save_timeline_plot(df: pd.DataFrame, out_path: Path) -> None:
    plot_df = df.sort_values("minutes_from_start").copy()
    plot_df["lane"] = plot_df["TrueLabel"].map({"real": 1, "fake": 0})

    fig, ax = plt.subplots(figsize=(12, 4.8))
    ax.scatter(
        plot_df["minutes_from_start"],
        plot_df["lane"],
        c=plot_df["ClusterLabel"].map(CLUSTER_PALETTE),
        s=np.where(plot_df["Correct"], 55, 95),
        marker="o",
        alpha=0.85,
        edgecolors=np.where(plot_df["Correct"], "#222222", "#b2182b"),
        linewidths=np.where(plot_df["Correct"], 0.5, 1.5),
    )
    ax.set_title(f"{df['run_name'].iloc[0]}: cluster assignments over time")
    ax.set_xlabel("Minutes since first target-stream query")
    ax.set_yticks([0, 1], labels=["fake", "real"])
    ax.set_ylabel("True label")
    ax.grid(alpha=0.2, linestyle="--")
    fig.tight_layout()
    fig.savefig(out_path, dpi=220)
    plt.close(fig)


def save_composition_plot(df: pd.DataFrame, out_path: Path) -> None:
    counts = (
        df.groupby(["ClusterLabel", "TrueLabel"])
        .size()
        .rename("count")
        .reset_index()
    )
    df["ClusterLabel"] = df["ClusterLabel"].astype(str)  # for better x-axis labels

    fig, ax = plt.subplots(figsize=(8, 5))
    sns.barplot(
        data=counts,
        x="ClusterLabel",
        y="count",
        hue="TrueLabel",
        palette={"real": "#4c78a8", "fake": "#e45756"},
        ax=ax,
    )
    ax.set_title(f"{df['run_name'].iloc[0]}: real/fake composition inside each cluster")
    ax.set_xlabel("Cluster label")
    ax.set_ylabel("Query count")
    ax.set_xticks([0, 1])
    ax.set_xticklabels(["Fake", "Real"])
    ax.legend(title="True label")
    fig.tight_layout()
    fig.savefig(out_path, dpi=220)
    plt.close(fig)


def save_overview_plot(frames: list[pd.DataFrame], out_path: Path) -> None:
    ncols = 3
    nrows = math.ceil(len(frames) / ncols)
    fig, axes = plt.subplots(nrows=nrows, ncols=ncols, figsize=(16, 5 * nrows))
    axes = np.atleast_1d(axes).ravel()

    for ax, df in zip(axes, frames):
        for label, marker in LABEL_MARKERS.items():
            subset = df[df["TrueLabel"] == label]
            ax.scatter(
                subset["pca_x"],
                subset["pca_y"],
                c=subset["ClusterLabel"].map(CLUSTER_PALETTE),
                marker=marker,
                s=28,
                alpha=0.8,
                edgecolors="none",
            )
        ax.set_title(df["run_name"].iloc[0])
        ax.set_xticks([])
        ax.set_yticks([])
        ax.set_xlabel("")
        ax.set_ylabel("")

    for ax in axes[len(frames):]:
        ax.axis("off")

    legend_handles = [
        plt.Line2D([0], [0], marker="o", color="w", label=f"Cluster {cluster_id}",
                   markerfacecolor=color, markeredgecolor="#333333", markersize=10)
        for cluster_id, color in CLUSTER_PALETTE.items()
    ]
    legend_handles.extend(
        plt.Line2D([0], [0], marker=marker, color="#555555", linestyle="",
                   label=f"{label} queries", markerfacecolor="#cccccc", markersize=10)
        for label, marker in LABEL_MARKERS.items()
    )

    fig.suptitle("Cluster-separation overview across all experiment outputs", fontsize=16, y=0.995)
    fig.legend(handles=legend_handles, loc="lower center", ncol=4, frameon=True, bbox_to_anchor=(0.5, 0.02))
    fig.tight_layout(rect=(0, 0.06, 1, 0.97))
    fig.savefig(out_path, dpi=220)
    plt.close(fig)


def main() -> None:
    sns.set_theme(style="whitegrid", context="talk")
    ensure_output_root()

    frames = []
    for run_name in RUN_DIRS:
        df = load_run_frame(run_name)
        frames.append(df)

        run_output = OUTPUT_ROOT / run_name.replace("output_", "")
        run_output.mkdir(parents=True, exist_ok=True)

        save_pca_plot(df, run_output / "pca_clusters.png")
        save_tsne_plot(df, run_output / "tsne_clusters.png")
        save_timeline_plot(df, run_output / "timeline_clusters.png")
        save_composition_plot(df, run_output / "cluster_composition.png")

    save_overview_plot(frames, OUTPUT_ROOT / "overview_pca_grid.png")


if __name__ == "__main__":
    main()
