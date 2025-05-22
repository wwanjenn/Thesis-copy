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
import pandas as pd
import datetime as dt
import queue

# Try to import picamera2, fallback to None if not available
try:
    from picamera2 import Picamera2
    picamera_available = True
except ImportError:
    picamera_available = False

class Camera:
    def __init__(self):
        self.camera = None
        self.is_running = False

    def start(self):
        if self.is_running:
            print("Camera is already running.")
            return

        if picamera_available:
            self.camera = Picamera2()
            preview_config = self.camera.create_preview_configuration(main={"size": (640, 360)})
            self.camera.configure(preview_config)
            self.camera.start()
        else:
            self.camera = cv2.VideoCapture(0)
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)

        self.is_running = True

    def stop(self):
        if not self.is_running:
            print("Camera is not running.")
            return

        if picamera_available:
            self.camera.stop()
        else:
            self.camera.release()

        self.camera = None
        self.is_running = False

    def capture_frame(self):
        if not self.is_running or self.camera is None:
            raise RuntimeError("Camera is not started or properly initialized.")

        if picamera_available:
            frame = self.camera.capture_array()
            return cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
        else:
            ret, frame = self.camera.read()
            if not ret:
                raise RuntimeError("Failed to capture frame from webcam")
            return frame
        
app = FastAPI()

active_sessions = queue.Queue()

# Directory for storing Excel files
OUT_FOLDER = "output_excels"
TEMP_FOLDER = "temp_excels"
os.makedirs(TEMP_FOLDER, exist_ok=True)
os.makedirs(OUT_FOLDER, exist_ok=True)

# For debugging purposes
print("current:", os.getcwd())
print("Using PiCamera:", picamera_available)

# Mount static files (React build)
app.mount("/assets", StaticFiles(directory="../frontend/src/assets"), name="assets")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLO model
model = YOLO("../disease.pt")
matmodel = YOLO("../nano.pt")

# Initialize camera
camera = Camera()

def process_frame(frame):
    # Process the frame using the disease classification model
    results = model.predict(frame, conf=0.3)  # Use appropriate confidence threshold
    classifications = []

    for result in results:
        # Use `result.probs.top1` for the top class and `result.probs.top1conf` for confidence
        class_id = result.probs.top1  # Top-1 class index
        confidence = result.probs.top1conf  # Confidence score for the top-1 class
        label = result.names[class_id] if class_id in result.names else "Unknown"

        if confidence < 0.3:  # Skip low-confidence predictions
            continue

        classifications.append({
            "label": label,
            "confidence": float(confidence),  # Convert to float for JSON serialization
        })

    return frame, classifications

def process_framed(frame):
    results = matmodel(frame)
    detections = []
    premature = 0
    potential = 0  
    mature = 0

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            score = float(box.conf[0])
            label = result.names[class_id] if class_id in result.names else "Unknown"

            if label == 'Premature':
                premature += 1
            elif label == 'Potential':
                potential += 1 
            elif label == 'Mature':
                mature += 1

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
            
    save_detection_entry(premature, potential, mature)

    return frame, detections, premature, potential, mature


def frame_to_base64(framed):
    _, buffer = cv2.imencode('.jpg', framed)
    return base64.b64encode(buffer).decode('utf-8')

def save_detection_entry(premature, potential, mature):
    try:
        print("[INFO] Saving detection entry...")

        time_stamp = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[DEBUG] Timestamp: {time_stamp}")

        if active_sessions.empty():
            raise RuntimeError("No active session found in queue.")

        start_time = active_sessions.get()
        print(f"[DEBUG] Retrieved start_time: {start_time}")
        active_sessions.put(start_time)

        total = premature + potential + mature
        row = {
            'Timestamp': time_stamp,
            'Premature': premature,
            'Potential': potential,
            'Mature': mature,
            'Total Coconuts': total
        }
        print(f"[DEBUG] Row to save: {row}")

        temp_path = os.path.join(TEMP_FOLDER, f"{start_time}.csv")
        print(f"[DEBUG] CSV Path: {temp_path}")

        if not os.path.exists(temp_path):
            raise FileNotFoundError(f"No active CSV session: {temp_path}")

        df = pd.read_csv(temp_path)
        print(f"[DEBUG] Loaded existing CSV with {len(df)} rows")

        df = pd.concat([df, pd.DataFrame([row])], ignore_index=True)
        df.to_csv(temp_path, index=False)
        print("[INFO] Detection entry saved successfully.")

    except Exception as e:
        print(f"[ERROR] Failed to save detection entry: {e}")

