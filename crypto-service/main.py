from fastapi import FastAPI
from app.api.routes import router

app = FastAPI(
    title="KAVACH - Cryptographic Microservice",
    description="Mathematical Core for Envelope Encryption and Zero-Memory Hygiene",
    version="2.0.0"
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    # Single-process worker for isolation, scaled horizontally via containers
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
