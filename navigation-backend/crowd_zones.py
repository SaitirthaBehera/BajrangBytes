"""Camera zone calibration for CAM-01 (1280x720)."""
from typing import Dict, List, Tuple, Optional, Any

CAMERA_ZONES_CONFIG: Dict[str, List[Dict[str, Any]]] = {
    "CAM-01": [
        {"zone_id":"cz-cam01-entrance-foyer","zone_name":"Entrance Foyer / Glass Door","polygon":[(490,160),(930,160),(940,360),(470,360)]},
        {"zone_id":"cz-cam01-main-steps","zone_name":"Main Steps / Landing","polygon":[(430,360),(930,360),(900,480),(730,580),(350,580)]},
        {"zone_id":"cz-cam01-accessible-ramp","zone_name":"Accessible Ramp","polygon":[(730,460),(960,370),(1100,510),(760,720),(550,720)]},
        {"zone_id":"cz-cam01-outside-approach","zone_name":"Outside Approach","polygon":[(0,300),(430,300),(350,580),(550,720),(0,720)]},
    ]
}

CAMERA_ALIASES = {"CAM-01":"CAM-01","BLK_E_MAIN_ENTRANCE":"CAM-01","E_MAIN_ENTRANCE":"CAM-01"}

def normalize_camera_id(camera_id: str) -> str:
    clean = str(camera_id).strip()
    if clean in CAMERA_ZONES_CONFIG: return clean
    if clean in CAMERA_ALIASES: return CAMERA_ALIASES[clean]
    for alias, target in CAMERA_ALIASES.items():
        if alias.lower() in clean.lower(): return target
    return "CAM-01"

def point_in_polygon(x: float, y: float, polygon: List[Tuple[float,float]]) -> bool:
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]; xj, yj = polygon[j]
        if yi != yj and ((yi > y) != (yj > y)) and x < (xj-xi)*(y-yi)/(yj-yi) + xi:
            inside = not inside
        j = i
    return inside

def get_foot_point(bbox: List[float]) -> Tuple[float,float]:
    x1,y1,x2,y2 = bbox
    return (x1+x2)/2.0, float(y2)

def assign_person_to_zone(foot_x: float, foot_y: float, camera_id: str="CAM-01") -> Optional[Dict[str,str]]:
    for zone in CAMERA_ZONES_CONFIG.get(normalize_camera_id(camera_id), []):
        if point_in_polygon(foot_x, foot_y, zone["polygon"]):
            return {"zone_id":zone["zone_id"],"zone_name":zone["zone_name"]}
    return None

def get_camera_zones(camera_id: str="CAM-01") -> List[Dict[str,Any]]:
    return CAMERA_ZONES_CONFIG.get(normalize_camera_id(camera_id), [])

def zone_id_to_telemetry_key(zone_id: Optional[str]) -> Optional[str]:
    if not zone_id: return None
    mapping = {"cz-cam01-entrance-foyer":"entrance_foyer","cz-cam01-main-steps":"main_steps","cz-cam01-accessible-ramp":"accessible_ramp","cz-cam01-outside-approach":"outside_approach"}
    return mapping.get(zone_id, zone_id.replace("cz-cam01-","").replace("-","_"))
