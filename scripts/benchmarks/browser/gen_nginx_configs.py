"""Generate equivalent igv.js and JBrowse configurations."""

import json
import os

EXPORT = os.environ.get("EXPORT", "/workspace/.bench-export")
COV = "/workspace/data/app/browser/coverage"
cov = sorted(f for f in os.listdir(COV) if f.endswith(".bw"))

igv = [
    {
        "role": "coverage",
        "type": "wig",
        "format": "bigwig",
        "url": f"/api/browser/coverage/{f}",
        "name": f[:-3],
        "height": 40,
        "autoscale": True,
    }
    for f in cov
]
igv += [
    {
        "role": "gwas",
        "type": "wig",
        "format": "bigwig",
        "url": "/gwas_manhattan.bw",
        "name": "GWAS -log10(p)",
        "height": 90,
        "autoscale": True,
        "color": "rgb(90,120,220)",
    },
    {
        "role": "models",
        "type": "annotation",
        "format": "bigbed",
        "url": "/models_std.bb",
        "name": "gene models",
        "height": 120,
        "displayMode": "EXPANDED",
    },
]
json.dump(igv, open(f"{EXPORT}/tracks_full.json", "w"))

tr = [
    {
        "type": "QuantitativeTrack",
        "trackId": "cov_" + f[:-3].replace(".", "_"),
        "name": f[:-3],
        "assemblyNames": ["hg38"],
        "adapter": {
            "type": "BigWigAdapter",
            "bigWigLocation": {"uri": f"/api/browser/coverage/{f}"},
        },
    }
    for f in cov
]
tr += [
    {
        "type": "QuantitativeTrack",
        "trackId": "gwas",
        "name": "GWAS -log10(p)",
        "assemblyNames": ["hg38"],
        "adapter": {"type": "BigWigAdapter", "bigWigLocation": {"uri": "/gwas_manhattan.bw"}},
    },
    {
        "type": "FeatureTrack",
        "trackId": "models",
        "name": "gene models",
        "assemblyNames": ["hg38"],
        "adapter": {"type": "BigBedAdapter", "bigBedLocation": {"uri": "/models_std.bb"}},
    },
]
cfg = {
    "assemblies": [
        {
            "name": "hg38",
            "sequence": {
                "type": "ReferenceSequenceTrack",
                "trackId": "hg38-ref",
                "adapter": {
                    "type": "IndexedFastaAdapter",
                    "fastaLocation": {"uri": "/hg38.min.fa"},
                    "faiLocation": {"uri": "/hg38.min.fa.fai"},
                },
            },
        }
    ],
    "tracks": tr,
}
json.dump(cfg, open(f"{EXPORT}/config_full.json", "w"))
open(f"{EXPORT}/jb_tracks_full.txt", "w").write(",".join(t["trackId"] for t in tr))
print(f"wrote configs for {len(cov)} coverage lanes + models + gwas into {EXPORT}")
