from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import genes, expression, conservation, clustering

app = FastAPI(title="SLC Atlas API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(genes.router, prefix="/api")
app.include_router(expression.router, prefix="/api")
app.include_router(conservation.router, prefix="/api")
app.include_router(clustering.router, prefix="/api")
