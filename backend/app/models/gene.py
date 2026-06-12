from pydantic import BaseModel


class Transcript(BaseModel):
    id: str
    gene_id: str
    name: str
    type: str
    start: int
    end: int
    length: int


class Gene(BaseModel):
    id: str
    symbol: str
    name: str
    chromosome: str
    start: int
    end: int
    strand: str
    length: int
    alias: str | None = None
    category: str | None = None
    function_brief: str | None = None
