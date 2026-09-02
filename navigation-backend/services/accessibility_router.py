import heapq
import json
import os
from typing import List, Dict, Any, Optional

try:
    from services.crowd_zone_mapping import get_zone_ids_for_edge, get_floor_for_zone_id
    from services.crowd_service import get_floor_crowd_density
except ImportError:
    try:
        from crowd_zone_mapping import get_zone_ids_for_edge, get_floor_for_zone_id
        from crowd_service import get_floor_crowd_density
    except ImportError:
        def get_zone_ids_for_edge(u: str, v: str) -> List[str]: return []
        def get_floor_for_zone_id(zone_id: str) -> Optional[str]: return None
        def get_floor_crowd_density(floor_id: str) -> Dict[str, Any]: return {}

CROWD_PENALTY_MULTIPLIERS: Dict[str, float] = {
    "low": 1.0,
    "moderate": 1.3,
    "high": 1.8,
}

class AccessibilityRouter:
    def __init__(self, building_id: str = "soa_iter_campus"):
        self.building_id = building_id
        self.graph = {}
        self.nodes_data = {}
        self._build_graph()

    def _build_graph(self, custom_nodes: Optional[List[Dict[str, Any]]] = None, custom_edges: Optional[List[Dict[str, Any]]] = None):
        if custom_nodes is not None and custom_edges is not None:
            nodes, edges = custom_nodes, custom_edges
        else:
            graph_path = os.path.join(os.path.dirname(__file__), "../../src/data/unified_graph.json")
            if not os.path.exists(graph_path):
                graph_path = os.path.join(os.path.dirname(__file__), "../static/unified_graph.json")
            nodes, edges = [], []
            if os.path.exists(graph_path):
                try:
                    with open(graph_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        nodes = data.get("nodes", [])
                        edges = data.get("edges", [])
                except Exception as e:
                    print(f"Error loading unified graph: {e}")
        for node in nodes:
            self.nodes_data[node["id"]] = node
            self.graph[node["id"]] = []
        for edge in edges:
            u, v = edge["from"], edge["to"]
            dist = edge.get("distance", 10)
            edge_type = edge.get("type", "corridor")
            tactile = edge.get("tactile", False)
            if edge_type in ("elevator", "lift"): accessible = True
            elif edge_type == "stairs": accessible = False
            elif edge_type in ("ramp", "bridge"): accessible = True
            else: accessible = edge.get("accessible", True)
            if u in self.graph:
                self.graph[u].append({"to": v, "distance": dist, "type": edge_type, "accessible": accessible, "tactile": tactile})
            if v in self.graph:
                self.graph[v].append({"to": u, "distance": dist, "type": edge_type, "accessible": accessible, "tactile": tactile})

    def get_crowd_penalty(self, u: str, v: str, crowd_cache: Optional[Dict[str, Any]] = None) -> float:
        zone_ids = get_zone_ids_for_edge(u, v)
        if not zone_ids: return 1.0
        max_penalty = 1.0
        for zone_id in zone_ids:
            floor_key = get_floor_for_zone_id(zone_id)
            if not floor_key: continue
            floor_telemetry = None
            if crowd_cache is not None and floor_key in crowd_cache:
                floor_telemetry = crowd_cache[floor_key]
            else:
                try:
                    floor_telemetry = get_floor_crowd_density(floor_key)
                    if crowd_cache is not None: crowd_cache[floor_key] = floor_telemetry
                except Exception:
                    floor_telemetry = None
            if not floor_telemetry: continue
            for z in floor_telemetry.get("zones", []):
                if z.get("zone_id") == zone_id:
                    penalty = CROWD_PENALTY_MULTIPLIERS.get(z.get("level", "low"), 1.0)
                    max_penalty = max(max_penalty, penalty)
                    break
        return max_penalty

    def find_route(self, start_id: str, end_id: str, user_profile: str = "wheelchair") -> Dict[str, Any]:
        user_profile = (user_profile or "wheelchair").lower()
        if user_profile == "visual": user_profile = "blind"
        elif user_profile == "general": user_profile = "standard"
        if start_id not in self.graph or end_id not in self.graph:
            return {"error": f"Invalid start ('{start_id}') or destination ('{end_id}') location."}
        if start_id == end_id:
            start_node = self.nodes_data[start_id]
            return {"status":"success","start_location":start_id,"end_location":end_id,"profile_used":user_profile,"total_distance_meters":0,"estimated_time_minutes":0,"floors_involved":[start_node.get("floor",0)],"floor_transitions":[],"path_nodes":[start_id],"step_by_step_directions":[f"You are already at {start_node.get('label',start_id)}."],"voice_navigation":f"You are already at {start_node.get('label',start_id)}.","accessible_features_used":[],"warnings":[],"route_type_label":"Direct / Current Location"}
        start_node_meta = self.nodes_data.get(start_id, {})
        end_node_meta = self.nodes_data.get(end_id, {})
        if user_profile == "wheelchair":
            if not start_node_meta.get("accessible", True) or start_node_meta.get("barrier") == "no_ramp":
                return {"error": f"Starting location '{start_node_meta.get('label',start_id)}' is not wheelchair accessible (physical barrier: no ramp / steps only)."}
            if not end_node_meta.get("accessible", True) or end_node_meta.get("barrier") == "no_ramp":
                return {"error": f"No wheelchair-accessible route is available. Destination '{end_node_meta.get('label',end_id)}' has no ramp or step-free access."}
        crowd_cache: Dict[str, Any] = {}
        pq = [(0, 0, start_id, [], [])]
        visited = set()
        while pq:
            current_cost, current_dist, current_node, path, edge_history = heapq.heappop(pq)
            if current_node in visited: continue
            visited.add(current_node)
            current_path = path + [current_node]
            if current_node == end_id:
                advisory = self._calculate_crowd_advisory(start_id, end_id, current_path, user_profile, crowd_cache)
                return self._format_route(current_path, edge_history, current_dist, user_profile, advisory)
            for neighbor in self.graph.get(current_node, []):
                next_node, edge_dist = neighbor["to"], neighbor["distance"]
                edge_type, is_accessible = neighbor["type"], neighbor["accessible"]
                is_tactile = neighbor.get("tactile", False)
                next_meta = self.nodes_data.get(next_node, {})
                if user_profile == "wheelchair":
                    if edge_type == "stairs" or not is_accessible: continue
                    if not next_meta.get("accessible", True) or next_meta.get("barrier") == "no_ramp": continue
                    weight = edge_dist * (0.8 if edge_type == "ramp" else 0.9 if edge_type == "elevator" else 1.0)
                elif user_profile == "blind":
                    if is_tactile or edge_type == "tactile_path": weight = edge_dist * 0.6
                    elif edge_type == "stairs": weight = edge_dist * 2.5
                    else: weight = edge_dist * 1.3
                else: weight = edge_dist
                effective_weight = weight * self.get_crowd_penalty(current_node, next_node, crowd_cache)
                if next_node not in visited:
                    heapq.heappush(pq, (current_cost + effective_weight, current_dist + edge_dist, next_node, current_path, edge_history + [neighbor]))
        if user_profile == "wheelchair": msg = f"No wheelchair-accessible route is available between '{start_node_meta.get('label',start_id)}' and '{end_node_meta.get('label',end_id)}'. Some intermediate segments require stairs or lack elevator/ramp connections."
        elif user_profile == "blind": msg = f"No suitable tactile-guided route found between '{start_node_meta.get('label',start_id)}' and '{end_node_meta.get('label',end_id)}'."
        else: msg = f"No path found between '{start_node_meta.get('label',start_id)}' and '{end_node_meta.get('label',end_id)}'."
        return {"error": msg}

    def get_edge_crowd_level(self, u: str, v: str, crowd_cache: Dict[str, Any]) -> str:
        zone_ids = get_zone_ids_for_edge(u, v)
        if not zone_ids: return "low"
        max_lvl = "low"
        for zone_id in zone_ids:
            floor_key = get_floor_for_zone_id(zone_id)
            if not floor_key: continue
            try:
                floor_data = crowd_cache[floor_key] if floor_key in crowd_cache else get_floor_crowd_density(floor_key)
                crowd_cache[floor_key] = floor_data
            except Exception: continue
            for z in floor_data.get("zones", []):
                if z.get("zone_id") == zone_id or z.get("id") == zone_id:
                    lvl = z.get("level", "low").lower()
                    if lvl == "high": return "high"
                    if lvl == "moderate": max_lvl = "moderate"
        return max_lvl

    def get_path_crowd_level(self, path: List[str], crowd_cache: Dict[str, Any]) -> str:
        max_lvl = "low"
        for i in range(max(0, len(path)-1)):
            lvl = self.get_edge_crowd_level(path[i], path[i+1], crowd_cache)
            if lvl == "high": return "high"
            if lvl == "moderate": max_lvl = "moderate"
        return max_lvl

    def _find_unweighted_path(self, start_id: str, end_id: str, user_profile: str) -> Optional[List[str]]:
        pq = [(0, start_id, [])]
        visited = set()
        while pq:
            cost, curr, path = heapq.heappop(pq)
            if curr in visited: continue
            visited.add(curr)
            current_path = path + [curr]
            if curr == end_id: return current_path
            for neighbor in self.graph.get(curr, []):
                nxt, edge_type, accessible = neighbor["to"], neighbor["type"], neighbor["accessible"]
                meta = self.nodes_data.get(nxt, {})
                if user_profile == "wheelchair":
                    if edge_type == "stairs" or not accessible: continue
                    if not meta.get("accessible", True) or meta.get("barrier") == "no_ramp": continue
                    weight = neighbor["distance"] * (0.8 if edge_type == "ramp" else 0.9 if edge_type == "elevator" else 1.0)
                elif user_profile == "blind":
                    if neighbor.get("tactile") or edge_type == "tactile_path": weight = neighbor["distance"] * 0.6
                    elif edge_type == "stairs": weight = neighbor["distance"] * 2.5
                    else: weight = neighbor["distance"] * 1.3
                else: weight = neighbor["distance"]
                if nxt not in visited: heapq.heappush(pq, (cost + weight, nxt, current_path))
        return None

    def _calculate_crowd_advisory(self, start_id: str, end_id: str, path: List[str], user_profile: str, crowd_cache: Dict[str, Any]) -> Dict[str, Any]:
        chosen = self.get_path_crowd_level(path, crowd_cache)
        unweighted = self._find_unweighted_path(start_id, end_id, user_profile)
        avoided = False
        if unweighted and unweighted != path:
            baseline = self.get_path_crowd_level(unweighted, crowd_cache)
            avoided = baseline in ("moderate", "high")
        if avoided:
            return {"avoided_congestion":True,"crowd_level":chosen,"summary":"Less crowded accessible route recommended","advisory":"Slightly longer, but currently less crowded"}
        return {"avoided_congestion":False,"crowd_level":chosen,"summary":"Clear accessible route" if chosen == "low" else f"Crowd level: {chosen.capitalize()}"}

    def _format_route(self, path: List[str], edge_history: List[Dict[str, Any]], total_distance: int, user_profile: str, crowd_advisory: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        steps=[]; floors_set=set(); floor_transitions=[]; features_used=set(); warnings=[]
        for node_id in path:
            info=self.nodes_data.get(node_id,{})
            if "floor" in info: floors_set.add(info["floor"])
        for i in range(len(path)-1):
            curr_id,next_id=path[i],path[i+1]
            curr=self.nodes_data.get(curr_id,{"label":curr_id.replace("_"," ").title(),"floor":0})
            nxt=self.nodes_data.get(next_id,{"label":next_id.replace("_"," ").title(),"floor":0})
            edge=edge_history[i] if i<len(edge_history) else {"type":"pathway","distance":10}
            et=edge.get("type","pathway"); dist=edge.get("distance",10)
            cf,nf=curr.get("floor",0),nxt.get("floor",0)
            cfs="Ground Floor" if cf==0 else f"Floor {cf}"; nfs="Ground Floor" if nf==0 else f"Floor {nf}"
            if et in ("elevator","lift") or (cf!=nf and et!="stairs"):
                instruction=f"Take the Voice-Assisted Passenger Elevator from {curr['label']} ({cfs}) to {nxt['label']} ({nfs})."; features_used.add("Voice-Guided Passenger Elevator"); floor_transitions.append({"fromFloor":cf,"toFloor":nf,"type":"elevator","description":f"Elevator from {cfs} to {nfs}"})
            elif et=="stairs":
                instruction=f"Take the stairs from {curr['label']} ({cfs}) to {nxt['label']} ({nfs})."; floor_transitions.append({"fromFloor":cf,"toFloor":nf,"type":"stairs","description":f"Stairs from {cfs} to {nfs}"})
            elif et=="bridge": instruction=f"Cross the step-free connecting bridge from {curr['label']} to {nxt['label']} ({dist}m)."; features_used.add("Accessible Connecting Bridge")
            elif et=="ramp": instruction=f"Follow the accessible graded ramp from {curr['label']} to {nxt['label']} ({dist}m)."; features_used.add("Wheelchair Accessible Ramp")
            else:
                instruction=f"Start at {curr['label']} ({cfs}) and follow the accessible walkway towards {nxt['label']} ({dist}m)." if i==0 else f"Continue along corridor from {curr['label']} to {nxt['label']} ({dist}m)."
                if edge.get("tactile",False): features_used.add("Tactile Ground Surface Paving")
            steps.append(instruction)
        dest=self.nodes_data.get(path[-1],{"label":path[-1].replace("_"," ").title(),"floor":0}); dfs="Ground Floor" if dest.get("floor",0)==0 else f"Floor {dest.get('floor',0)}"; steps.append(f"Arrive at destination: {dest['label']} ({dfs}).")
        speed=1.1 if user_profile=="standard" else 0.7; mins=max(1,round((total_distance/speed)/60))
        if user_profile=="wheelchair": route_label="Step-Free / Elevator Assisted (Ramp Prioritized)"; features_used.add("Barrier-Free Pathway")
        elif user_profile=="blind": route_label="Tactile Paved & Auditory Guided Route"; features_used.add("Tactile Ground Indicators")
        else: route_label="Standard Shortest Walking Route"
        start_label=self.nodes_data.get(path[0],{}).get("label",path[0].replace("_"," ").title()); dest_label=dest.get("label",path[-1].replace("_"," ").title())
        voice=f"Navigating from {start_label} to {dest_label} using {route_label}. Total distance is {total_distance} meters, estimated travel time is {mins} minute{'s' if mins>1 else ''}. " + " ".join(f"Step {i+1}: {s}" for i,s in enumerate(steps[:-1])) + f" Finally, you will arrive at your destination, {dest_label}."
        return {"status":"success","start_location":path[0],"end_location":path[-1],"profile_used":user_profile,"total_distance_meters":total_distance,"estimated_time_minutes":mins,"floors_involved":sorted(floors_set),"floor_transitions":floor_transitions,"path_nodes":path,"step_by_step_directions":steps,"voice_navigation":voice,"accessible_features_used":sorted(features_used),"warnings":warnings,"route_type_label":route_label,"crowd_advisory":crowd_advisory}

router_engine=AccessibilityRouter()
