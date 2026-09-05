"""
Crowd Telemetry Reader Service
==============================
STEP 2C: Reads real YOLO crowd detection & tracking telemetry from pre-processed JSON telemetry logs.

Data Pipeline Architecture:
---------------------------
Demo Mode:
  CCTV Video (cam01_sample_10s.mp4)
    ↓
  YOLO Person Detection + DeepSORT/ByteTrack (crowd_detection.py)
    ↓
  Camera Zone Assignment (crowd_zones.py)
    ↓
  Telemetry JSON Log (data/cam01_telemetry.json)
    ↓
  Crowd Telemetry Service (this file)
    ↓
  FastAPI (/api/crowd-density/{floor_id})
    ↓
  Twin Map Live Crowd Density UI (DigitalTwinMap.tsx)

Future Production Mode:
  Live CCTV RTSP Stream (CAM-01 to CAM-N)
    ↓
  YOLO Edge Inference Pipeline
    ↓
  FastAPI WebSocket / Streaming Telemetry Endpoint
    ↓
  Twin Map Real-Time Heat Layer
"""

import os
import json
import time
import logging
from typing import Dict, Any, Optional, List

logger = logging.getLogger("crowd_telemetry_service")

# Path to pre-generated CAM-01 real YOLO video detection telemetry
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TELEMETRY_PATH = os.path.join(BASE_DIR, "data", "cam01_telemetry.json")

# In-memory telemetry cache
_TELEMETRY_CACHE: Dict[str, Any] = {}
_LAST_LOADED_MTIME: float = 0.0


def load_telemetry_file(file_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Loads and caches the telemetry JSON file.
    Only re-reads disk when file modification time changes.
    """
    global _TELEMETRY_CACHE, _LAST_LOADED_MTIME

    target_path = file_path or DEFAULT_TELEMETRY_PATH
    if not os.path.exists(target_path):
        return None

    try:
        mtime = os.path.getmtime(target_path)
        if _TELEMETRY_CACHE and mtime == _LAST_LOADED_MTIME:
            return _TELEMETRY_CACHE

        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        _TELEMETRY_CACHE = data
        _LAST_LOADED_MTIME = mtime
        logger.info(f"Loaded telemetry JSON from {target_path} (frames: {len(data.get('frames', []))})")
        return _TELEMETRY_CACHE
    except Exception as e:
        logger.warning(f"Failed to read crowd telemetry from {target_path}: {e}")
        return None


def get_latest_camera_telemetry(
    camera_id: str = "CAM-01",
    telemetry_path: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Extracts the latest available frame from the JSON telemetry for a given camera.
    Returns the real YOLO detection and zone-wise counts.
    """
    telemetry_data = load_telemetry_file(telemetry_path)
    if not telemetry_data:
        return None

    metadata = telemetry_data.get("metadata", {})
    summary = telemetry_data.get("summary", {})
    frames = telemetry_data.get("frames", [])

    if not frames:
        return None

    # Pick the latest frame (or index matching current simulation time cycle)
    latest_frame = frames[-1]

    camera_zones = latest_frame.get("zones", {
        "entrance_foyer": 0,
        "main_steps": 0,
        "accessible_ramp": 0,
        "outside_approach": 0
    })

    total_people = latest_frame.get("total_people", sum(camera_zones.values()))

    return {
        "camera_id": metadata.get("camera_id", camera_id),
        "video_source": metadata.get("video_source", "cam01_sample_10s.mp4"),
        "resolution": metadata.get("resolution", "1280x720"),
        "fps": metadata.get("fps", 25.0),
        "frame_index": latest_frame.get("frame_index", len(frames)),
        "timestamp_sec": latest_frame.get("timestamp", 10.0),
        "total_people": total_people,
        "peak_people": summary.get("peak_total_people", total_people),
        "zones": camera_zones,
        "tracked_persons_count": len(latest_frame.get("tracked_persons", [])),
        "tracked_persons": latest_frame.get("tracked_persons", []),
        "generated_at": metadata.get("generated_at", "")
    }


def map_camera_to_floor_zones(
    floor_id: str,
    camera_telemetry: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Maps camera telemetry zones:
      - entrance_foyer
      - main_steps
      - accessible_ramp
      - outside_approach
    to corresponding Twin Map crowd-density zone(s) on Floor E-F0 (Block E Ground).

    Twin Map uses 1600x800 coordinate layout.
    Camera uses 1280x720 CCTV perspective coordinate layout.
    """
    normalized_floor = floor_id.strip().upper()
    if not (normalized_floor.startswith("E") and ("0" in normalized_floor or "F0" in normalized_floor)):
        # Camera CAM-01 specifically monitors Academic Block E Main Entrance (Floor E-F0)
        return None

    cam_zones = camera_telemetry.get("zones", {})
    foyer = cam_zones.get("entrance_foyer", 0)
    steps = cam_zones.get("main_steps", 0)
    ramp = cam_zones.get("accessible_ramp", 0)
    approach = cam_zones.get("outside_approach", 0)

    # Combined entrance count for Block E Main Entrance (cz-e0-entrance)
    entrance_total = foyer + steps + ramp + approach
    if entrance_total == 0:
        entrance_total = camera_telemetry.get("total_people", 0)

    return {
        "target_zone_id": "cz-e0-entrance",
        "target_zone_name": "Main Ground Entrance & Security Port",
        "people_count": entrance_total,
        "camera_subzones": {
            "entrance_foyer": foyer,
            "main_steps": steps,
            "accessible_ramp": ramp,
            "outside_approach": approach
        },
        "description": (
            f"Real-Time YOLO Video Feed (CAM-01): {entrance_total} people tracked across "
            f"Foyer ({foyer}), Steps ({steps}), Ramp ({ramp}), and Approach ({approach})."
        )
    }
