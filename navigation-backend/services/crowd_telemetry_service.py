import json, os
from typing import Optional, Dict, Any
BASE_DIR=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_TELEMETRY_PATH=os.path.join(BASE_DIR,"data","cam01_telemetry.json")
_CACHE=None
_MTIME=0.0
def load_telemetry_file(path:Optional[str]=None)->Optional[Dict[str,Any]]:
 global _CACHE,_MTIME
 target=path or DEFAULT_TELEMETRY_PATH
 if not os.path.exists(target): return None
 try:
  mtime=os.path.getmtime(target)
  if _CACHE is not None and mtime==_MTIME: return _CACHE
  with open(target,"r",encoding="utf-8") as f: _CACHE=json.load(f)
  _MTIME=mtime
  return _CACHE
 except Exception: return None
def get_latest_camera_telemetry(camera_id:str="CAM-01"):
 data=load_telemetry_file()
 if not data or not data.get("frames"): return None
 frame=data["frames"][-1]; meta=data.get("metadata",{}); zones=frame.get("zones",{})
 return {"camera_id":meta.get("camera_id",camera_id),"video_source":meta.get("video_source","cam01_sample_10s.mp4"),"resolution":meta.get("resolution","1280x720"),"total_people":frame.get("total_people",sum(zones.values())),"zones":zones,"tracked_persons":frame.get("tracked_persons",[])}
def map_camera_to_floor_zones(floor_id:str,telemetry:Dict[str,Any]):
 if str(floor_id).upper() not in {"E-F0","E0","0"}: return None
 zones=telemetry.get("zones",{}); total=sum(int(zones.get(k,0)) for k in ("entrance_foyer","main_steps","accessible_ramp","outside_approach"))
 return {"target_zone_id":"cz-e0-entrance","people_count":total or telemetry.get("total_people",0),"camera_subzones":zones}
