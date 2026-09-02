"""Crowd density calculation and live telemetry service."""
import math
import time
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

try:
    from services.crowd_telemetry_service import get_latest_camera_telemetry, map_camera_to_floor_zones
except ImportError:
    from crowd_telemetry_service import get_latest_camera_telemetry, map_camera_to_floor_zones

HIGH_DENSITY_THRESHOLD = 0.35
MODERATE_DENSITY_THRESHOLD = 0.18

def calculate_density(people_count: int, zone_area_sqm: float) -> float:
    if zone_area_sqm <= 0: return 0.0
    return round(float(people_count) / float(zone_area_sqm), 2)

def calculate_crowd_level(density: float) -> str:
    if density >= HIGH_DENSITY_THRESHOLD: return "high"
    if density >= MODERATE_DENSITY_THRESHOLD: return "moderate"
    return "low"

CROWD_ZONE_REGISTRY: Dict[str, List[Dict[str, Any]]] = {
    "C-F0": [
        {"id":"cz-c0-south-lobby","name":"Main Entrance & South Foyer","base_count":14,"area_sqm":40.0,"phase_seed":0.2},
        {"id":"cz-c0-north-lobby","name":"North Entrance & Stair Lobby","base_count":5,"area_sqm":36.0,"phase_seed":1.5},
        {"id":"cz-c0-central-corridor","name":"Central Longitudinal Corridor","base_count":9,"area_sqm":42.0,"phase_seed":2.8},
        {"id":"cz-c0-west-corridor","name":"West Side Connector","base_count":3,"area_sqm":38.0,"phase_seed":4.1}],
    "C-F1": [
        {"id":"cz-c1-north-stair","name":"North-West Stair Lobby (Stairs 1)","base_count":12,"area_sqm":28.0,"phase_seed":0.8},
        {"id":"cz-c1-central-corridor","name":"Central Academic Hallway","base_count":8,"area_sqm":40.0,"phase_seed":2.1},
        {"id":"cz-c1-east-stair","name":"North-East Stairwell (Stairs 2)","base_count":4,"area_sqm":36.0,"phase_seed":3.7},
        {"id":"cz-c1-south-balcony","name":"South Overlook Balcony","base_count":6,"area_sqm":38.0,"phase_seed":5.0}],
    "C-F2": [
        {"id":"cz-c2-bridge","name":"Inter-Block Connection Bridge (to D-Block)","base_count":16,"area_sqm":33.0,"phase_seed":1.1},
        {"id":"cz-c2-central-corridor","name":"Central Department Corridor","base_count":7,"area_sqm":39.0,"phase_seed":2.9},
        {"id":"cz-c2-north-study","name":"North Study Concourse","base_count":3,"area_sqm":44.0,"phase_seed":4.6}],
    "D-F0": [
        {"id":"cz-d0-entrance","name":"Ground Floor Atrium & Main Entry","base_count":19,"area_sqm":36.5,"phase_seed":0.4},
        {"id":"cz-d0-central-hall","name":"Central Accessible Concourse","base_count":11,"area_sqm":42.0,"phase_seed":1.9},
        {"id":"cz-d0-north-hall","name":"North Classroom Corridor","base_count":4,"area_sqm":45.0,"phase_seed":3.3},
        {"id":"cz-d0-east-stair","name":"East Stairwell & Service Bay","base_count":5,"area_sqm":38.0,"phase_seed":5.2}],
    "D-F1": [
        {"id":"cz-d1-bridge-c","name":"Sky-Bridge Connection (to C-Block)","base_count":17,"area_sqm":34.0,"phase_seed":0.9},
        {"id":"cz-d1-central-hall","name":"Central Level 1 Corridor","base_count":13,"area_sqm":42.0,"phase_seed":2.4},
        {"id":"cz-d1-north-hall","name":"North Gallery Way","base_count":3,"area_sqm":50.0,"phase_seed":4.0}],
    "D-F2": [
        {"id":"cz-d2-skywalk-e","name":"West Skywalk Connection (to E-Block)","base_count":18,"area_sqm":33.0,"phase_seed":1.3},
        {"id":"cz-d2-central-hall","name":"Central Level 2 Corridor","base_count":6,"area_sqm":40.0,"phase_seed":2.7},
        {"id":"cz-d2-east-lab","name":"East Innovation Lab Corridor","base_count":9,"area_sqm":37.5,"phase_seed":4.4}],
    "D-F3": [
        {"id":"cz-d3-central-hall","name":"Level 3 Faculty Corridor","base_count":4,"area_sqm":40.0,"phase_seed":1.7},
        {"id":"cz-d3-east-stair","name":"East Roof & Stair Landing","base_count":7,"area_sqm":33.0,"phase_seed":3.5}],
    "E-F0": [
        {"id":"cz-e0-entrance","name":"Main Ground Entrance & Security Port","base_count":24,"area_sqm":38.5,"phase_seed":0.3},
        {"id":"cz-e0-west-lifts","name":"West High-Capacity Elevator Bank (Lifts 1 & 2)","base_count":15,"area_sqm":32.5,"phase_seed":1.6},
        {"id":"cz-e0-east-lifts","name":"East Elevator Bank (Lifts 3 & 4)","base_count":8,"area_sqm":32.0,"phase_seed":2.9},
        {"id":"cz-e0-central-hall","name":"Central Grand Spine Corridor","base_count":7,"area_sqm":44.0,"phase_seed":4.2},
        {"id":"cz-e0-south-hall","name":"South Auditoria Corridor","base_count":5,"area_sqm":45.0,"phase_seed":5.6}],
    "E-F1": [
        {"id":"cz-e1-east-lifts","name":"East Elevator Lobby (Lifts 3 & 4)","base_count":16,"area_sqm":32.5,"phase_seed":0.7},
        {"id":"cz-e1-west-lifts","name":"West Elevator Lobby (Lifts 1 & 2)","base_count":16,"area_sqm":31.0,"phase_seed":2.2},
        {"id":"cz-e1-central-hall","name":"Central Teaching Hallway","base_count":6,"area_sqm":43.0,"phase_seed":3.8},
        {"id":"cz-e1-south-hall","name":"South Tutorial Concourse & Main Stairs","base_count":3,"area_sqm":40.0,"phase_seed":5.1}],
    "E-F2": [
        {"id":"cz-e2-bridge-d","name":"Skywalk Gateway (Connecting to D-Block Floor 2)","base_count":20,"area_sqm":34.0,"phase_seed":1.2},
        {"id":"cz-e2-west-lifts","name":"West Elevator Area (Lifts 1 & 2)","base_count":9,"area_sqm":32.0,"phase_seed":2.6},
        {"id":"cz-e2-east-lifts","name":"East Elevator Area (Lifts 3 & 4)","base_count":5,"area_sqm":33.0,"phase_seed":4.1},
        {"id":"cz-e2-central-hall","name":"Central Departmental Hallway","base_count":4,"area_sqm":40.0,"phase_seed":5.5}],
    "E-F3": [
        {"id":"cz-e3-central-hall","name":"Central Computing Concourse","base_count":8,"area_sqm":41.0,"phase_seed":1.8},
        {"id":"cz-e3-west-lifts","name":"Level 3 Elevator Hall","base_count":6,"area_sqm":32.0,"phase_seed":3.4}]
}

