// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

export type RailView = "female" | "male" | "brain"

// GTEx tissue map to anatomogram element id
const BODY_MAP: Record<string, string> = {
  "Adipose Tissue": "UBERON_0001013",
  "Adrenal Gland": "UBERON_0002369",
  Bladder: "UBERON_0001255",
  Blood: "UBERON_0000178",
  "Blood Vessel": "UBERON_0001981",
  Brain: "UBERON_0000955",
  Breast: "UBERON_0000310",
  Colon: "UBERON_0001155",
  Esophagus: "UBERON_0001043",
  Heart: "UBERON_0000948",
  Kidney: "UBERON_0002113",
  Liver: "UBERON_0002107",
  Lung: "UBERON_0002048",
  Muscle: "UBERON_0001134",
  Nerve: "UBERON_0001021",
  Pancreas: "UBERON_0001264",
  Pituitary: "UBERON_0000007",
  "Salivary Gland": "UBERON_0001044",
  Skin: "UBERON_0000014",
  "Small Intestine": "UBERON_0002108",
  Spleen: "UBERON_0002106",
  Stomach: "UBERON_0000945",
  Thyroid: "UBERON_0002046",
  // male-only
  Prostate: "UBERON_0002367",
  Testis: "UBERON_0000473",
  // female-only
  "Cervix Uteri": "UBERON_0000002",
  "Fallopian Tube": "UBERON_0003889",
  Ovary: "UBERON_0000992",
  Uterus: "UBERON_0000995",
  Vagina: "UBERON_0000996",
}

// GTEx Brain tissue map to anatomogram named region id
const BRAIN_MAP: Record<string, string> = {
  "Brain - Amygdala": "amygdala",
  "Brain - Anterior cingulate cortex (BA24)": "cingulate_cortex",
  "Brain - Caudate (basal ganglia)": "caudate_nucleus",
  "Brain - Cerebellar Hemisphere": "cerebellar_hemisphere",
  "Brain - Cerebellum": "cerebellum",
  "Brain - Cortex": "cerebral_cortex",
  "Brain - Frontal Cortex (BA9)": "frontal_cortex",
  "Brain - Hippocampus": "hippocampus",
  "Brain - Hypothalamus": "hypothalamus",
  "Brain - Nucleus accumbens (basal ganglia)": "nucleus_accumbens",
  "Brain - Putamen (basal ganglia)": "putamen",
  "Brain - Spinal cord (cervical c-1)": "medulla_oblongata",
  "Brain - Substantia nigra": "substantia_nigra",
}

export function idToTissue(view: RailView): Record<string, string> {
  const src = view === "brain" ? BRAIN_MAP : BODY_MAP
  const out: Record<string, string> = {}
  for (const [tissue, id] of Object.entries(src)) out[id] = tissue
  return out
}
