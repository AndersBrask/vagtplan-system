from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.endpoints import router as api_router

app = FastAPI(title="Vagtplan System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # stram evt. op senere
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": "Vagtplan backend kører"}
