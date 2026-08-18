# SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
#
# SPDX-License-Identifier: Apache-2.0

"""Write transcript and variant features as indexed bigBed files."""

from pathlib import Path

# Fields after chrom/start/end; keep this order in sync with the browser parsers
TRANSCRIPT_FIELDS = (
    "name",
    "score",
    "strand",
    "thickStart",
    "thickEnd",
    "itemRgb",
    "blockCount",
    "blockSizes",
    "blockStarts",
    "gene_id",
    "transcript_version",
    "biotype",
    "gene_name",
    "is_atlas_gene",
)

VARIANT_FIELDS = ("snp_id", "p_value", "neg_log10_p", "beta")


def transcript_row(model: dict) -> tuple[str, int, int, str]:
    """Return a transcript as BED12 with atlas metadata columns."""
    blocks = model["exons"]
    start = model["start"]
    # BED marks a transcript with no CDS by giving thick no width
    thick_start = model["cds_start"] if model["cds_start"] is not None else model["end"]
    thick_end = model["cds_end"] if model["cds_end"] is not None else model["end"]
    rest = "\t".join(
        (
            model["transcript_id"],
            "0",
            model["strand"] or ".",
            str(thick_start),
            str(thick_end),
            "0",
            str(len(blocks)),
            ",".join(str(b["end"] - b["start"]) for b in blocks) + ",",
            ",".join(str(b["start"] - start) for b in blocks) + ",",
            model["model_gene_id"],
            model["transcript_version"] or "",
            model["biotype"] or "",
            model["gene_name"] or "",
            "1" if model["is_atlas_gene"] else "0",
        )
    )
    return model["chrom"], start, model["end"], rest


def variant_row(chrom: str, position: int, snp_id, p_value, neg_log10_p, beta) -> tuple:
    """Return a variant as a one-base feature."""
    rest = "\t".join(
        (
            snp_id or ".",
            f"{p_value:.6g}",
            "" if neg_log10_p is None else f"{neg_log10_p:.5g}",
            "" if beta is None else f"{beta:.5g}",
        )
    )
    return chrom, position, position + 1, rest


def write(path: Path, chroms: dict[str, int], rows) -> int:
    """Write a bigBed and verify that its first feature can be read back."""
    import pybigtools

    path.parent.mkdir(parents=True, exist_ok=True)
    counted: dict = {"rows": 0, "chroms": set(), "first": None}

    def watched():
        for row in rows:
            counted["rows"] += 1
            counted["chroms"].add(row[0])
            if counted["first"] is None:
                counted["first"] = row
            yield row

    written = path.with_suffix(".partial.bb")
    pybigtools.open(str(written), "w").write(chroms, watched())
    if not written.exists():
        raise RuntimeError(f"{written} was not written")

    read_back = pybigtools.open(str(written))
    missing = sorted(counted["chroms"] - set(read_back.chroms()))
    if missing:
        raise RuntimeError(f"{path} is missing {len(missing)} chromosomes: {missing[:5]}")

    # An empty index can still report chromosomes, so verify one feature when available
    first = counted["first"]
    if first is not None:
        chrom, start, end = first[0], first[1], first[2]
        if not any(True for _ in read_back.records(chrom, start, max(end, start + 1))):
            raise RuntimeError(f"{path} holds no feature where the first one was written")

    written.replace(path)
    return counted["rows"]
