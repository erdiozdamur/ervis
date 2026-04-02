from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Ervis Placeholder Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {"status": "ok", "service": "placeholder-backend"}


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}
