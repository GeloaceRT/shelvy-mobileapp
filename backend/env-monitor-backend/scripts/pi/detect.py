#!/usr/bin/env python3
"""
Pi-side mold detection on the RTSP stream.
- Reads RTSP (from libcamera-vid) via OpenCV.
- Runs ONNX (YOLOv8-style) with onnxruntime.
- Samples every Nth frame to save CPU.
- Posts alerts to backend when "moldy" detected.

Prereqs (on Pi):
  sudo apt-get install -y python3-pip python3-opencv ffmpeg
  pip3 install onnxruntime numpy requests
  # (optional) pip3 install opencv-python-headless

Adjust CONFIG below to your IPs, model path, and thresholds.
"""

import io
import json
import time
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np
import onnxruntime as ort
import requests

# ------------------ CONFIG ------------------
RTSP_URL = "rtsp://127.0.0.1:8554"  # local RTSP from libcamera-vid
# Use the provided Test-3.onnx at repo root by default; adjust if you copy elsewhere on the Pi.
MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "Test-3.onnx"
CLASS_NAMES = ["fresh", "moldy"]
CONF_THRESH = 0.25
IOU_THRESH = 0.45
SAMPLE_EVERY_N_FRAMES = 5            # run inference every N frames to save CPU
MAX_BOXES = 100
BACKEND_ALERT_URL = "http://192.168.1.9:4000/api/mold-alerts"  # adjust
DEVICE_ID = "pi-cam-1"

MODEL_INPUT_SIZE = (640, 640)        # adjust if your model expects a different size
# --------------------------------------------


def preprocess(frame_bgr: np.ndarray, size: Tuple[int, int]) -> np.ndarray:
    """Resize, BGR->RGB, normalize to 0-1, CHW, float32."""
    h, w = size
    img = cv2.resize(frame_bgr, (w, h), interpolation=cv2.INTER_LINEAR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    img = np.transpose(img, (2, 0, 1))  # HWC -> CHW
    return np.expand_dims(img, axis=0)


def xywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    """Convert [cx, cy, w, h] -> [x1, y1, x2, y2]."""
    x1 = boxes[:, 0] - boxes[:, 2] / 2
    y1 = boxes[:, 1] - boxes[:, 3] / 2
    x2 = boxes[:, 0] + boxes[:, 2] / 2
    y2 = boxes[:, 1] + boxes[:, 3] / 2
    return np.stack([x1, y1, x2, y2], axis=1)


def nms(boxes: np.ndarray, scores: np.ndarray, iou_thresh: float, max_boxes: int) -> List[int]:
    """Basic NMS, returns indices to keep."""
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0 and len(keep) < max_boxes:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-6)
        inds = np.where(iou <= iou_thresh)[0]
        order = order[inds + 1]
    return keep


def postprocess(output: np.ndarray, conf_thresh: float, iou_thresh: float, max_boxes: int):
    """
    YOLOv8-style output: (1, 84, num_boxes). First 4 rows are cx,cy,w,h; rest are class scores.
    Returns boxes (xyxy), scores, class_ids.
    """
    if output.ndim != 3 or output.shape[1] < 5:
        return [], [], []
    _, rows, num = output.shape
    box_data = output[0, 0:4, :].T  # (num, 4)
    class_data = output[0, 4:, :].T  # (num, num_classes)
    scores = class_data.max(axis=1)
    class_ids = class_data.argmax(axis=1)

    mask = scores >= conf_thresh
    if not np.any(mask):
        return [], [], []

    box_data = box_data[mask]
    scores = scores[mask]
    class_ids = class_ids[mask]

    boxes_xyxy = xywh_to_xyxy(box_data)
    keep = nms(boxes_xyxy, scores, iou_thresh, max_boxes)

    return boxes_xyxy[keep], scores[keep], class_ids[keep]


def encode_jpeg(frame_bgr: np.ndarray, quality: int = 85) -> bytes:
    ok, buf = cv2.imencode(".jpg", frame_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    return buf.tobytes() if ok else b""


def send_alert(alert_url: str, device_id: str, boxes, scores, class_ids, thumb: bytes):
    ts = int(time.time() * 1000)
    payload = {
        "deviceId": device_id,
        "ts": ts,
        "detections": [
            {
                "class": int(c),
                "label": CLASS_NAMES[int(c)] if int(c) < len(CLASS_NAMES) else str(int(c)),
                "score": float(s),
                "box": [float(x) for x in b],
            }
            for b, s, c in zip(boxes, scores, class_ids)
        ],
    }
    files = {"thumb": (f"thumb-{ts}.jpg", thumb, "image/jpeg")} if thumb else None
    try:
        resp = requests.post(alert_url, data={"payload": json.dumps(payload)}, files=files, timeout=3)
        if resp.status_code >= 300:
            print(f"Alert post failed: {resp.status_code} {resp.text}")
    except Exception as exc:
        print(f"Alert post error: {exc}")


def main():
    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = 2
    sess_opts.inter_op_num_threads = 2
    session = ort.InferenceSession(str(MODEL_PATH), sess_opts, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    cap = None
    frame_idx = 0
    last_ok = time.time()

    while True:
        if cap is None or not cap.isOpened():
            print("Opening RTSP...", RTSP_URL)
            cap = cv2.VideoCapture(RTSP_URL)
            if not cap.isOpened():
                print("Failed to open RTSP. Retrying in 2s...")
                time.sleep(2)
                continue

        ok, frame = cap.read()
        if not ok or frame is None:
            print("Frame read failed, reopening...")
            cap.release()
            cap = None
            time.sleep(0.5)
            continue

        frame_idx += 1
        if frame_idx % SAMPLE_EVERY_N_FRAMES != 0:
            continue

        inp = preprocess(frame, MODEL_INPUT_SIZE)
        try:
            outputs = session.run(None, {input_name: inp})
            output = outputs[0]
            boxes, scores, class_ids = postprocess(output, CONF_THRESH, IOU_THRESH, MAX_BOXES)
        except Exception as exc:
            print(f"Inference error: {exc}")
            continue

        if len(boxes) == 0:
            continue

        # If any moldy detected, send alert with thumbnail
        mold_mask = class_ids == 1  # class index 1 -> moldy (adjust if different)
        if np.any(mold_mask):
            thumb = encode_jpeg(frame, quality=80)
            send_alert(BACKEND_ALERT_URL, DEVICE_ID, boxes[mold_mask], scores[mold_mask], class_ids[mold_mask], thumb)
            print(f"Mold detected: {len(boxes[mold_mask])} boxes, top score {scores[mold_mask].max():.2f}")

        last_ok = time.time()

        # Keep a small sleep to avoid busy loop if RTSP is very fast
        time.sleep(0.01)


if __name__ == "__main__":
    main()
