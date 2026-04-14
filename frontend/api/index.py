import os
import json
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from huggingface_hub import InferenceClient
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="HomeEcon API",
    description="Backend for the HomeEcon personal tracking app.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Hugging Face Inference Client
# Using Meta's Llama 3.3 70B Instruct for high quality JSON extraction
hf_token = os.getenv("HF_API_TOKEN")
client = InferenceClient(api_key=hf_token)
MODEL_ID = "meta-llama/Llama-3.1-8B-Instruct"

class AdvisorRequest(BaseModel):
    prompt: str
    transactions: List[dict]
    accounts: List[dict]

class DescriptionItem(BaseModel):
    description: str

class MealIngredientsRequest(BaseModel):
    title: str

class SortShoppingListRequest(BaseModel):
    items: List[str]

class ForecastRequest(BaseModel):
    transactions: List[dict]
    current_balances: List[dict]

class ClassificationRequest(BaseModel):
    items: List[DescriptionItem]

@app.post("/api/v1/ai/classify")
async def classify_transactions(request: ClassificationRequest):
    if not request.items:
        return []
        
    descriptions = [item.description for item in request.items]
    print(f"Classifying {len(descriptions)} items using Hugging Face ({MODEL_ID})...")
    
    prompt = f"""
    Analyze the following bank transaction descriptions and for each one provide:
    1. A clean, short title (the merchant name).
    2. A one-sentence summary of what the transaction likely is.
    3. A category (e.g. Food, Entertainment, Salary, Transport, etc.).
    4. Necessity level (strictly one of: "Need", "Want", "Investment", "Uncategorized").

    Return the result ONLY as a JSON list of objects with these keys: 
    "title", "summary", "category", "necessity".

    Descriptions:
    {json.dumps(descriptions)}
    """
    
    messages = [
        {"role": "system", "content": "You are a specialized financial assistant that returns ONLY raw JSON list output."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=2000,
            temperature=0.1 # Low temperature for consistent JSON
        )
        
        text = completion.choices[0].message.content
        print(f"AI Raw Response: {text}")
        
        # Clean up Markdown if present
        text = text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()
            
        result = json.loads(text)
        print("Successfully parsed AI response.")
        return result
    except Exception as e:
        print(f"AI Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/advisor")
async def get_financial_advice(request: AdvisorRequest):
    print(f"Generating AI advice for prompt: {request.prompt[:50]}...")
    
    system_context = f"""
    You are an expert AI Financial Advisor for HomeEcon. 
    User's Recent Transactions: {json.dumps(request.transactions)}
    User's Wallet Balances: {json.dumps(request.accounts)}

    Provide actionable, highly intelligent advice. Keep it relatively concise but deeply insightful. 
    Use markdown styling. Find patterns if you can. Be encouraging but realistic.
    """
    
    messages = [
        {"role": "system", "content": system_context},
        {"role": "user", "content": request.prompt}
    ]
    
    try:
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=2000,
            temperature=0.7
        )
        
        reply = completion.choices[0].message.content
        return {"reply": reply}
    except Exception as e:
        print(f"Advisor AI Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/ingredients")
async def get_meal_ingredients(request: MealIngredientsRequest):
    print(f"Searching for ingredients for meal: {request.title}...")
    
    prompt = f"""
    Provide a list of common ingredients for the dish "{request.title}".
    Return the result ONLY as a JSON list of strings (ingredient names).
    Keep it clean and standard.
    """
    
    messages = [
        {"role": "system", "content": "You are a culinary expert that returns ONLY raw JSON list output."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=500,
            temperature=0.1
        )
        text = completion.choices[0].message.content.strip()
        if "```" in text:
            text = text.split("```")[1].split("```")[-1].strip()
            if text.startswith("json"): text = text[4:].strip()
        
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"Ingredients AI Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/shopping_list/sort")
async def sort_shopping_list(request: SortShoppingListRequest):
    print(f"Sorting shopping list of {len(request.items)} items...")
    
    prompt = f"""
    Categorize the following grocery items into logical store aisles/categories (e.g. Produce, Meat, Dairy, Pantry, Bakery, Household, etc.).
    Return the result ONLY as a JSON object where keys are category names and values are lists of items.
    
    Items:
    {json.dumps(request.items)}
    """
    
    messages = [
        {"role": "system", "content": "You are a grocery organization assistant that returns ONLY raw JSON object output."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=1000,
            temperature=0.1
        )
        text = completion.choices[0].message.content.strip()
        if "```" in text:
            text = text.split("```")[1].split("```")[-1].strip()
            if text.startswith("json"): text = text[4:].strip()
            
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"Sorting AI Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/forecast")
async def get_financial_forecast(request: ForecastRequest):
    print(f"Generating 30-day forecast based on {len(request.transactions)} transactions...")
    
    total_balance = sum(acc.get('balance', 0) for acc in request.current_balances)
    
    prompt = f"""
    Analyze the user's transaction history and current total balance (€{total_balance}).
    Predict their daily net worth for the NEXT 30 DAYS.
    
    Historical Data (last 60 days):
    {json.dumps(request.transactions[:100])} 

    Rules for Prediction:
    1. Identify recurring payments (Rent, Salary, Subscriptions).
    2. Account for typical daily/weekly spending habits.
    3. Start from the current balance.
    
    Return the result ONLY as a JSON object with these keys:
    "daily_projections": [{{"date": "YYYY-MM-DD", "balance": float}}, ...] (exactly 30 items)
    "insights": [string] (at least 3 actionable financial insights)
    "confidence_score": float (0.0 to 1.0)
    "risk_level": string (Low, Medium, High)
    """
    
    messages = [
        {"role": "system", "content": "You are a world-class financial quantitative analyst that returns ONLY raw JSON output."},
        {"role": "user", "content": prompt}
    ]
    
    try:
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=messages,
            max_tokens=3000,
            temperature=0.1
        )
        text = completion.choices[0].message.content.strip()
        if "```" in text:
            text = text.split("```")[1].split("```")[-1].strip()
            if text.startswith("json"): text = text[4:].strip()
            
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"Forecast AI Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api")
@app.get("/api/")
def read_root():
    return {"message": "Welcome to the HomeEcon API"}
