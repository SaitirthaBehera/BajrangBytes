"""Real YOLO person detection + lightweight tracking for CAM-01 crowd telemetry.
This is additive; it does not alter the existing navigation graph or 3D Twin.
"""
import argparse,json,os,math
from typing import Dict,List,Any
import cv2
from ultralytics import YOLO
from crowd_zones import assign_person_to_zone, get_foot_point, zone_id_to_telemetry_key
class Tracker:
 def __init__(self,max_distance=65): self.next_id=1; self.items={}; self.max_distance=max_distance
 def update(self,detections,camera_id):
  used=set(); active=[]
  for tr in list(self.items.values()):
   best=None; best_d=self.max_distance
   for i,d in enumerate(detections):
    if i in used: continue
    fx,fy=get_foot_point(d['bbox']); dist=math.hypot(tr['foot_x']-fx,tr['foot_y']-fy)
    if dist<best_d: best=i; best_d=dist
   if best is not None:
    d=detections[best]; tr['bbox']=d['bbox']; tr['confidence']=d['confidence']; tr['foot_x'],tr['foot_y']=get_foot_point(d['bbox']); used.add(best)
    active.append(tr)
  for i,d in enumerate(detections):
   if i in used: continue
   fx,fy=get_foot_point(d['bbox']); tr={'track_id':self.next_id,'bbox':d['bbox'],'confidence':d['confidence'],'foot_x':fx,'foot_y':fy}; self.items[self.next_id]=tr; self.next_id+=1; active.append(tr)
  return active
def process(video_path:str,telemetry_path:str,model_name='yolov8n.pt',camera_id='CAM-01',conf=0.35):
 cap=cv2.VideoCapture(video_path)
 if not cap.isOpened(): raise RuntimeError(f'Cannot open video: {video_path}')
 fps=cap.get(cv2.CAP_PROP_FPS) or 25.0; width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)); model=YOLO(model_name); tracker=Tracker(); frames=[]; cap.release()
 cap=cv2.VideoCapture(video_path); index=0
 while True:
  ok,frame=cap.read()
  if not ok: break
  index+=1; result=model.predict(frame,classes=[0],conf=conf,verbose=False)[0]; detections=[]
  for box in result.boxes:
   xy=box.xyxy[0].tolist(); detections.append({'bbox':[int(v) for v in xy],'confidence':round(float(box.conf[0]),3)})
  tracks=tracker.update(detections,camera_id); zones={'entrance_foyer':0,'main_steps':0,'accessible_ramp':0,'outside_approach':0}; people=[]
  for tr in tracks:
   z=assign_person_to_zone(tr['foot_x'],tr['foot_y'],camera_id); key=zone_id_to_telemetry_key(z['zone_id']) if z else None
   if key in zones: zones[key]+=1
   people.append({'track_id':tr['track_id'],'bbox':tr['bbox'],'foot_point':[round(tr['foot_x'],1),round(tr['foot_y'],1)],'confidence':tr['confidence'],'zone_id':z['zone_id'] if z else None,'zone_key':key})
  frames.append({'camera_id':camera_id,'timestamp':round(index/fps,3),'frame_index':index,'total_people':len(tracks),'zones':zones,'tracked_persons':people})
 cap.release(); os.makedirs(os.path.dirname(telemetry_path) or '.',exist_ok=True)
 payload={'metadata':{'camera_id':camera_id,'video_source':os.path.basename(video_path),'resolution':f'{width}x{height}','fps':fps,'model':model_name,'generated_at':__import__('datetime').datetime.utcnow().isoformat()+'Z'},'summary':{'peak_total_people':max((f['total_people'] for f in frames),default=0)},'frames':frames}
 with open(telemetry_path,'w',encoding='utf-8') as f: json.dump(payload,f,indent=2)
 return payload
if __name__=='__main__':
 p=argparse.ArgumentParser(); p.add_argument('--video',required=True); p.add_argument('--telemetry',default='data/cam01_telemetry.json'); p.add_argument('--model',default='yolov8n.pt'); p.add_argument('--camera',default='CAM-01'); args=p.parse_args(); process(args.video,args.telemetry,args.model,args.camera)
