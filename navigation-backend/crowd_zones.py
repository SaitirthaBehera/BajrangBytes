"""
Camera Zone Configuration & Calibration Module
==============================================
Defines 2D pixel polygon zones for CCTV camera views and spatial zone assignment logic.

Coordinate System:
  Camera pixel space (1280x720 native camera frame coordinate system).
  Completely independent of the 1600x800 Twin Map architectural coordinate system.

Camera Calibrated:
  CAM-01 — ACADEMIC BLOCK E MAIN ENTRANCE (1280x720)
  Zones:
    1. Outside Approach (cz-cam01-outside-approach)
    2. Main Steps / Landing (cz-cam01-main-steps)
    3. Entrance Foyer / Glass Door (cz-cam01-entrance-foyer)
    4. Accessible Ramp (cz-cam01-accessible-ramp)
"""

from typing import Dict, List, Tuple, Optional, Any


def point_in_polygon(x: float, y: float, polygon: List[Tuple[float, float]]) -> bool:
    """
    Pure Python Ray-Casting Algorithm to test if a 2D point (x, y) lies inside a polygon.
    Ensures zero external C-library dependency while providing microsecond execution per detection.

    :param x: X coordinate (e.g., foot_x)
    :param y: Y coordinate (e.g., foot_y)
    :param polygon: List of (x, y) vertices defining the closed boundary.
    :return: True if the point is inside the polygon, False otherwise.
    """
    num_vertices = len(polygon)
    if num_vertices < 3:
        return False

    inside = False
    p1x, p1y = polygon[0]

    for i in range(num_vertices + 1):
        p2x, p2y = polygon[i % num_vertices]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        x_inters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= x_inters:
                        inside = not inside
        p1x, p1y = p2x, p2y

    return inside


def get_foot_point(bbox: List[float]) -> Tuple[float, float]:
    """
    Calculates the ground-contact foot point (bottom-center) of a YOLO bounding box [x1, y1, x2, y2].
    Using the foot point provides the most accurate spatial ground-plane localization for CCTV perspectives.

    :param bbox: Bounding box coordinates [x1, y1, x2, y2]
    :return: (foot_x, foot_y)
    """
    x1, y1, x2, y2 = bbox
    foot_x = (x1 + x2) / 2.0
    foot_y = float(y2)
    return foot_x, foot_y


# Camera Polygon Definitions (1280x720 coordinate frame)
CAMERA_ZONES_CONFIG: Dict[str, List[Dict[str, Any]]] = {
    # -------------------------------------------------------------
    # CAM-01: Academic Block E Main Entrance (1280 x 720)
    # -------------------------------------------------------------
    "CAM-01": [
        {
            "zone_id": "cz-cam01-entrance-foyer",
            "zone_name": "Entrance Foyer / Glass Door",
            "polygon": [
                (490, 160),
                (930, 160),
                (940, 360),
                (470, 360)
            ],
            "description": "Upper entrance vestibule and sliding glass door portal leading into Block E ground lobby."
        },
        {
            "zone_id": "cz-cam01-main-steps",
            "zone_name": "Main Steps / Landing",
            "polygon": [
                (430, 360),
                (930, 360),
                (900, 480),
                (730, 580),
                (350, 580)
            ],
            "description": "Central wide multi-tier stairway concourse connecting the plaza to the entrance foyer."
        },
        {
            "zone_id": "cz-cam01-accessible-ramp",
            "zone_name": "Accessible Ramp",
            "polygon": [
                (730, 460),
                (960, 370),
                (1100, 510),
                (760, 720),
                (550, 720)
            ],
            "description": "Accessible ADA ramp equipped with stainless steel guardrails providing step-free barrier-free access."
        },
        {
            "zone_id": "cz-cam01-outside-approach",
            "zone_name": "Outside Approach",
            "polygon": [
                (0, 300),
                (430, 300),
                (350, 580),
                (550, 720),
                (0, 720)
            ],
            "description": "Lower exterior plaza, pedestrian walkway, and open approach concourse."
        }
    ]
}

# Alias mapping for camera IDs
CAMERA_ALIASES: Dict[str, str] = {
    "CAM-01": "CAM-01",
    "CAM-01: BLK_E_MAIN_ENTRANCE": "CAM-01",
    "BLK_E_MAIN_ENTRANCE": "CAM-01",
    "E_MAIN_ENTRANCE": "CAM-01"
}


def normalize_camera_id(camera_id: str) -> str:
    """Normalize various camera naming formats to standardized registry key."""
    clean = str(camera_id).strip()
    if clean in CAMERA_ZONES_CONFIG:
        return clean
    if clean in CAMERA_ALIASES:
        return CAMERA_ALIASES[clean]
    for key, target in CAMERA_ALIASES.items():
        if key.lower() in clean.lower():
            return target
    return "CAM-01"


def assign_person_to_zone(
    foot_x: float,
    foot_y: float,
    camera_id: str = "CAM-01"
) -> Optional[Dict[str, str]]:
    """
    Determines which calibrated camera zone a person belongs to based on their
    ground foot point (foot_x, foot_y) in camera pixel coordinates.

    :param foot_x: Ground X coordinate ((x1 + x2) / 2)
    :param foot_y: Ground Y coordinate (y2)
    :param camera_id: Camera identifier (default: "CAM-01")
    :return: Dict with {'zone_id': str, 'zone_name': str} if inside a zone, or None if outside all zones.
    """
    cam_key = normalize_camera_id(camera_id)
    zones = CAMERA_ZONES_CONFIG.get(cam_key, [])

    for zone in zones:
        polygon = zone["polygon"]
        if point_in_polygon(foot_x, foot_y, polygon):
            return {
                "zone_id": zone["zone_id"],
                "zone_name": zone["zone_name"]
            }

    return None


def get_camera_zones(camera_id: str = "CAM-01") -> List[Dict[str, Any]]:
    """Retrieve all defined spatial zones and polygons for a given camera."""
    cam_key = normalize_camera_id(camera_id)
    return CAMERA_ZONES_CONFIG.get(cam_key, [])


def zone_id_to_telemetry_key(zone_id: Optional[str]) -> Optional[str]:
    """
    Map camera zone ID to standardized telemetry schema key:
      cz-cam01-entrance-foyer   -> entrance_foyer
      cz-cam01-main-steps       -> main_steps
      cz-cam01-accessible-ramp  -> accessible_ramp
      cz-cam01-outside-approach -> outside_approach
    """
    if not zone_id:
        return None
    
    mapping = {
        "cz-cam01-entrance-foyer": "entrance_foyer",
        "cz-cam01-main-steps": "main_steps",
        "cz-cam01-accessible-ramp": "accessible_ramp",
        "cz-cam01-outside-approach": "outside_approach"
    }
    if zone_id in mapping:
        return mapping[zone_id]
    
    # Generic fallback: strip prefixes and sanitize
    clean = zone_id.replace("cz-", "").replace("cam01-", "").replace("cam02-", "").replace("-", "_")
    return clean

