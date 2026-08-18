# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Take whatever the browser keeps out of each GWAS study the curation file names.

A genome-wide study runs to hundreds of megabytes. Sliced to the windows around the family's
genes that is a few percent of it; unsliced it is the study entire, which is worth keeping
because the view can travel to any locus a study has a point at.

A study named by its GWAS Catalog accession is downloaded in its harmonized form, whose
columns are already named the same way for every study. A study given as a path is read
where it lies, under whichever of the usual column names it happens to use.
"""

import csv
import gzip
import re
from bisect import bisect_right
from datetime import date
from pathlib import Path
from urllib.request import urlopen

import polars as pl

from ..lib import chroms as chrom_names, console, progress, windows
from ..lib.http import download
from ..lib.reporting import count, report_missing

CATALOG = "https://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics"
ACCESSION = re.compile(r"^GCST\d+$")
HARMONIZED = re.compile(r'href="([^"]+\.h\.tsv\.gz)"')

# File suffixes accepted for local summary statistics
READABLE = {".tsv", ".txt", ".csv", ".gz", ".parquet"}

STUDIES_HEADER = (
    "study_id",
    "trait",
    "citation",
    "source",
    "assembly",
    "license_spdx",
    "url",
    "retrieved_date",
    "n_variants",
    "chroms",
)

# BED chromStart is zero-based; all other accepted position columns are one-based
ZERO_BASED = ("chromstart",)
ONE_BASED = ("base_pair_location", "position", "pos", "bp", "hm_pos")

# Column names used by supported summary-statistics formats
COLUMNS = {
    "chrom": ("chromosome", "chrom", "chr", "hm_chrom", "#chrom"),
    "position": ONE_BASED + ZERO_BASED,
    "snp_id": ("rsid", "snp_id", "variant_id", "hm_rsid", "snp", "rs_id"),
    "p_value": ("p_value", "p", "pval", "pvalue"),
    "beta": ("beta", "beta_value", "hm_beta", "effect_size", "b"),
}

SCHEMA = {
    "study_id": pl.Utf8,
    "chrom": pl.Utf8,
    "position": pl.Int64,
    "snp_id": pl.Utf8,
    "p_value": pl.Float64,
    "beta": pl.Float32,
}


def accession_range(accession: str) -> str:
    number = int(accession[4:])
    low = ((number - 1) // 1000) * 1000 + 1
    width = len(accession) - 4
    return f"GCST{low:0{width}d}-GCST{low + 999:0{width}d}"


def catalog_url(accession: str) -> str:
    # The Catalog spells its own directory this way
    # cspell:ignore harmonised
    listing = f"{CATALOG}/{accession_range(accession)}/{accession}/harmonised/"
    try:
        html = urlopen(listing, timeout=120).read().decode("utf-8", "replace")
    except Exception as error:
        raise SystemExit(f"GWAS Catalog has no harmonized statistics for {accession}: {error}")
    names = sorted(set(HARMONIZED.findall(html)))
    if not names:
        raise SystemExit(
            f"GWAS Catalog lists no harmonized file for {accession} at {listing}. "
            f"Download the statistics yourself and give the path instead."
        )
    return listing + names[0]


def position_of(raw, where: str, line: int) -> int:
    """Read a coordinate, refusing one that has already lost its low digits."""
    if isinstance(raw, int):
        return raw
    value = str(raw).strip()
    if "e" in value or "E" in value:
        raise SystemExit(
            f"{where} line {line} writes the position as {value!r}. Scientific notation "
            f"places a variant no better than tens of bases, which is wider than an exon, "
            f"so the file cannot be drawn. Export it again with whole-number positions."
        )
    try:
        return int(value)
    except ValueError:
        number = float(value)
        if not number.is_integer():
            raise SystemExit(f"{where} line {line} has a fractional position {value!r}")
        return int(number)


def _index(fieldnames, wanted) -> dict[str, str]:
    lowered = {name.strip().lower(): name for name in fieldnames or ()}
    found = {}
    for key, aliases in wanted.items():
        for alias in aliases:
            if alias in lowered:
                found[key] = lowered[alias]
                break
    return found


def _open(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", newline="")
    return open(path, encoding="utf-8", newline="")


def payload_files(source: Path) -> list[Path]:
    if source.is_dir():
        return sorted(p for p in source.iterdir() if p.suffix in READABLE)
    return [source]


def _delimiter(header: str) -> str:
    """Return the most frequent supported delimiter in a header."""
    return max(("\t", ",", " "), key=header.count)


def _text_rows(path: Path):
    """Yield column names and rows from a delimited text file."""
    with _open(path) as handle:
        first = handle.readline()
        if not first:
            return
        reader = csv.DictReader(handle, delimiter=_delimiter(first))
        reader.fieldnames = next(csv.reader([first], delimiter=_delimiter(first)))
        yield reader.fieldnames
        yield from reader


def _parquet_rows(path: Path):
    """Yield column names and recognized values from a Parquet file."""
    import polars as pl

    lazy = pl.scan_parquet(path)
    names = lazy.collect_schema().names()
    yield names
    wanted = [name for name in _index(names, COLUMNS).values()]
    frame = lazy.select(wanted).collect(engine="streaming")
    yield from frame.iter_rows(named=True)


def read_variants(path: Path, spell, keep):
    """Yield the in-window variants of one file, however its columns happen to be named."""
    rows = _parquet_rows(path) if path.suffix == ".parquet" else _text_rows(path)
    fieldnames = next(rows, None)
    if fieldnames is None:
        return
    columns = _index(fieldnames, COLUMNS)
    missing = {"position", "p_value"} - set(columns)
    if missing:
        raise SystemExit(
            f"{path} has no {' or '.join(sorted(missing))} column. Looked for "
            + "; ".join(f"{k}: {', '.join(COLUMNS[k])}" for k in sorted(missing))
        )
    # A directory of per-chromosome files names the chromosome in the file name
    default_chrom = spell(path.name.split(".")[0])
    # Convert one-based source positions to the browser's zero-based coordinates
    origin = 0 if columns["position"].strip().lower() in ZERO_BASED else 1

    for number, row in enumerate(rows, start=2):
        chrom = spell(str(row[columns["chrom"]])) if "chrom" in columns else default_chrom
        if chrom is None:
            continue
        position = position_of(row[columns["position"]], path, number) - origin
        if not keep(chrom, position):
            continue
        beta = row.get(columns.get("beta", ""), "")
        p_value = row[columns["p_value"]]
        yield (
            chrom,
            position,
            str(row.get(columns.get("snp_id", ""), "") or "").strip(),
            float(p_value) if p_value not in ("", None) else float("nan"),
            float(beta) if beta not in ("", None, "NA", "NaN") else None,
        )


def membership(spans: dict[str, list[tuple[int, int]]]):
    """A fast test for whether a position falls in any kept span on its chromosome."""
    starts = {chrom: [s for s, _ in v] for chrom, v in spans.items()}
    ends = {chrom: [e for _, e in v] for chrom, v in spans.items()}

    def keep(chrom: str, position: int) -> bool:
        chrom_starts = starts.get(chrom)
        if not chrom_starts:
            return False
        index = bisect_right(chrom_starts, position) - 1
        return index >= 0 and position < ends[chrom][index]

    return keep


def speller(chroms_path: Path):
    """Map whatever a study calls a chromosome onto the spelling the browser stores."""
    known = {chrom_names.normalize(c.name): c.name for c in chrom_names.read_chroms(chroms_path)}
    return lambda name: known.get(chrom_names.normalize(name or ""))


def acquire(source: str, cache_dir: Path, study_id: str) -> tuple[Path, str]:
    if ACCESSION.match(source.strip()):
        url = catalog_url(source.strip())
        cached = cache_dir / f"{study_id}{''.join(Path(url).suffixes[-3:])}"
        if not cached.exists():
            console.detail(f"Downloading GWAS Catalog {source}")
            with progress.bytes_bar(cached.name) as on_bytes:
                download(url, cached, on_bytes)
        return cached, url
    path = Path(source).expanduser()
    if not path.exists():
        raise SystemExit(f"No GWAS payload at {path}")
    return path, ""


# Rows held as tuples before a batch becomes a frame. An unsliced study is tens of millions of
# them, which costs many times over what the table itself does
BATCH = 1_000_000


def variant_frame(study_id: str, source: Path, spell, keep) -> pl.DataFrame:
    """Read one study into a table, a batch at a time."""
    batches, rows = [], []
    # Tens of millions of rows a study, which is minutes with nothing else to report
    with progress.bar(f"reading {study_id}", noun="variants kept") as bar:
        for path in payload_files(source):
            for variant in read_variants(path, spell, keep):
                rows.append((study_id, *variant))
                bar.advance()
                if len(rows) >= BATCH:
                    batches.append(pl.DataFrame(rows, schema=SCHEMA, orient="row"))
                    rows = []
    batches.append(pl.DataFrame(rows, schema=SCHEMA, orient="row"))
    return pl.concat(batches)


def write_studies(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f, STUDIES_HEADER, delimiter="\t", lineterminator="\n", extrasaction="ignore"
        )
        writer.writeheader()
        writer.writerows(rows)


def run(
    gwas_path: Path,
    genes_path: Path,
    chroms_path: Path,
    cache_dir: Path,
    out_dir: Path,
    *,
    flank_min: int,
    flank_max: int,
    whole_genome: bool,
) -> None:
    from .curation import read_browser_gwas

    studies = read_browser_gwas(gwas_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    if not studies:
        console.detail(f"No GWAS studies named in {gwas_path}")
        write_studies(out_dir / "gwas_studies.tsv", [])
        pl.DataFrame(schema=SCHEMA).write_parquet(out_dir / "gwas.parquet")
        return

    keep = membership(
        windows.spans(
            genes_path,
            chroms_path,
            flank_min=flank_min,
            flank_max=flank_max,
            whole_genome=whole_genome,
        )
    )
    spell = speller(chroms_path)

    frames, records, failed = [], [], []
    for study in studies:
        try:
            source, url = acquire(study.source, cache_dir, study.study_id)
            frame = variant_frame(study.study_id, source, spell, keep)
        except SystemExit:
            raise
        except Exception as error:
            failed.append(f"{study.study_id}: {error}")
            continue

        frames.append(frame)
        records.append(
            {
                "study_id": study.study_id,
                "trait": study.trait,
                "citation": study.citation,
                "source": study.source,
                "assembly": study.assembly,
                "license_spdx": study.license_spdx,
                "url": url,
                "retrieved_date": date.today().isoformat(),
                "n_variants": frame.height,
                "chroms": ",".join(sorted(frame["chrom"].unique().to_list())),
            }
        )
        console.detail(f"{study.study_id}: {count('variant', frame.height)} kept")

    report_missing("GWAS study/GWAS studies", "that could not be read", failed)
    table = pl.concat(frames) if frames else pl.DataFrame(schema=SCHEMA)
    table.write_parquet(out_dir / "gwas.parquet")
    write_studies(out_dir / "gwas_studies.tsv", records)
