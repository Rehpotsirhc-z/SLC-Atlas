export interface Gene {
  id: string
  symbol: string
  name: string
  chromosome: string
  start: number
  end: number
  strand: "+" | "-"
  length: number
  alias: string | null
  category: string | null
  function_brief: string | null
}

export interface Transcript {
  id: string
  gene_id: string
  name: string
  type: string
  start: number
  end: number
  length: number
}
