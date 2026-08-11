# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Read and write transcript models in GTF, GFF3, and BED formats.

The browser's bottom track draws exons, introns, and the coding part of each transcript, so
a gene model must retain exon blocks rather than a single span. GTF and GFF3 store a
transcript across multiple exon and CDS rows. The pipeline therefore normalizes them to
BED, which stores each transcript on one line.

BED12 provides only one free-text name field. The pipeline appends three columns for the
gene ID, biotype, and gene name. Genome browsers ignore these extra columns and can still
open and label the file correctly.

Coordinates here are 0-based and half-open throughout, which is BED's own convention and
the convention used by every other browser file.
"""

import gzip
import re
from dataclasses import dataclass
from pathlib import Path

# Separator used when a BED name field contains the full transcript identity
NAME_SEPARATOR = "___"

# Columns appended to BED12 records
EXTRA_COLUMNS = ("gene_id", "biotype", "gene_name")

GTF_ATTR = re.compile(r'(\S+)\s+"([^"]*)"')

BIOTYPE_KEYS = ("transcript_type", "transcript_biotype", "gene_type", "gene_biotype", "biotype")
NAME_KEYS = ("gene_name", "Name", "gene")


@dataclass(frozen=True)
class Transcript:
    chrom: str
    start: int
    end: int
    transcript_id: str
    gene_id: str
    biotype: str
    gene_name: str
    strand: str
    cds_start: int | None
    cds_end: int | None
    exons: tuple[tuple[int, int], ...]


def _open(path: Path):
    if str(path).endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8")
    return open(path, encoding="utf-8")


def _gtf_attrs(text: str) -> dict[str, str]:
    return dict(GTF_ATTR.findall(text))


def _gff3_attrs(text: str) -> dict[str, str]:
    attrs = {}
    for field in text.split(";"):
        key, sep, value = field.strip().partition("=")
        if sep:
            attrs[key] = value.partition(":")[2] or value
    return attrs


def _pick(attrs: dict[str, str], keys, default: str = "") -> str:
    for key in keys:
        if attrs.get(key):
            return attrs[key]
    return default


def _assemble(rows) -> list[Transcript]:
    """Fold exon and CDS rows into one record per transcript."""
    exons: dict[str, list[tuple[int, int]]] = {}
    coding: dict[str, list[int]] = {}
    meta: dict[str, tuple] = {}

    for chrom, feature, start, end, strand, attrs in rows:
        transcript_id = attrs.get("transcript_id")
        if not transcript_id:
            continue
        if feature == "exon":
            exons.setdefault(transcript_id, []).append((start, end))
            meta.setdefault(
                transcript_id,
                (
                    chrom,
                    strand,
                    attrs.get("gene_id", ""),
                    _pick(attrs, BIOTYPE_KEYS),
                    _pick(attrs, NAME_KEYS, attrs.get("gene_id", "")),
                ),
            )
        elif feature == "CDS":
            span = coding.setdefault(transcript_id, [start, end])
            span[0] = min(span[0], start)
            span[1] = max(span[1], end)

    out = []
    for transcript_id, blocks in exons.items():
        chrom, strand, gene_id, biotype, gene_name = meta[transcript_id]
        blocks.sort()
        cds = coding.get(transcript_id)
        out.append(
            Transcript(
                chrom=chrom,
                start=blocks[0][0],
                end=blocks[-1][1],
                transcript_id=transcript_id,
                gene_id=gene_id,
                biotype=biotype,
                gene_name=gene_name,
                strand=strand,
                cds_start=cds[0] if cds else None,
                cds_end=cds[1] if cds else None,
                exons=tuple(blocks),
            )
        )
    out.sort(key=lambda t: (t.chrom, t.start, t.end, t.transcript_id))
    return out


def _feature_rows(path: Path, attrs_of, keep):
    with _open(path) as f:
        for line in f:
            if line.startswith("#"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 9 or parts[2] not in keep:
                continue
            yield parts[0], parts[2], int(parts[3]) - 1, int(parts[4]), parts[6], attrs_of(parts[8])


def from_gtf(path: Path) -> list[Transcript]:
    return _assemble(_feature_rows(path, _gtf_attrs, {"exon", "CDS"}))


def from_gff3(path: Path) -> list[Transcript]:
    """Read an Ensembl-style GFF3, where a child names its transcript through Parent."""

    def attrs_of(text: str) -> dict[str, str]:
        attrs = _gff3_attrs(text)
        parent = attrs.get("Parent", "")
        return {**attrs, "transcript_id": parent, "gene_id": attrs.get("gene_id", "")}

    return _assemble(_feature_rows(path, attrs_of, {"exon", "CDS"}))


def _identify(name: str, extra: list[str]) -> tuple[str, str, str, str]:
    """Read the transcript ID, gene ID, biotype, and gene name from a BED row.

    This pipeline writes extra columns, some pipelines pack all four values into the name
    field, and files converted directly from GTF with genePredToBed contain only the
    transcript ID.
    """
    if NAME_SEPARATOR in name:
        packed = name.split(NAME_SEPARATOR) + [""] * 4
        return packed[0], packed[1], packed[2], packed[3] or packed[1]
    gene_id, biotype, gene_name = (extra + ["", "", ""])[:3]
    return name, gene_id, biotype, gene_name or gene_id


def read_bed12(path: Path) -> list[Transcript]:
    out = []
    with _open(path) as f:
        for line in f:
            if line.startswith(("#", "track", "browser")):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 12:
                continue
            chrom, start, end, name = parts[0], int(parts[1]), int(parts[2]), parts[3]
            strand = parts[5]
            thick_start, thick_end = int(parts[6]), int(parts[7])
            sizes = [int(v) for v in parts[10].rstrip(",").split(",") if v]
            starts = [int(v) for v in parts[11].rstrip(",").split(",") if v]
            transcript_id, gene_id, biotype, gene_name = _identify(name, parts[12:])
            coding = thick_start != thick_end
            out.append(
                Transcript(
                    chrom=chrom,
                    start=start,
                    end=end,
                    transcript_id=transcript_id,
                    gene_id=gene_id,
                    biotype=biotype,
                    gene_name=gene_name,
                    strand=strand,
                    cds_start=thick_start if coding else None,
                    cds_end=thick_end if coding else None,
                    exons=tuple(
                        (start + offset, start + offset + size)
                        for offset, size in zip(starts, sizes)
                    ),
                )
            )
    return out


def read(path: Path) -> list[Transcript]:
    """Read whichever of the three formats this file is, going by its name."""
    name = str(path).lower().removesuffix(".gz")
    if name.endswith((".gtf", ".gff2")):
        return from_gtf(path)
    if name.endswith((".gff3", ".gff")):
        return from_gff3(path)
    if name.endswith((".bed", ".bed12")):
        return read_bed12(path)
    raise SystemExit(
        f"Cannot tell what format {path} is. Name it .bed, .gtf, or .gff3 (optionally .gz)."
    )


def write_bed12(path: Path, transcripts) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        for t in transcripts:
            # A transcript with no CDS marks it the way BED does, by giving thick no width
            thick_start = t.cds_start if t.cds_start is not None else t.end
            thick_end = t.cds_end if t.cds_end is not None else t.end
            f.write(
                "\t".join(
                    (
                        t.chrom,
                        str(t.start),
                        str(t.end),
                        t.transcript_id,
                        "0",
                        t.strand,
                        str(thick_start),
                        str(thick_end),
                        "0",
                        str(len(t.exons)),
                        ",".join(str(end - start) for start, end in t.exons) + ",",
                        ",".join(str(start - t.start) for start, _ in t.exons) + ",",
                        t.gene_id,
                        t.biotype,
                        t.gene_name,
                    )
                )
                + "\n"
            )


def versionless(identifier: str) -> str:
    """Ensembl ids carry a version that the gene tables do not, and joins need them bare."""
    return identifier.partition(".")[0]


def version_of(identifier: str) -> str:
    return identifier.partition(".")[2]
