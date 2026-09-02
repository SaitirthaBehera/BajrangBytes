"""
Crowd Density Service
=====================
STEP 3: Crowd Density calculation and live telemetry generator.

Architecture:
  [Future YOLO Stream / Current MOCK Stream]
                    ↓
        Crowd Density Service (this module)
                    ↓
          FastAPI /api/crowd-density/{floor_id}
                    ↓
          React Twin Map (Overlay & Popovers)

This service computes:
  - People counts per zone
  - Spatial density (people / m²)
  - Density classification: 'low' | 'moderate' | 'high'
  - Standardized API payload with source attribution ('mock' | 'yolo')
"""

import math
import time
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

try:
    from services.crowd_telemetry_service import get_latest_camera_telemetry, map_camera_to_floor_zones
except ImportError:
    from crowd_telemetry_service import get_latest_camera_telemetry, map_camera_to_floor_zones

# Standard density classification thresholds (people per square meter)
HIGH_DENSITY_THRESHOLD = 0.35
MODERATE_DENSITY_THRESHOLD = 0.18

def calculate_density(people_count: int, zone_area_sqm: float) -> float:
    """
    Calculate spatial density in people per square meter.
    
    :param people_count: Total detected/estimated individuals in zone.
    :param zone_area_sqm: Calibrated physical area of the zone in square meters.
    :return: Density rounded to 2 decimal places.
    """
    if zone_area_sqm <= 0:
        return 0.0
    return round(float(people_count) / float(zone_area_sqm), 2)

def calculate_crowd_level(density: float) -> str:
    """
    Classify numerical density into standard category: 'low' | 'moderate' | 'high'.
    
    :param density: People per m².
    :return: 'low', 'moderate', or 'high'.
    """
    if density >= HIGH_DENSITY_THRESHOLD:
        return "high"
    elif density >= MODERATE_DENSITY_THRESHOLD:
        return "moderate"
    else:
        return "low"

