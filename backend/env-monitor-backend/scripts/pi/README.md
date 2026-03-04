# Pi camera + mold detection quick start

This setup keeps everything on the Pi: capture, stream, and on-Pi inference for mold detection.

## Overview
- Camera capture: `libcamera-vid` produces an RTSP stream on the Pi.
- Streaming for the app: `ffmpeg` converts RTSP to HLS; served via a simple HTTP server.
- Mold detection on the Pi: Python script reads the RTSP stream, runs ONNX (YOLOv8-style) via onnxruntime, and posts alerts to the backend.
- Frontend: plays `http://<pi-ip>:8000/stream.m3u8` (HLS). No heavy model on the phone.

## Install prerequisites on the Pi
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-opencv ffmpeg
pip3 install --upgrade onnxruntime numpy requests
# Optional: use opencv-python-headless to avoid GUI deps
# pip3 install opencv-python-headless
```

## Start camera → RTSP (single source)
```bash
libcamera-vid -t 0 --inline --framerate 15 --width 1280 --height 720 \
  --codec h264 --listen -o tcp://0.0.0.0:8554 &
```
This exposes `rtsp://<pi-ip>:8554`.

## Make HLS for the mobile app
```bash
ffmpeg -rtsp_transport tcp -i rtsp://127.0.0.1:8554 \
  -vf scale=854:480 -c:v libx264 -preset veryfast -tune zerolatency \
  -r 15 -g 30 -b:v 1.2M \
  -f hls -hls_time 2 -hls_list_size 6 -hls_flags delete_segments \
  /var/www/html/stream.m3u8
```
Serve HLS over HTTP (pick a folder you own; `/var/www/html` is an example):
```bash
python3 -m http.server 8000 -d /var/www/html
# App plays: http://<pi-ip>:8000/stream.m3u8
```

## Run mold detection on the Pi
Use the provided script: [detect.py](detect.py)

- Reads RTSP (`rtsp://127.0.0.1:8554`), samples every Nth frame, runs ONNX, posts alerts.
- Expects YOLOv8-style output `[1, 84, num_boxes]` with classes `[fresh, moldy]`.
- Configure model path, thresholds, backend URL inside the script.

Run it:
```bash
python3 detect.py
```

## Notes
- Keep everything on the Pi; backend is only for alerts and optional stream proxying.
- If onnxruntime is slow on Pi 3, consider converting the model to TFLite int8 and adjusting the script accordingly.
- Use lower FPS/resolution if CPU is tight (e.g., 480p@10–12 fps for streaming; 2–4 fps for detection sampling).
