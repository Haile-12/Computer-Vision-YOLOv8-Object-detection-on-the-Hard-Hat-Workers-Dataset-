from ultralytics import YOLO
import os

MODEL_PATH = "models/best.pt"

#MODEL_PATH = "yolov8n.pt"

yolo_model = YOLO(MODEL_PATH)