# Base configuration of zones for campus buildings (matching 1600x800 coordinate layout)
# Each zone has a calibrated area in m² and a baseline occupant count.
CROWD_ZONE_REGISTRY: Dict[str, List[Dict[str, Any]]] = {
    # ==========================================
    # ITER BLOCK C
    # ==========================================
    "C-F0": [
        {
            "id": "cz-c0-south-lobby",
            "name": "Main Entrance & South Foyer",
            "base_count": 14,
            "area_sqm": 40.0,
            "phase_seed": 0.2
        },
        {
            "id": "cz-c0-north-lobby",
            "name": "North Entrance & Stair Lobby",
            "base_count": 5,
            "area_sqm": 36.0,
            "phase_seed": 1.5
        },
        {
            "id": "cz-c0-central-corridor",
            "name": "Central Longitudinal Corridor",
            "base_count": 9,
            "area_sqm": 42.0,
            "phase_seed": 2.8
        },
        {
            "id": "cz-c0-west-corridor",
            "name": "West Side Connector",
            "base_count": 3,
            "area_sqm": 38.0,
            "phase_seed": 4.1
        }
    ],
    "C-F1": [
        {
            "id": "cz-c1-north-stair",
            "name": "North-West Stair Lobby (Stairs 1)",
            "base_count": 12,
            "area_sqm": 28.0,
            "phase_seed": 0.8
        },
        {
            "id": "cz-c1-central-corridor",
            "name": "Central Academic Hallway",
            "base_count": 8,
            "area_sqm": 40.0,
            "phase_seed": 2.1
        },
        {
            "id": "cz-c1-east-stair",
            "name": "North-East Stairwell (Stairs 2)",
            "base_count": 4,
            "area_sqm": 36.0,
            "phase_seed": 3.7
        },
        {
            "id": "cz-c1-south-balcony",
            "name": "South Overlook Balcony",
            "base_count": 6,
            "area_sqm": 38.0,
            "phase_seed": 5.0
        }
    ],
    "C-F2": [
        {
            "id": "cz-c2-bridge",
            "name": "Inter-Block Connection Bridge (to D-Block)",
            "base_count": 16,
            "area_sqm": 33.0,
            "phase_seed": 1.1
        },
        {
            "id": "cz-c2-central-corridor",
            "name": "Central Department Corridor",
            "base_count": 7,
            "area_sqm": 39.0,
            "phase_seed": 2.9
        },
        {
            "id": "cz-c2-north-study",
            "name": "North Study Concourse",
            "base_count": 3,
            "area_sqm": 44.0,
            "phase_seed": 4.6
        }
    ],

    # ==========================================
    # ITER BLOCK D
    # ==========================================
    "D-F0": [
        {
            "id": "cz-d0-entrance",
            "name": "Ground Floor Atrium & Main Entry",
            "base_count": 19,
            "area_sqm": 36.5,
            "phase_seed": 0.4
        },
        {
            "id": "cz-d0-central-hall",
            "name": "Central Accessible Concourse",
            "base_count": 11,
            "area_sqm": 42.0,
            "phase_seed": 1.9
        },
        {
            "id": "cz-d0-north-hall",
            "name": "North Classroom Corridor",
            "base_count": 4,
            "area_sqm": 45.0,
            "phase_seed": 3.3
        },
        {
            "id": "cz-d0-east-stair",
            "name": "East Stairwell & Service Bay",
            "base_count": 5,
            "area_sqm": 38.0,
            "phase_seed": 5.2
        }
    ],
    "D-F1": [
        {
            "id": "cz-d1-bridge-c",
            "name": "Sky-Bridge Connection (to C-Block)",
            "base_count": 17,
            "area_sqm": 34.0,
            "phase_seed": 0.9
        },
        {
            "id": "cz-d1-central-hall",
            "name": "Central Level 1 Corridor",
            "base_count": 13,
            "area_sqm": 42.0,
            "phase_seed": 2.4
        },
        {
            "id": "cz-d1-north-hall",
            "name": "North Gallery Way",
            "base_count": 3,
            "area_sqm": 50.0,
            "phase_seed": 4.0
        }
    ],
    "D-F2": [
        {
            "id": "cz-d2-skywalk-e",
            "name": "West Skywalk Connection (to E-Block)",
            "base_count": 18,
            "area_sqm": 33.0,
            "phase_seed": 1.3
        },
        {
            "id": "cz-d2-central-hall",
            "name": "Central Level 2 Corridor",
            "base_count": 6,
            "area_sqm": 40.0,
            "phase_seed": 2.7
        },
        {
            "id": "cz-d2-east-lab",
            "name": "East Innovation Lab Corridor",
            "base_count": 9,
            "area_sqm": 37.5,
            "phase_seed": 4.4
        }
    ],
    "D-F3": [
        {
            "id": "cz-d3-central-hall",
            "name": "Level 3 Faculty Corridor",
            "base_count": 4,
            "area_sqm": 40.0,
            "phase_seed": 1.7
        },
        {
            "id": "cz-d3-east-stair",
            "name": "East Roof & Stair Landing",
            "base_count": 7,
            "area_sqm": 33.0,
            "phase_seed": 3.5
        }
    ],

    # ==========================================
    # ITER BLOCK E
    # ==========================================
    "E-F0": [
        {
            "id": "cz-e0-entrance",
            "name": "Main Ground Entrance & Security Port",
            "base_count": 24,
            "area_sqm": 38.5,
            "phase_seed": 0.3
        },
        {
            "id": "cz-e0-west-lifts",
            "name": "West High-Capacity Elevator Bank (Lifts 1 & 2)",
            "base_count": 15,
            "area_sqm": 32.5,
            "phase_seed": 1.6
        },
        {
            "id": "cz-e0-east-lifts",
            "name": "East Elevator Bank (Lifts 3 & 4)",
            "base_count": 8,
            "area_sqm": 32.0,
            "phase_seed": 2.9
        },
        {
            "id": "cz-e0-central-hall",
            "name": "Central Grand Spine Corridor",
            "base_count": 7,
            "area_sqm": 44.0,
            "phase_seed": 4.2
        },
        {
            "id": "cz-e0-south-hall",
            "name": "South Auditoria Corridor",
            "base_count": 5,
            "area_sqm": 45.0,
            "phase_seed": 5.6
        }
    ],
    "E-F1": [
        {
            "id": "cz-e1-east-lifts",
            "name": "East Elevator Lobby (Lifts 3 & 4)",
            "base_count": 16,
            "area_sqm": 32.5,
            "phase_seed": 0.7
        },
        {
            "id": "cz-e1-west-lifts",
            "name": "West Elevator Lobby (Lifts 1 & 2)",
            "base_count": 16,
            "area_sqm": 31.0,
            "phase_seed": 2.2
        },
        {
            "id": "cz-e1-central-hall",
            "name": "Central Teaching Hallway",
            "base_count": 6,
            "area_sqm": 43.0,
            "phase_seed": 3.8
        },
        {
            "id": "cz-e1-south-hall",
            "name": "South Tutorial Concourse & Main Stairs",
            "base_count": 3,
            "area_sqm": 40.0,
            "phase_seed": 5.1
        }
    ],
    "E-F2": [
        {
            "id": "cz-e2-bridge-d",
            "name": "Skywalk Gateway (Connecting to D-Block Floor 2)",
            "base_count": 20,
            "area_sqm": 34.0,
            "phase_seed": 1.2
        },
        {
            "id": "cz-e2-west-lifts",
            "name": "West Elevator Area (Lifts 1 & 2)",
            "base_count": 9,
            "area_sqm": 32.0,
            "phase_seed": 2.6
        },
        {
            "id": "cz-e2-east-lifts",
            "name": "East Elevator Area (Lifts 3 & 4)",
            "base_count": 5,
            "area_sqm": 33.0,
            "phase_seed": 4.1
        },
        {
            "id": "cz-e2-central-hall",
            "name": "Central Departmental Hallway",
            "base_count": 4,
            "area_sqm": 40.0,
            "phase_seed": 5.5
        }
    ],
    "E-F3": [
        {
            "id": "cz-e3-central-hall",
            "name": "Central Computing Concourse",
            "base_count": 8,
            "area_sqm": 41.0,
            "phase_seed": 1.8
        },
        {
            "id": "cz-e3-west-lifts",
            "name": "Level 3 Elevator Hall",
            "base_count": 6,
            "area_sqm": 32.0,
            "phase_seed": 3.4
        }
    ]
}

