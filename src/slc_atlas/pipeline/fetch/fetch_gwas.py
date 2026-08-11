# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Take this family's windows out of each GWAS study the curation file names.

A genome-wide study runs to hundreds of megabytes and the browser only ever draws the few
percent of it that lies around the family's genes, so only that is kept. What comes out is
one table of variants, and it is small enough to serve a gene at a time as plain JSON.

A study named by its GWAS Catalog accession is downloaded in its harmonised form, whose
columns are already named the same way for every study. A study given as a path is read
where it lies, under whichever of the usual column names it happens to use.
"""

import csv
import gzip
import re
import sys
from bisect import bisect_right
from datetime import date
from pathlib import Path
from urllib.request import urlopen

import polars as pl

from ..lib import chroms as chrom_names, windows
from ..lib.http import download
from ..lib.reporting import count, report_missing

CATALOG = "https://ftp.ebi.ac.uk/pub/databases/gwas/summary_statistics"
ACCESSION = re.compile(r"^GCST\d+$")
HARMONISED = re.compile(r'href="([^"]+\.h\.tsv\.gz)"')

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

# The names the same four things go by across the formats a study arrives in
COLUMNS = {
    "chrom": ("chromosome", "chrom", "chr", "hm_chrom", "#chrom"),
    "position": ("base_pair_location", "position", "pos", "bp", "hm_pos", "chromstart"),
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
    listing = f"{CATALOG}/{accession_range(accession)}/{accession}/harmonised/"
    try:
        html = urlopen(listing, timeout=120).read().decode("utf-8", "replace")
    except Exception as error:
        raise SystemExit(f"GWAS Catalog has no harmonised statistics for {accession}: {error}")
    names = sorted(set(HARMONISED.findall(html)))
    if not names:
        raise SystemExit(
            f"GWAS Catalog lists no harmonised file for {accession} at {listing}. "
            f"Download the statistics yourself and give the path instead."
        )
    return listing + names[0]


def position_of(text: str, where: str, line: int) -> int:
    """Read a coordinate, refusing one that has already lost its low digits."""
    value = text.strip()
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
        return sorted(p for p in source.iterdir() if p.suffix in {".tsv", ".txt", ".gz"})
    return [source]


def read_variants(path: Path, spell, keep):
    """Yield the in-window variants of one file, however its columns happen to be named."""
    with _open(path) as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        columns = _index(reader.fieldnames, COLUMNS)
        missing = {"position", "p_value"} - set(columns)
        if missing:
            raise SystemExit(
                f"{path} has no {' or '.join(sorted(missing))} column. Looked for "
                + "; ".join(f"{k}: {', '.join(COLUMNS[k])}" for k in sorted(missing))
            )
        # A directory of per-chromosome files names the chromosome in the file name
        default_chrom = spell(path.name.split(".")[0])

        for number, row in enumerate(reader, start=2):
            chrom = spell(row[columns["chrom"]]) if "chrom" in columns else default_chrom
            if chrom is None:
                continue
            position = position_of(row[columns["position"]], path, number)
            if not keep(chrom, position):
                continue
            beta = row.get(columns.get("beta", ""), "")
            yield (
                chrom,
                position,
                (row.get(columns.get("snp_id", ""), "") or "").strip(),
                float(row[columns["p_value"]] or "nan"),
                float(beta) if beta not in ("", None, "NA", "NaN") else None,
            )


def membership(spans: dict[str, list[tuple[int, int]]]):
    """A fast test for whether a position falls in any window on its chromosome."""
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
    known = {chrom_names.normalise(c.name): c.name for c in chrom_names.read_chroms(chroms_path)}
    return lambda name: known.get(chrom_names.normalise(name or ""))


def acquire(source: str, cache_dir: Path, study_id: str) -> tuple[Path, str]:
    if ACCESSION.match(source.strip()):
        url = catalog_url(source.strip())
        cached = cache_dir / f"{study_id}{''.join(Path(url).suffixes[-3:])}"
        if not cached.exists():
            print(f"Downloading GWAS Catalog {source}", file=sys.stderr)
            download(url, cached)
        return cached, url
    path = Path(source).expanduser()
    if not path.exists():
        raise SystemExit(f"No GWAS payload at {path}")
    return path, ""


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
) -> None:
    from .curation import read_browser_gwas

    studies = read_browser_gwas(gwas_path)
    out_dir.mkdir(parents=True, exist_ok=True)
    if not studies:
        print(f"No GWAS studies named in {gwas_path}", file=sys.stderr)
        write_studies(out_dir / "gwas_studies.tsv", [])
        pl.DataFrame(schema=SCHEMA).write_parquet(out_dir / "gwas.parquet")
        return

    placed, _ = windows.load(genes_path, chroms_path, flank_min=flank_min, flank_max=flank_max)
    spans = windows.merge(placed)
    keep = membership(spans)
    spell = speller(chroms_path)

    frames, records, failed = [], [], []
    for study in studies:
        try:
            source, url = acquire(study.source, cache_dir, study.study_id)
            rows = [
                (study.study_id, *variant)
                for path in payload_files(source)
                for variant in read_variants(path, spell, keep)
            ]
        except SystemExit:
            raise
        except Exception as error:
            failed.append(f"{study.study_id}: {error}")
            continue

        frame = pl.DataFrame(rows, schema=SCHEMA, orient="row")
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
        print(
            f"{study.study_id}: {count('variant', frame.height)} in this family's windows",
            file=sys.stderr,
        )

    report_missing("GWAS study", "that could not be read", failed)
    table = pl.concat(frames) if frames else pl.DataFrame(schema=SCHEMA)
    table.write_parquet(out_dir / "gwas.parquet")
    write_studies(out_dir / "gwas_studies.tsv", records)
