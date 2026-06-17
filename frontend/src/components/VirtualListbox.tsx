// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import React, { forwardRef, useContext, useImperativeHandle, useMemo, useRef } from "react"
import { FixedSizeList, type ListChildComponentProps } from "react-window"
import { autocompleteClasses, Popper, styled } from "@mui/material"

const LISTBOX_PADDING = 8
const MAX_VISIBLE = 8
const ITEM_SIZE = 50

type StyledElement = React.ReactElement<{ style?: React.CSSProperties }>

function Row({ data, index, style }: ListChildComponentProps<StyledElement[]>) {
  const item = data[index]
  return React.cloneElement(item, {
    style: {
      ...(item.props as { style?: React.CSSProperties }).style,
      ...style,
      top: (style.top as number) + LISTBOX_PADDING,
    },
  })
}

const OuterElementContext = React.createContext<React.HTMLAttributes<HTMLDivElement>>({})

// Spread MUI (context) first, then react-window (props) so react-window overrides on conflicts
const OuterElementType = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function OuterElementType(props, ref) {
    const outerProps = useContext(OuterElementContext)
    return (
      <div ref={ref} {...outerProps} {...props} style={{ ...outerProps.style, ...props.style }} />
    )
  },
)

export const VirtualListbox = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLElement>>(
  function VirtualListbox({ children, ...other }, ref) {
    const outerRef = useRef<HTMLDivElement>(null)
    useImperativeHandle(ref, () => outerRef.current!, [])

    const itemData = useMemo(() => React.Children.toArray(children) as StyledElement[], [children])
    const itemCount = itemData.length
    const height = Math.min(itemCount, MAX_VISIBLE) * ITEM_SIZE + LISTBOX_PADDING

    return (
      <OuterElementContext.Provider value={other as React.HTMLAttributes<HTMLDivElement>}>
        <FixedSizeList<StyledElement[]>
          itemData={itemData}
          height={height}
          width="100%"
          outerRef={outerRef}
          outerElementType={OuterElementType}
          innerElementType="ul"
          itemSize={ITEM_SIZE}
          overscanCount={5}
          itemCount={itemCount}
        >
          {Row}
        </FixedSizeList>
      </OuterElementContext.Provider>
    )
  },
)

export const StyledPopper = styled(Popper)(({ theme }) => ({
  [`& .${autocompleteClasses.paper}`]: {
    backgroundColor: theme.palette.background.default,
  },
  [`& .${autocompleteClasses.listbox}`]: {
    boxSizing: "border-box",
    maxHeight: "none", // react-window controls height; MUI's 40vh cap breaks it
    paddingBottom: 0,
    "& ul": { padding: 0, margin: 0, listStyle: "none" },
  },
  [`& .${autocompleteClasses.option}`]: {
    // renderOption sets inline padding; reset MUI's default to avoid double-padding
    padding: 0,
    minHeight: 0,
    alignItems: "center",
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": { borderBottom: "none" },
    "&:hover": { backgroundColor: theme.palette.action.hover },
    "&.Mui-focused": { backgroundColor: theme.palette.action.hover },
  },
}))