def normalize_floor_id(floor_id: str) -> str:
    """Normalize input floor IDs like '0', 'floor-0', 'C-0', 'BLD-C_0' to standard key like 'C-F0'."""
    raw = str(floor_id).strip().upper()
    
    if raw in CROWD_ZONE_REGISTRY:
        return raw

    # Extract block prefix
    block = "C"
    if "D" in raw:
        block = "D"
    elif "E" in raw:
        block = "E"

    # Extract digit
    digits = [c for c in raw if c.isdigit()]
    floor_num = digits[0] if digits else "0"

    key = f"{block}-F{floor_num}"
    return key if key in CROWD_ZONE_REGISTRY else "C-F0"

def get_floor_crowd_density(floor_id: str, source: Optional[str] = None) -> Dict[str, Any]:
    """
    Main API service function.
    Returns crowd density telemetry for all zones on the given floor.
    
    Priority Flow:
    1. Real YOLO CCTV Telemetry (data/cam01_telemetry.json):
       When real camera telemetry exists for this floor (e.g. CAM-01 on Academic Block E Main Entrance / Floor E-F0),
       extracts the latest real frame detections, camera zone counts, and returns:
       source: "yolo_video"
    
    2. Simulated Harmonic Stream (Fallback / Demo):
       When real telemetry is unavailable or for unmonitored floors, generates realistic,
       smooth harmonic variations around baseline occupancy:
       source: "mock"
    """
    normalized_key = normalize_floor_id(floor_id)
    registered_zones = CROWD_ZONE_REGISTRY.get(normalized_key, CROWD_ZONE_REGISTRY["C-F0"])
    
    current_time = time.time()
    now_iso = datetime.now(timezone.utc).isoformat()

    # STEP 2C: Check if real YOLO video telemetry is available for this floor
    # CAM-01 is calibrated for Academic Block E Main Entrance (Floor E-F0)
    if normalized_key == "E-F0" and (source is None or source in ("yolo", "yolo_video", "auto", "mock")):
        cam_telemetry = get_latest_camera_telemetry("CAM-01")
        if cam_telemetry:
            mapped_data = map_camera_to_floor_zones(normalized_key, cam_telemetry)
            if mapped_data:
                output_zones = []
                total_floor_people = 0
                total_floor_area = 0.0

                for zone in registered_zones:
                    zone_id = zone["id"]
                    area_sqm = zone["area_sqm"]
                    total_floor_area += area_sqm

                    # If this zone is the one mapped to CAM-01 (cz-e0-entrance)
                    if zone_id == mapped_data["target_zone_id"]:
                        people_count = mapped_data["people_count"]
                        density = calculate_density(people_count, area_sqm)
                        level = calculate_crowd_level(density)
                        total_floor_people += people_count

                        output_zones.append({
                            "zone_id": zone_id,
                            "zone_name": zone["name"],
                            "people_count": people_count,
                            "density": density,
                            "level": level,
                            "camera_zones": mapped_data.get("camera_subzones", {}),
                            "description": mapped_data.get("description", "")
                        })
                    else:
                        # Other zones on E-F0 with realistic live sensor baseline
                        base_count = zone["base_count"]
                        phase = zone.get("phase_seed", 0.0)
                        osc = (
                            1.5 * math.sin((current_time / 8.0) + phase) +
                            0.8 * math.cos((current_time / 21.0) + (phase * 1.5))
                        )
                        count = max(0, int(round(base_count + osc)))
                        density = calculate_density(count, area_sqm)
                        level = calculate_crowd_level(density)
                        total_floor_people += count

                        output_zones.append({
                            "zone_id": zone_id,
                            "zone_name": zone["name"],
                            "people_count": count,
                            "density": density,
                            "level": level
                        })

                # Compute overall floor density level
                avg_density = calculate_density(total_floor_people, max(1.0, total_floor_area))
                floor_level = calculate_crowd_level(avg_density)

                return {
                    "floor_id": normalized_key,
                    "timestamp": now_iso,
                    "source": "yolo_video",
                    "camera_id": cam_telemetry.get("camera_id", "CAM-01"),
                    "total_people": cam_telemetry.get("total_people", mapped_data["people_count"]),
                    "density_level": floor_level,
                    "camera_zones": cam_telemetry.get("zones", {}),
                    "zones": output_zones,
                    "camera_telemetry": {
                        "camera_id": cam_telemetry.get("camera_id", "CAM-01"),
                        "video_source": cam_telemetry.get("video_source", "cam01_sample_10s.mp4"),
                        "resolution": cam_telemetry.get("resolution", "1280x720"),
                        "total_people": cam_telemetry.get("total_people", mapped_data["people_count"]),
                        "zones": cam_telemetry.get("zones", {})
                    }
                }

    # Fallback to simulated harmonic stream
    output_zones = []
    for zone in registered_zones:
        base_count = zone["base_count"]
        area_sqm = zone["area_sqm"]
        phase = zone.get("phase_seed", 0.0)

        # Smooth, realistic variation: harmonic oscillation prevents jarring random jumps
        # Period ~ 25 to 45 seconds, amplitude ~ 2 to 4 people
        oscillation = (
            2.2 * math.sin((current_time / 7.0) + phase) +
            1.1 * math.cos((current_time / 19.0) + (phase * 1.5))
        )
        
        dynamic_count = max(0, int(round(base_count + oscillation)))
        density = calculate_density(dynamic_count, area_sqm)
        level = calculate_crowd_level(density)

        output_zones.append({
            "zone_id": zone["id"],
            "zone_name": zone["name"],
            "people_count": dynamic_count,
            "density": density,
            "level": level
        })

    return {
        "floor_id": normalized_key,
        "timestamp": now_iso,
        "source": "mock",
        "zones": output_zones
    }
