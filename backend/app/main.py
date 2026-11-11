"""FastAPI entry point for the AWS Route53 clone backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import auth, zones, records
from . import models, database

# Create all DB tables on startup
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="AWS Route53 Clone API")

# Allow the Next.js dev server to call the API locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(zones.router)
app.include_router(records.router)
