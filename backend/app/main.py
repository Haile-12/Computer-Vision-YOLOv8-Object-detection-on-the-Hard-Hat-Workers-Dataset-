import os
import time
import uuid
import io
import base64
import json
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from app.model import yolo_model
from app.utils import load_image
from app.database import (
    init_db, 
    fetch_all_history, 
    fetch_history_item, 
    delete_history_item_db, 
    clear_history_db, 
    insert_history_item,
    HISTORY_DIR
)

app = FastAPI(title="YOLOv8 Detection API")

# Initialize Database and Directories
init_db()

# Mount static for viewing history images
app.mount("/images", StaticFiles(directory=HISTORY_DIR), name="images")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/history")
def get_history():
    rows = fetch_all_history()
    
    history = []
    for row in rows:
        # Convert absolute path or relative path to URL
        filename = os.path.basename(row['image_path'])
        img_url = f"http://localhost:8000/images/{filename}"
        
        history.append({
            "id": row['id'],
            "date": row['date'],
            "duration": row['duration'],
            "imageUrl": img_url, 
            "detections": json.loads(row['detections'])
        })
    return history

@app.delete("/history/{item_id}")
def delete_history_item(item_id: str):
    # Fetch item to get image path
    row = fetch_history_item(item_id)
    
    if row:
        image_path = row['image_path']
        # Delete file if exists
        if image_path and os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                print(f"Error deleting file: {e}")
                
        # Delete from DB
        delete_history_item_db(item_id)
        return {"status": "deleted", "id": item_id}
    
    return JSONResponse(status_code=404, content={"message": "Item not found"})

@app.delete("/history")
def clear_history():
    clear_history_db()
    
    # Delete files
    if os.path.exists(HISTORY_DIR):
        for f in os.listdir(HISTORY_DIR):
            file_path = os.path.join(HISTORY_DIR, f)
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"Error deleting file {f}: {e}")
        
    return {"status": "cleared"}

@app.post("/predict")
async def predict(file: UploadFile = File(...), conf: float = Form(0.25)):
    start_time = time.time()
    
    image_bytes = await file.read()
    image_np = load_image(image_bytes)

    results = yolo_model(image_np, conf=conf)

    # Annotated image
    annotated = results[0].plot()
    annotated_img = Image.fromarray(annotated)

    # Save to disk
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.png"
    save_path = os.path.join(HISTORY_DIR, filename)
    annotated_img.save(save_path, format="PNG")

    # Base64 for immediate response
    img_buffer = io.BytesIO()
    annotated_img.save(img_buffer, format="PNG")
    img_buffer.seek(0)
    img_b64 = base64.b64encode(img_buffer.getvalue()).decode("utf-8")

    # Detections
    detections = []
    if results[0].boxes is not None:
        for box in results[0].boxes:
            detections.append({
                "class_name": yolo_model.names[int(box.cls)],
                "confidence": float(box.conf),
                "bbox": box.xyxy[0].tolist()
            })

    # Save to DB
    duration = (time.time() - start_time) * 1000
    insert_history_item(
        id=file_id,
        date=time.strftime("%Y-%m-%d %H:%M:%S"),
        duration=int(duration),
        image_path=save_path,
        detections=detections
    )

    return {
        "image": img_b64,
        "detections": detections,
        "id": file_id
    }
