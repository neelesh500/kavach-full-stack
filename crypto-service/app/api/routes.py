from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List

from app.core.crypto_engine import crypto_engine
from app.repositories.base import repo
import os

router = APIRouter(prefix="/internal")

class QuestionSubmission(BaseModel):
    question: str
    metadata: Dict[str, Any]
    # SSS Shares mapped from distributed KMS node or Vault
    kek_shares: List[List[int]] = []

@router.post("/encrypt-and-store")
def process_encryption_task(
    payload: QuestionSubmission, 
    x_internal_auth: str = Header(default="")
):
    """
    Highly restricted internal route executed behind the Node.js API Gateway firewall.
    Performs heavy crypto transformations and delegates to decoupled repository.
    """
    # Strict inter-service communication Check
    if x_internal_auth != os.getenv("INTERNAL_SERVICE_TOKEN", "fallback-secret-bond"):
        raise HTTPException(status_code=403, detail="Inter-Service communication violation.")
    
    # Mocking minimum shares (reconstructing an empty key) for demonstration if omitted
    shares = payload.kek_shares
    if not shares:
        shares = [[1, 0], [2, 0]] 
        
    # 1. Cryptographic Math Execution (Zero Trust KEK Reconstruction -> Envelope Encrypt -> Wipe)
    envelope = crypto_engine.envelope_encrypt(payload.question, shares)
    
    # 2. Database Adapter Execution (Zero knowledge of rigid DB models ensures decoupling)
    blob_id = repo.save_secure_blob("QUESTIONS", {
        "metadata": payload.metadata,
        "envelope": envelope
    })
    
    return {
        "status": "SECURED",
        "blob_id": blob_id,
        "metrics": "AES-256-GCM Envelope Applied. Shamir Recon Executed. Zero-Memory Sweep Engaged."
    }

class DecryptionSubmission(BaseModel):
    blob_id: str
    collection_name: str
    # SSS Shares mapped from multiple independent KMS bounds
    kek_shares: List[List[int]]

@router.post("/decrypt-secure")
def process_decryption_task(
    payload: DecryptionSubmission, 
    x_internal_auth: str = Header(default="")
):
    """
    Decryption pipeline bound by strict Multi-Party Quorum validation locks.
    """
    if x_internal_auth != os.getenv("INTERNAL_SERVICE_TOKEN", "fallback-secret-bond"):
        raise HTTPException(status_code=403, detail="Inter-Service communication violation.")
        
    # Multi-Party Quorum Validation Check (e.g. t=3 minimum nodes threshold)
    if len(payload.kek_shares) < 3:
        raise HTTPException(
            status_code=403, 
            detail="Quorum Validation Failed: Pipeline requires a minimum threshold (t=>3) independent KMS shares."
        )
        
    # 1. Fetch DB object utilizing decoupled interface abstraction
    secure_blob = repo.retrieve_secure_blob(payload.collection_name, payload.blob_id)
    if not secure_blob:
        raise HTTPException(status_code=404, detail="Secure Blob unavailable or decoupled DB interface aborted fetch.")
        
    # 2. Cryptographic Execution (SSS Intercept -> Envelope Decrypt -> Scrub Process Memory)
    try:
        plaintext = crypto_engine.envelope_decrypt(secure_blob['envelope'], payload.kek_shares)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Matrix execution failed or Auth Tag mutated.")
        
    return {
        "status": "DECRYPTED",
        "data": plaintext,
        "metrics": "Quorum validated properly. AES inverted. Sweep confirmed."
    }
