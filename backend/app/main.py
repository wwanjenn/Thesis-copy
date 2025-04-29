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

def frame_to_base64(framed):
    _, buffer = cv2.imencode('.jpg', framed)
    return base64.b64encode(buffer).decode('utf-8')

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

    # Save the processed image
    save_dir = "uploaded_images_disease"
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    filename = f"processed_{file.filename}"
    save_path = os.path.join(save_dir, filename)
    cv2.imwrite(save_path, processed_frame)

    # Convert processed frame to base64 for frontend display
    base64_image = frame_to_base64(processed_frame)

    return {
        "image": base64_image,
        "classifications": classifications,
        "location": location,
        "device": device,
        "saved_path": save_path
    }

@app.post("/upload/maturity")
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
    processed_frame, detections = process_framed(img)

    # Save the processed image
    save_dir = "uploaded_images_maturity"
    if not os.path.exists(save_dir):
        try:
            os.makedirs(save_dir)
            print(f"Directory '{save_dir}' created.")
        except Exception as e:
            return {"error": f"Failed to create directory: {str(e)}"}

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
    camera.start()

    try:
        while True:
            # Capture frame from camera
            frame = camera.capture_frame()

            # Process the frame
            processed_frame, detections = process_framed(frame)

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
        camera.stop()
        await websocket.close()


@app.on_event("shutdown")
async def shutdown_event():
    camera.stop()

