// SPDX-FileCopyrightText: 2026 Dong Lab, Yale School of Medicine <https://donglab.org>
//
// SPDX-License-Identifier: Apache-2.0

import React, { forwardRef, useContext, useImperativeHandle, useMemo, useRef } from "react"
import { FixedSizeList, type ListChildComponentProps } from "react-window"

const LISTBOX_PADDING = 2
const MAX_VISIBLE = 8
const ITEM_SIZE = 50
const SM_ITEM_SIZE = 36

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

function makeVirtualListbox(itemSize: number) {
  return forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLElement>>(function VirtualListbox(
    { children, ...other },
    ref,
  ) {
    const outerRef = useRef<HTMLDivElement>(null)
    useImperativeHandle(ref, () => outerRef.current!, [])

    const itemData = useMemo(() => React.Children.toArray(children) as StyledElement[], [children])
    const itemCount = itemData.length
    const height = Math.min(itemCount, MAX_VISIBLE) * itemSize + LISTBOX_PADDING

    return (
      <OuterElementContext.Provider value={other as React.HTMLAttributes<HTMLDivElement>}>
        <FixedSizeList<StyledElement[]>
          itemData={itemData}
          height={height}
          width="100%"
          outerRef={outerRef}
          outerElementType={OuterElementType}
          innerElementType="ul"
          itemSize={itemSize}
          overscanCount={5}
          itemCount={itemCount}
        >
          {Row}
        </FixedSizeList>
      </OuterElementContext.Provider>
    )
  })
}

export const VirtualListbox = makeVirtualListbox(ITEM_SIZE)
export const VirtualListboxSm = makeVirtualListbox(SM_ITEM_SIZE)
