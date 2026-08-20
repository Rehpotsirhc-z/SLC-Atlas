"""Summarize dynamic and static serving benchmarks."""

import json
from pathlib import Path

RESULTS_DIR = Path(__file__).resolve().parents[1] / "results"


def read_jsonl(path: Path) -> list[dict]:
    """Read nonempty JSON Lines records from a file."""
    return [json.loads(line) for line in path.read_text().splitlines() if line]


def format_size(size: int) -> str:
    """Format a byte count using binary units."""
    if size >= 1_048_576:
        return f"{size / 1_048_576:.2f} MiB"
    return f"{size / 1_024:.1f} KiB"


def main() -> None:
    """Print latency and throughput by endpoint."""
    serving_rows = read_jsonl(RESULTS_DIR / "serving.jsonl")
    ttfb_rows = read_jsonl(RESULTS_DIR / "serving_ttfb.jsonl")

    serving: dict[str, dict[str, dict]] = {}
    endpoint_order: list[str] = []
    for row in serving_rows:
        key = row["key"]
        if key not in endpoint_order:
            endpoint_order.append(key)
        serving.setdefault(key, {})[row["mode"]] = row

    latency: dict[str, dict[str, float]] = {}
    for row in ttfb_rows:
        latency.setdefault(row["key"], {})[row["mode"]] = row["ttfb_ms"]

    loaded_key = next(
        key for key in serving_rows[0] if key.startswith("c") and key[1:].isdigit() and key != "c1"
    )

    print(
        f"{'endpoint':16s} {'payload':>10s} | "
        f"{'dynamic':>9s} {'nginx':>9s} | "
        f"{'dynamic r/s':>11s} {'nginx r/s':>9s}"
    )
    print("-" * 75)
    for key in endpoint_order:
        dynamic = serving[key]["dynamic"]
        static = serving[key]["static"]
        dynamic_latency = latency[key]["dynamic"]
        nginx_latency = latency[key]["nginx"]
        dynamic_rps = dynamic[loaded_key]["rps_mean"]
        nginx_rps = static[loaded_key]["rps_mean"]
        print(
            f"{key:16s} {format_size(dynamic['identity_bytes']):>10s} | "
            f"{dynamic_latency:>7.2f}ms {nginx_latency:>7.2f}ms | "
            f"{dynamic_rps:>11.0f} {nginx_rps:>9.0f}"
        )

    print()
    print("Latency is median time to first byte.")
    print(f"Requests per second are means at concurrency {loaded_key[1:]}.")


if __name__ == "__main__":
    main()
