// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

const PREDICTION_API = "https://alphafold.ebi.ac.uk/api/prediction"

interface Prediction {
  entryId: string
  bcifUrl: string
}

// AlphaFold rolls its release version into the filename and retires the old one, so the
// current URL is asked for rather than stored
export async function predictedModelUrl(
  accession: string,
  entryId: string,
): Promise<string | null> {
  const res = await fetch(`${PREDICTION_API}/${accession}`)
  if (!res.ok) return null
  const predictions = (await res.json()) as Prediction[]
  return predictions.find((p) => p.entryId === entryId)?.bcifUrl ?? null
}
