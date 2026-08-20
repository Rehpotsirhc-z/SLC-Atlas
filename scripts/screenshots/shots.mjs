// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { awaitMolstar, scrollLanesToBottom } from "./drivers.mjs"

export const VIEWS = ["genes", "clustering", "conservation", "browser", "expression", "structure"]

export function buildShots(gene) {
  const g = gene ? { gene } : {}
  const shots = [
    { view: "genes", route: "/genes", params: { ...g } },
    {
      view: "clustering",
      sub: "rectangular",
      route: "/clustering",
      params: { ...g, layout: "rectangular" },
    },
    { view: "clustering", sub: "radial", route: "/clustering", params: { ...g, layout: "radial" } },
    { view: "conservation", route: "/conservation", params: { ...g } },
  ]

  if (gene) {
    shots.push(
      {
        view: "browser",
        sub: "transcripts",
        route: "/browser",
        params: { ...g, mode: "transcripts" },
      },
      { view: "browser", sub: "genes", route: "/browser", params: { ...g, mode: "genes" } },
      {
        view: "browser",
        sub: "gwas",
        route: "/browser",
        params: { ...g, mode: "genes", gwas: "1" },
        post: scrollLanesToBottom,
      },
    )
  }

  shots.push(
    { view: "expression", sub: "female", route: "/expression", params: { ...g }, sex: "female" },
    { view: "expression", sub: "male", route: "/expression", params: { ...g }, sex: "male" },
    {
      view: "expression",
      sub: "brain",
      route: "/expression",
      params: { ...g, tissue: "brain" },
      sex: "female",
    },
  )

  if (gene) {
    shots.push(
      {
        view: "structure",
        sub: "regions",
        route: "/structure",
        params: { ...g, topo: "regions" },
        post: awaitMolstar,
      },
      {
        view: "structure",
        sub: "residues",
        route: "/structure",
        params: { ...g, topo: "residues" },
        post: awaitMolstar,
      },
    )
  } else {
    shots.push({ view: "structure", sub: "wall", route: "/structure", params: { ...g } })
  }

  return shots
}

export const fileStem = (shot, size, theme) =>
  `${shot.view}${shot.sub ? `-${shot.sub}` : ""}_${size}_${theme}`
