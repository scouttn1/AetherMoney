from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore

# Import our parser
try:
    from parser import BillParser
except ImportError:
    from .parser import BillParser

app = FastAPI(title="AetherMoney API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Firebase Admin Setup
# If serviceAccountKey.json exists, use it. Otherwise, assume local env auth.
cred_path = "serviceAccountKey.json"
if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
else:
    # This might work if logged in via 'gcloud auth application-default login'
    # Fallback to default if possible or provide warning
    try:
        firebase_admin.initialize_app()
    except Exception:
        print("Warning: Firebase Admin not initialized. Please provide serviceAccountKey.json")

# Models
class BillInput(BaseModel):
    raw_text: Optional[str] = None
    source: Optional[str] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    uid: str # We need the user UID to know where to store

class InvestmentInput(BaseModel):
    name: str
    profit_loss: float
    uid: str

@app.post("/api/bills")
async def create_bill(bill: BillInput):
    if not bill.uid:
        raise HTTPException(status_code=400, detail="UID is required for Firestore storage")

    if bill.raw_text:
        parsed = BillParser.parse(bill.raw_text)
        source, amount, desc = parsed["source"], parsed["amount"], parsed["description"]
    else:
        source = bill.source or "Manual"
        amount = bill.amount or 0.0
        desc = bill.description or "Manual Entry"

    try:
        db = firestore.client()
        doc_ref = db.collection("users").document(bill.uid).collection("bills").document()
        doc_ref.set({
            "source": source,
            "amount": amount,
            "description": desc,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        return {"status": "success", "bill_id": doc_ref.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/investments")
async def log_investment(inv: InvestmentInput):
    try:
        db = firestore.client()
        doc_ref = db.collection("users").document(inv.uid).collection("investments").document()
        doc_ref.set({
            "name": inv.name,
            "profit_loss": inv.profit_loss,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
