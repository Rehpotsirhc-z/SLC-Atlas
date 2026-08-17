# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Fetch the transcript models the browser draws along the bottom of the view.

The gene tables carry one span per gene, which is enough to place a gene on an axis but not
to draw it. This step gets the exons, the introns between them, and the coding part of each
transcript, for every transcript in whatever stretch of genome the browser keeps, not only
the family's own genes: a gene is read in the company of its neighbors, and unsliced that
company is every gene there is.

GENCODE is the default because it is the same annotation Ensembl serves, so the models line
up with the coordinates the gene tables already hold. Any GTF, GFF3, or BED12 can be used
in its place.

The chromosome table is written here too, because whichever annotation is used decides how
the whole browser spells a chromosome.
"""

from datetime import date
from pathlib import Path

from ..lib import bed12, chroms, console, progress, windows
from ..lib.http import download, get_json
from ..lib.reporting import count, report_missing

GENCODE_BASE = "https://ftp.ebi.ac.uk/pub/databases/gencode/Gencode_human"
ENSEMBL_ASSEMBLY = (
    "https://rest.ensembl.org/info/assembly/homo_sapiens?content-type=application/json"
)

# GENCODE names its human releases 66 behind the Ensembl release they are merged from, and
# has done since Ensembl 88. Older pairings were irregular, so --gencode-release overrides
GENCODE_BEHIND_ENSEMBL = 66

LICENSE = "CC-BY-4.0"


def gencode_release(ensembl_release: int, override: str) -> str:
    return override or str(ensembl_release - GENCODE_BEHIND_ENSEMBL)


def gencode_url(release: str) -> str:
    return f"{GENCODE_BASE}/release_{release}/gencode.v{release}.annotation.gtf.gz"


def assembly() -> tuple[str, dict[str, int]]:
    """The assembly the genes were placed on, and how long each of its regions is."""
    info = get_json(ENSEMBL_ASSEMBLY)
    regions = {r["name"]: int(r["length"]) for r in info.get("top_level_region", [])}
    return info.get("assembly_name", ""), regions


def annotation_chroms(regions: dict[str, int], spellings) -> list[chroms.Chrom]:
    """Name every assembly region the way the annotation names it, and say what it is."""
    mapping, _ = chroms.alias_map(spellings, regions)
    table = [
        chroms.Chrom(mapping.get(name, name), length, chroms.role(name))
        for name, length in regions.items()
    ]
    table.sort(key=lambda c: (c.role != chroms.PRIMARY, -c.size))
    return table


def acquire(models_file: Path | None, cache_dir: Path, release: str) -> tuple[Path, str, str]:
    """Get the annotation, from wherever it comes from, and say what it turned out to be."""
    if models_file is not None:
        if not models_file.exists():
            raise SystemExit(f"No gene model file at {models_file}")
        return models_file, models_file.name, ""
    url = gencode_url(release)
    cached = cache_dir / f"gencode.v{release}.annotation.gtf.gz"
    if not cached.exists():
        console.detail(f"Downloading GENCODE release {release}")
        with progress.bytes_bar(cached.name) as on_bytes:
            download(url, cached, on_bytes)
    return cached, f"GENCODE {release}", url


def overlapping(transcripts, merged: dict[str, list[tuple[int, int]]]) -> list:
    """Keep the transcripts that fall in a kept span, on a chromosome the browser draws."""
    kept = []
    for transcript in transcripts:
        spans = merged.get(transcript.chrom)
        if not spans or chroms.role(transcript.chrom) != chroms.PRIMARY:
            continue
        for start, end in spans:
            if transcript.start < end and start < transcript.end:
                kept.append(transcript)
                break
    return kept


def write_provenance(path: Path, *, version: str, url: str, assembly_name: str, flank: str) -> None:
    header = "source\tkind\tversion\tassembly\tretrieved_date\tlicense_spdx\turl\tdetail"
    row = "\t".join(
        (
            version,
            "gene_models",
            version,
            assembly_name,
            date.today().isoformat(),
            LICENSE if url else "",
            url,
            flank,
        )
    )
    path.write_text(f"{header}\n{row}\n", encoding="utf-8")


def run(
    genes_path: Path,
    cache_dir: Path,
    out_dir: Path,
    *,
    ensembl_release: int,
    gencode_override: str,
    models_file: Path | None,
    flank_min: int,
    flank_max: int,
    whole_genome: bool,
) -> None:
    release = gencode_release(ensembl_release, gencode_override)
    source_path, version, url = acquire(models_file, cache_dir, release)

    transcripts = bed12.read(source_path)
    if not transcripts:
        raise SystemExit(f"{source_path} holds no transcripts with exons")

    assembly_name, regions = assembly()
    spellings = {t.chrom for t in transcripts}
    table = annotation_chroms(regions, spellings)

    out_dir.mkdir(parents=True, exist_ok=True)
    chroms_path = out_dir / "chroms.tsv"
    chroms.write_chroms(chroms_path, table)

    _, unplaced = windows.load(genes_path, chroms_path, flank_min=flank_min, flank_max=flank_max)
    report_missing("gene", "the annotation places on no chromosome the browser draws", unplaced)
    kept_spans = windows.spans(
        genes_path,
        chroms_path,
        flank_min=flank_min,
        flank_max=flank_max,
        whole_genome=whole_genome,
    )
    kept = overlapping(transcripts, kept_spans)

    bed12.write_bed12(out_dir / "transcripts.bed", kept)
    write_provenance(
        out_dir / "gene_models.tsv",
        version=version,
        url=url,
        assembly_name=assembly_name,
        # An unsliced fetch answers any flank a build asks for, so it names no pair
        flank="genome" if whole_genome else f"{flank_min}-{flank_max}",
    )

    genes_in_view = len({t.gene_id for t in kept})
    console.detail(
        f"{version}: {count('transcript', len(kept))} over {count('gene', genes_in_view)} "
        f"in {count('span', sum(len(v) for v in kept_spans.values()))} "
        f"covering {windows.covered_bases(kept_spans) / 1e6:.0f} Mb"
    )