@app.post("/start-counting")
def start_counting_api():
    for file_name in os.listdir(TEMP_FOLDER):
        file_path = os.path.join(TEMP_FOLDER, file_name)
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")
    
    start_time = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    active_sessions.put(start_time)  # Add the start time to the queue for FIFO processing
    df = pd.DataFrame(columns=['Timestamp', 'Image_Name', 'Premature', 'Potential', 'Mature', 'Total Coconuts'])
    temp_path = os.path.join(TEMP_FOLDER, f"{start_time}.csv")
    df.to_csv(temp_path, index=False)
    return {"start_time": start_time}

@app.post("/stop-counting")
def stop_counting_api():
    start_time = active_sessions.get()
    end_time = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    temp_path = os.path.join(TEMP_FOLDER, f"{start_time}.csv")
    df = pd.read_csv(temp_path)
    df_transposed = df.T
    df_transposed.columns = [f'Entry {i+1}' for i in range(df_transposed.shape[1])]
    output_file = f"coconut_data_{start_time}_{end_time}.xlsx"
    output_path = os.path.join(OUT_FOLDER, f"coconut_data_{start_time}_{end_time}.xlsx")
    df_transposed.to_excel(output_path, index=True, header=True)
    os.remove(temp_path)  # Clean up the CSV file after export
    return {"message": "Excel exported", "filename": output_file}

@app.get("/")
async def read_root():
    return FileResponse("../frontend/index.html")

@app.post("/upload/disease")
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
    processed_frame, classifications = process_frame(img)

    # Convert processed frame to base64 for frontend display
    base64_image = frame_to_base64(processed_frame)

    return {
        "image": base64_image,
        "classifications": classifications,
        "location": location,
        "device": device
    }

@app.post("/upload/maturity")
async def upload_image(
    file: UploadFile = File(...),
    location: Optional[str] = None,
    device: Optional[str] = None
):
    #Initialize counts
    premature = 0
    potential = 0
    mature = 0

    # Read and process the uploaded image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {"error": "Invalid image file"}

    # Resize image
    img = cv2.resize(img, (640, 360))

    # Process the frame
    processed_frame, detections, premature, potential, mature = process_framed(img)

    # Convert processed frame to base64 for frontend display
    base64_image = frame_to_base64(processed_frame)

    try:
        for detection in detections:
            label = detection.get('label')
            if label == 'Premature':
                premature += 1
            elif label == 'Potential':
                potential += 1
            elif label == 'Mature':
                mature += 1
        save_detection_entry(premature, potential, mature)
    except Exception as e:
        print(f"Error processing detections: {e}")

    return {
        "image": base64_image,
        "detections": detections,
        "location": location,
        "device": device,
        "counts": {
            "Premature": premature,
            "Potential": potential,
            "Mature": matur
        },
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    camera.start()

    try:
        while True:
            # Capture frame from camera
            frame = camera.capture_frame()

            # Process the frame
            processed_frame, detections, premature, potential, mature = process_framed(frame)

            # Convert to base64
            base64_frame = frame_to_base64(processed_frame)

            # Send frame and detections to client
            await websocket.send_text(json.dumps({
                "image": base64_frame,
                "detections": detections,
                "counts": {
                    "Premature": premature,
                    "Potential": potential,
                    "Mature": mature
                }
            }))

    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        camera.stop()
        await websocket.close()


@app.on_event("shutdown")
async def shutdown_event():
    camera.stop()

