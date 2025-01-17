import cv2
from ultralytics import YOLO
import tkinter as tk
from tkinter import Label, Button, Entry, filedialog
from PIL import Image, ImageTk
import numpy as np
import os

# Load YOLO model (on local machine) coconute dataset
model = YOLO("best5.pt")

# Initialize camera variable
cap = None
running = False

# Function to detect hands and render them
def detect_hands(frame):
    results = model(frame)
    
    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0])
            score = float(box.conf[0])
            label = result.names[class_id] if class_id in result.names else "Unknown"

            if score < 0.7:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            label_text = f"{label}: {score:.2f}"
            cv2.putText(frame, label_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

    return frame

def extract_color_features(frame):
    mean_color = cv2.mean(frame)
    return mean_color[:3]  

def update_frame():
    global cap, running
    if running:
        ret, frame = cap.read()
        if not ret:
            return
        
        frame = cv2.resize(frame, (640, 360))
        frame = detect_hands(frame)
        
        # Extract color features
        mean_color = extract_color_features(frame)
        cv2.putText(frame, f"Mean Color: {mean_color}", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(rgb_frame)
        imgtk = ImageTk.PhotoImage(image=img)

        label.imgtk = imgtk
        label.config(image=imgtk)

    label.after(10, update_frame)

def start_camera():
    global cap, running
    cap = cv2.VideoCapture(0)
    running = True
    update_frame()

def stop_camera():
    global cap, running
    running = False
    cap.release()
    cv2.destroyAllWindows()

def save_frame():
  global cap
  if cap is not None:
    ret, frame = cap.read()
    if ret:
      # Detect objects and draw annotations
      results = model(frame)
      for result in results:
        for box in result.boxes:
          class_id = int(box.cls[0])
          score = float(box.conf[0])
          label = result.names[class_id] if class_id in result.names else "Unknown"

          if score < 0.7:
            continue
          x1, y1, x2, y2 = map(int, box.xyxy[0])
          cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
          label_text = f"{label}: {score:.2f}"
          cv2.putText(frame, label_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

      # Save the annotated image
      folder_path = "saved_frames"
      if not os.path.exists(folder_path):
        os.makedirs(folder_path)
      file_path = os.path.join(folder_path, "annotated_frame.png")
      cv2.imwrite(file_path, frame)
      print(f"Annotated frame saved at {file_path}")

def upload_image():
    file_path = filedialog.askopenfilename()
    if file_path:
        frame = cv2.imread(file_path)
        if frame is not None:
            frame = cv2.resize(frame, (640, 360))
            frame = detect_hands(frame)

            # Extract color features
            mean_color = extract_color_features(frame)
            cv2.putText(frame, f"Mean Color: {mean_color}", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Convert image for Tkinter display
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb_frame)
            imgtk = ImageTk.PhotoImage(image=img)

            label.imgtk = imgtk
            label.config(image=imgtk)

            # Save the annotated image
            folder_path = "uploaded_images"
            if not os.path.exists(folder_path):
                os.makedirs(folder_path)
            annotated_file_path = os.path.join(folder_path, "annotated_uploaded_image.png")
            cv2.imwrite(annotated_file_path, frame)
            print(f"Annotated uploaded image saved at {annotated_file_path}")


# Create a simple GUI using Tkinter
root = tk.Tk()
root.title("COCOMAT")

# Create a label widget to display the camera feed
label = Label(root)
label.pack()

# Controls for location and device names
location_label = Label(root, text="Location Name:")
location_label.pack()
location_entry = Entry(root)
location_entry.pack()

device_label = Label(root, text="Device Name:")
device_label.pack()
device_entry = Entry(root)
device_entry.pack()

# Buttons for camera controls
start_button = Button(root, text="Start Camera", command=start_camera)
start_button.pack()

stop_button = Button(root, text="Stop Camera", command=stop_camera)
stop_button.pack()

save_button = Button(root, text="Save Frame", command=save_frame)
save_button.pack()

upload_button = Button(root, text="Upload Coconut Image", command=upload_image)
upload_button.pack()

# Run the Tkinter event loop
root.mainloop()

# Ensure resources are released
if cap is not None:
    cap.release()
cv2.destroyAllWindows()
