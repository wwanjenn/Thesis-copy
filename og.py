from fastapi import FastAPI, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from ultralytics import YOLO
import cv2
import numpy as np
import base64
from PIL import Image
import io
import os
from typing import Optional
import json
import picamera2
from picamera2 import Picamera2

app = FastAPI()

# For debugging purposes
print("current:", os.getcwd())

# Mount static files (React build)
app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLO model
model = YOLO("../best5.pt")

# Initialize Pi Camera
picam2 = Picamera2()
preview_config = picam2.create_preview_configuration(main={"size": (640, 360)})
picam2.configure(preview_config)

def process_frame(frame):
    results = model(frame)
    detections = []
    
    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            score = float(box.conf[0])
            label = result.names[class_id] if class_id in result.names else "Unknown"
            
            if score < 0.7:
                continue
                
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            
            # Draw rectangle and label on the frame
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            label_text = f"{label}: {score:.2f}"
            cv2.putText(frame, label_text, (x1, y1 - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            
            detections.append({
                "label": label,
                "confidence": score,
                "bbox": [x1, y1, x2, y2]
            })
    
    return frame, detections

def frame_to_base64(frame):
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

@app.get("/")
async def read_root():
    return FileResponse("../frontend/index.html")

@app.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    location: Optional[str] = None,
    device: Optional[str] = None
):
    # Read and process the uploaded image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return {"error": "Invalid image file"}
    
    # Resize image
    img = cv2.resize(img, (640, 360))
    
    # Process the frame
    processed_frame, detections = process_frame(img)
    
    # Save the processed image
    save_dir = "uploaded_images"
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    
    filename = f"processed_{file.filename}"
    save_path = os.path.join(save_dir, filename)
    cv2.imwrite(save_path, processed_frame)
    
    # Convert processed frame to base64 for frontend display
    base64_image = frame_to_base64(processed_frame)
    
    return {
        "image": base64_image,
        "detections": detections,
        "location": location,
        "device": device,
        "saved_path": save_path
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    picam2.start()
    
    try:
        while True:
            # Capture frame from Pi Camera
            frame = picam2.capture_array()
            
            # Convert from RGB to BGR for OpenCV processing
            frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
            
            # Process the frame
            processed_frame, detections = process_frame(frame)
            
            # Convert to base64
            base64_frame = frame_to_base64(processed_frame)
            
            # Send frame and detections to client
            await websocket.send_text(json.dumps({
                "image": base64_frame,
                "detections": detections
            }))
            
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        picam2.stop()

@app.on_event("shutdown")
async def shutdown_event():
    picam2.stop()
