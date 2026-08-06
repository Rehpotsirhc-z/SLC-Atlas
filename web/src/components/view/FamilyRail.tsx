// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import { Drawer } from "@mui/material"
import FamilyTree from "@/components/familyTree/FamilyTree"
import type { Gene } from "@/types/gene"
import FamilyRailSplitter from "./FamilyRailSplitter"
import { useDrawerWarmup } from "./useDrawerWarmup"
import { RAIL_DRAWER_WIDTH } from "./useFamilyRail"

interface Props {
  genes: Gene[]
  familyFilter: string | null
  onSelectFamily: (family: string | null) => void
  railWidth: number
  useDrawer: boolean
  drawerOpen: boolean
  onDrawerClose: () => void
  onDragStart: (e: React.MouseEvent) => void
}

export default function FamilyRail({
  genes,
  familyFilter,
  onSelectFamily,
  railWidth,
  useDrawer,
  drawerOpen,
  onDrawerClose,
  onDragStart,
}: Props) {
  const treeMounted = useDrawerWarmup({
    active: useDrawer,
    open: drawerOpen,
    ready: genes.length > 0,
  })

  if (useDrawer) {
    return (
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={onDrawerClose}
        ModalProps={{ keepMounted: treeMounted }}
      >
        <FamilyTree
          genes={genes}
          familyFilter={familyFilter}
          onSelectFamily={onSelectFamily}
          onClose={onDrawerClose}
          width={RAIL_DRAWER_WIDTH}
        />
      </Drawer>
    )
  }

  return (
    <>
      <FamilyTree
        genes={genes}
        familyFilter={familyFilter}
        onSelectFamily={onSelectFamily}
        width={railWidth}
      />
      <FamilyRailSplitter onDragStart={onDragStart} />
    </>
  )
}