def normalize_floor_id(floor_id: str) -> str:
    raw=str(floor_id).strip().upper()
    if raw in CROWD_ZONE_REGISTRY: return raw
    block="C"
    if "D" in raw: block="D"
    elif "E" in raw: block="E"
    digits=[c for c in raw if c.isdigit()]
    floor_num=digits[0] if digits else "0"
    key=f"{block}-F{floor_num}"
    return key if key in CROWD_ZONE_REGISTRY else "C-F0"

def get_floor_crowd_density(floor_id: str, source: Optional[str]=None) -> Dict[str,Any]:
    normalized_key=normalize_floor_id(floor_id)
    registered_zones=CROWD_ZONE_REGISTRY.get(normalized_key,CROWD_ZONE_REGISTRY["C-F0"])
    current_time=time.time(); now_iso=datetime.now(timezone.utc).isoformat()
    if normalized_key=="E-F0" and (source is None or source in ("yolo","yolo_video","auto","mock")):
        cam=get_latest_camera_telemetry("CAM-01")
        if cam:
            mapped=map_camera_to_floor_zones(normalized_key,cam)
            if mapped:
                output=[]; total_people=0; total_area=0.0
                for zone in registered_zones:
                    zid=zone["id"]; area=zone["area_sqm"]; total_area+=area
                    if zid==mapped["target_zone_id"]:
                        count=mapped["people_count"]; d=calculate_density(count,area); lvl=calculate_crowd_level(d); total_people+=count
                        output.append({"zone_id":zid,"zone_name":zone["name"],"people_count":count,"density":d,"level":lvl,"camera_zones":mapped.get("camera_subzones",{}),"description":mapped.get("description","")})
                    else:
                        phase=zone.get("phase_seed",0.0); osc=1.5*math.sin((current_time/8.0)+phase)+0.8*math.cos((current_time/21.0)+(phase*1.5)); count=max(0,int(round(zone["base_count"]+osc))); d=calculate_density(count,area); lvl=calculate_crowd_level(d); total_people+=count
                        output.append({"zone_id":zid,"zone_name":zone["name"],"people_count":count,"density":d,"level":lvl})
                avg=calculate_density(total_people,max(1.0,total_area))
                return {"floor_id":normalized_key,"timestamp":now_iso,"source":"yolo_video","camera_id":cam.get("camera_id","CAM-01"),"total_people":cam.get("total_people",mapped["people_count"]),"density_level":calculate_crowd_level(avg),"camera_zones":cam.get("zones",{}),"zones":output,"camera_telemetry":{"camera_id":cam.get("camera_id","CAM-01"),"video_source":cam.get("video_source","cam01_sample_10s.mp4"),"resolution":cam.get("resolution","1280x720"),"total_people":cam.get("total_people",mapped["people_count"]),"zones":cam.get("zones",{})}}
    output=[]
    for zone in registered_zones:
        phase=zone.get("phase_seed",0.0); osc=2.2*math.sin((current_time/7.0)+phase)+1.1*math.cos((current_time/19.0)+(phase*1.5)); count=max(0,int(round(zone["base_count"]+osc))); d=calculate_density(count,zone["area_sqm"])
        output.append({"zone_id":zone["id"],"zone_name":zone["name"],"people_count":count,"density":d,"level":calculate_crowd_level(d)})
    return {"floor_id":normalized_key,"timestamp":now_iso,"source":"mock","zones":output}
