"""Generate equivalent igv.js and JBrowse configurations."""

import json
import os

EXPORT = os.environ.get("EXPORT", "/workspace/.bench-export")
COV = "/workspace/data/app/browser/coverage"
cov = sorted(f for f in os.listdir(COV) if f.endswith(".bw"))

igv = [{"id": f[:-3], "url": f"/api/browser/coverage/{f}", "type": "wig"} for f in cov]
igv += [
    {"id": "models", "url": "/api/browser/models.bb", "type": "annotation"},
    {"id": "gwas", "url": "/api/browser/gwas/PD_Nalls.bb", "type": "annotation"},
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
        "type": "FeatureTrack",
        "trackId": "models",
        "name": "gene models",
        "assemblyNames": ["hg38"],
        "adapter": {"type": "BigBedAdapter", "bigBedLocation": {"uri": "/api/browser/models.bb"}},
    },
    {
        "type": "FeatureTrack",
        "trackId": "gwas",
        "name": "GWAS",
        "assemblyNames": ["hg38"],
        "adapter": {
            "type": "BigBedAdapter",
            "bigBedLocation": {"uri": "/api/browser/gwas/PD_Nalls.bb"},
        },
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
