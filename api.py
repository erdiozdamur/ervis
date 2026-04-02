from fastapi import FastAPI

app = FastAPI(title="Ervis Placeholder Backend")


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}
