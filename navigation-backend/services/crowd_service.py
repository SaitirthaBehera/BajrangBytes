import math,time
from datetime import datetime,timezone
from typing import Dict,Any,Optional
from services.crowd_telemetry_service import get_latest_camera_telemetry,map_camera_to_floor_zones
HIGH_DENSITY_THRESHOLD=0.35
MODERATE_DENSITY_THRESHOLD=0.18
CROWD_ZONE_REGISTRY={
 "C-F0":[("cz-c0-south-lobby","Main Entrance & South Foyer",14,40), ("cz-c0-north-lobby","North Entrance & Stair Lobby",5,36), ("cz-c0-central-corridor","Central Longitudinal Corridor",9,42), ("cz-c0-west-corridor","West Side Connector",3,38)],
 "D-F0":[("cz-d0-entrance","Ground Floor Atrium & Main Entry",19,36.5),("cz-d0-central-hall","Central Accessible Concourse",11,42),("cz-d0-north-hall","North Classroom Corridor",4,45),("cz-d0-east-stair","East Stairwell & Service Bay",5,38)],
 "E-F0":[("cz-e0-entrance","Main Ground Entrance & Security Port",24,38.5),("cz-e0-west-lifts","West High-Capacity Elevator Bank (Lifts 1 & 2)",15,32.5),("cz-e0-east-lifts","East Elevator Bank (Lifts 3 & 4)",8,32),("cz-e0-central-hall","Central Grand Spine Corridor",7,44),("cz-e0-south-hall","South Auditoria Corridor",5,45)]}
def normalize_floor_id(floor_id:str)->str:
 raw=str(floor_id).strip().upper()
 if raw in CROWD_ZONE_REGISTRY:return raw
 block='E' if 'E' in raw else ('D' if 'D' in raw else 'C')
 digits=''.join(c for c in raw if c.isdigit()) or '0'
 key=f'{block}-F{digits[0]}'
 return key if key in CROWD_ZONE_REGISTRY else 'C-F0'
def density(count:int,area:float)->float:return round(count/area,2) if area>0 else 0.0
def level(d:float)->str:return 'high' if d>=HIGH_DENSITY_THRESHOLD else ('moderate' if d>=MODERATE_DENSITY_THRESHOLD else 'low')
def get_floor_crowd_density(floor_id:str,source:Optional[str]=None)->Dict[str,Any]:
 key=normalize_floor_id(floor_id); now=time.time(); zones=[]
 if key=='E-F0' and source not in {'mock'}:
  cam=get_latest_camera_telemetry('CAM-01')
  mapped=map_camera_to_floor_zones(key,cam) if cam else None
  if mapped:
   for zid,name,base,area in CROWD_ZONE_REGISTRY[key]:
    count=mapped['people_count'] if zid==mapped['target_zone_id'] else max(0,round(base+1.5*math.sin(now/8)))
    item={"zone_id":zid,"zone_name":name,"people_count":count,"density":density(count,area),"level":level(density(count,area))}
    if zid==mapped['target_zone_id']: item.update(camera_zones=mapped['camera_subzones'],description='Real-Time YOLO Video Feed (CAM-01)')
    zones.append(item)
   return {"floor_id":key,"timestamp":datetime.now(timezone.utc).isoformat(),"source":"yolo_video","camera_id":"CAM-01","total_people":cam.get('total_people',mapped['people_count']),"camera_zones":cam.get('zones',{}),"zones":zones}
 for zid,name,base,area in CROWD_ZONE_REGISTRY.get(key,CROWD_ZONE_REGISTRY['C-F0']):
  count=max(0,round(base+2.2*math.sin(now/7)))
  d=density(count,area); zones.append({"zone_id":zid,"zone_name":name,"people_count":count,"density":d,"level":level(d)})
 return {"floor_id":key,"timestamp":datetime.now(timezone.utc).isoformat(),"source":"mock","zones":zones}
