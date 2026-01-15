from ultralytics import YOLO
import os

MODEL_PATH = "models/best.pt"

yolo_model = YOLO(MODEL_PATH)
