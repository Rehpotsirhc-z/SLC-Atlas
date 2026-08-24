"""Build portable gene-model and GWAS tracks for browser benchmarks."""

import os
import stat
import subprocess
import urllib.request
from pathlib import Path

import pybigtools

BEDTOBIGBED_URL = "https://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/bedToBigBed"

EXPORT = Path(os.environ.get("EXPORT", "/workspace/.bench-export"))
HERE = Path(__file__).parent
SRC_BED = Path("/workspace/data/source/browser/transcripts.bed")
GWAS_BB = Path("/workspace/data/app/browser/gwas/PD_Nalls.bb")
CHROM_SIZES = HERE / "hg38.chrom.sizes"
BEDTOBIGBED = HERE / "bin" / "bedToBigBed"

MODELS_AS = """table bed12Plus4
"BED12 gene models with atlas metadata"
(
string chrom;               "Chromosome"
uint   chromStart;          "Start"
uint   chromEnd;            "End"
string name;                "Transcript id"
uint   score;               "Score"
char[1] strand;             "Strand"
uint   thickStart;          "CDS start"
uint   thickEnd;            "CDS end"
uint   reserved;            "itemRgb"
int    blockCount;          "Exon count"
int[blockCount] blockSizes; "Exon sizes"
int[blockCount] chromStarts;"Exon starts"
string gene_id;             "Gene id"
string biotype;             "Biotype"
string gene_name;           "Gene name"
string transcript_name;     "Transcript name"
)
"""


def ensure_bedtobigbed():
    """Download the UCSC converter when it is not already available."""
    if BEDTOBIGBED.exists():
        return
    BEDTOBIGBED.parent.mkdir(parents=True, exist_ok=True)
    print(f"  fetching bedToBigBed <- {BEDTOBIGBED_URL}")
    urllib.request.urlretrieve(BEDTOBIGBED_URL, BEDTOBIGBED)
    BEDTOBIGBED.chmod(BEDTOBIGBED.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


def build_models():
    """Build a BED12 bigBed that other genome browsers can interpret."""
    ensure_bedtobigbed()
    out = EXPORT / "models_std.bb"
    sorted_bed = EXPORT / "_transcripts.sorted.bed"
    as_file = EXPORT / "_models.as"
    as_file.write_text(MODELS_AS)
    with open(sorted_bed, "w") as f:
        subprocess.run(["sort", "-k1,1", "-k2,2n", str(SRC_BED)], stdout=f, check=True)
    subprocess.run(
        [
            str(BEDTOBIGBED),
            "-type=bed12+4",
            f"-as={as_file}",
            "-tab",
            str(sorted_bed),
            str(CHROM_SIZES),
            str(out),
        ],
        check=True,
    )
    sorted_bed.unlink()
    as_file.unlink()
    print(f"  models_std.bb <- {SRC_BED.name}")


def build_gwas():
    """Convert the GWAS records to a quantitative bigWig track."""
    out = EXPORT / "gwas_manhattan.bw"
    src = pybigtools.open(str(GWAS_BB))
    sizes = dict(src.chroms())

    def intervals():
        for chrom in src.chroms():
            run_start, run_val = None, float("-inf")
            for rec in src.records(chrom):
                start = rec[0]
                try:
                    v = float(rec[4])
                except (TypeError, ValueError):
                    continue
                if start == run_start:
                    run_val = max(run_val, v)
                    continue
                if run_start is not None:
                    yield chrom, run_start, run_start + 1, run_val
                run_start, run_val = start, v
            if run_start is not None:
                yield chrom, run_start, run_start + 1, run_val

    pybigtools.open(str(out), "w").write(sizes, intervals())
    print(f"  gwas_manhattan.bw <- {GWAS_BB.name}")


if __name__ == "__main__":
    print("building bench render tracks:")
    build_models()
    build_gwas()
    print("done")
