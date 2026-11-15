# orvion-api/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import health, assessment

app = FastAPI(
    title="Orvion API",
    description="API para evaluación de tierras con datos satelitales",
    version="0.1.0"
)

# --- SOLUCIÓN CORS ---
# En desarrollo, permitimos todos los orígenes para evitar problemas con Codespaces
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Sistema"])
app.include_router(assessment.router, tags=["Evaluación"])