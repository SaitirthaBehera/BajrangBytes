import heapq
import json
import os
from typing import List, Dict, Any, Optional

class AccessibilityRouter:
    def __init__(self, building_id: str = "soa_iter_campus"):
        self.building_id = building_id
        self.graph = {}
        self.nodes_data = {}
        self._build_graph()

    def _build_graph(self):
        graph_path = os.path.join(os.path.dirname(__file__), "../../src/data/unified_graph.json")
        if not os.path.exists(graph_path):
            graph_path = os.path.join(os.path.dirname(__file__), "../static/unified_graph.json")
        
        nodes = []
        edges = []
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
            
            # Accessibility classification
            if edge_type in ("elevator", "lift"):
                accessible = True
            elif edge_type == "stairs":
                accessible = False
            elif edge_type in ("ramp", "bridge"):
                accessible = True
            else:
                accessible = edge.get("accessible", True)

            if u in self.graph:
                self.graph[u].append({
                    "to": v,
                    "distance": dist,
                    "type": edge_type,
                    "accessible": accessible,
                    "tactile": tactile
                })
            if v in self.graph:
                self.graph[v].append({
                    "to": u,
                    "distance": dist,
                    "type": edge_type,
                    "accessible": accessible,
                    "tactile": tactile
                })

    def find_route(self, start_id: str, end_id: str, user_profile: str = "wheelchair") -> Dict[str, Any]:
        """
        Dijkstra's Algorithm tailored for Accessibility.
        - wheelchair: completely avoids stairs and inaccessible nodes/edges; prefers ramps and elevators; supports bridges.
        - blind / tactile: prefers tactile pathways; penalizes stairs and unguided routes.
        - standard: normal shortest distance routing.
        """
        user_profile = (user_profile or "wheelchair").lower()
        if user_profile == "visual":
            user_profile = "blind"
        elif user_profile == "general":
            user_profile = "standard"

        if start_id not in self.graph or end_id not in self.graph:
            return {"error": f"Invalid start ('{start_id}') or destination ('{end_id}') location."}

        if start_id == end_id:
            start_node = self.nodes_data[start_id]
            return {
                "status": "success",
                "start_location": start_id,
                "end_location": end_id,
                "profile_used": user_profile,
                "total_distance_meters": 0,
                "estimated_time_minutes": 0,
                "floors_involved": [start_node.get("floor", 0)],
                "floor_transitions": [],
                "path_nodes": [start_id],
                "step_by_step_directions": [f"You are already at {start_node.get('label', start_id)}."],
                "voice_navigation": f"You are already at {start_node.get('label', start_id)}.",
                "accessible_features_used": [],
                "warnings": [],
                "route_type_label": "Direct / Current Location"
            }

        # Check if start or end node is blocked for wheelchair
        start_node_meta = self.nodes_data.get(start_id, {})
        end_node_meta = self.nodes_data.get(end_id, {})

        if user_profile == "wheelchair":
            if not start_node_meta.get("accessible", True) or start_node_meta.get("barrier") == "no_ramp":
                return {
                    "error": f"Starting location '{start_node_meta.get('label', start_id)}' is not wheelchair accessible (physical barrier: no ramp / steps only)."
                }
            if not end_node_meta.get("accessible", True) or end_node_meta.get("barrier") == "no_ramp":
                return {
                    "error": f"No wheelchair-accessible route is available. Destination '{end_node_meta.get('label', end_id)}' has no ramp or step-free access."
                }

        # Priority queue: (weighted_cost, actual_distance, current_node, path_taken, edge_history)
        pq = [(0, 0, start_id, [], [])]
        visited = set()

        while pq:
            current_cost, current_dist, current_node, path, edge_history = heapq.heappop(pq)

            if current_node in visited:
                continue

            visited.add(current_node)
            current_path = path + [current_node]

            # Destination reached
            if current_node == end_id:
                return self._format_route(current_path, edge_history, current_dist, user_profile)

            # Check neighbors
            for neighbor in self.graph.get(current_node, []):
                next_node = neighbor["to"]
                edge_dist = neighbor["distance"]
                edge_type = neighbor["type"]
                is_accessible = neighbor["accessible"]
                is_tactile = neighbor.get("tactile", False)
                next_node_meta = self.nodes_data.get(next_node, {})

                # 1. WHEELCHAIR CONSTRAINTS
                if user_profile == "wheelchair":
                    # Avoid stairs completely
                    if edge_type == "stairs" or not is_accessible:
                        continue
                    # Avoid node with physical barriers
                    if not next_node_meta.get("accessible", True) or next_node_meta.get("barrier") == "no_ramp":
                        continue
                    
                    # Weight calculation: prefer ramps and elevators
                    weight = edge_dist
                    if edge_type == "ramp":
                        weight = edge_dist * 0.8
                    elif edge_type == "elevator":
                        weight = edge_dist * 0.9

                # 2. TACTILE / BLIND CONSTRAINTS
                elif user_profile == "blind":
                    weight = edge_dist
                    if is_tactile or edge_type == "tactile_path":
                        weight = edge_dist * 0.6  # Strongly prefer tactile paving
                    elif edge_type == "stairs":
                        weight = edge_dist * 2.5  # Heavy penalty for stairs without tactile guides
                    else:
                        weight = edge_dist * 1.3

                # 3. STANDARD CONSTRAINTS
                else:
                    weight = edge_dist  # Shortest physical distance

                if next_node not in visited:
                    next_edge_history = edge_history + [neighbor]
                    heapq.heappush(
                        pq, 
                        (current_cost + weight, current_dist + edge_dist, next_node, current_path, next_edge_history)
                    )

        # No route found
        if user_profile == "wheelchair":
            return {
                "error": f"No wheelchair-accessible route is available between '{start_node_meta.get('label', start_id)}' and '{end_node_meta.get('label', end_id)}'. Some intermediate segments require stairs or lack elevator/ramp connections."
            }
        elif user_profile == "blind":
            return {
                "error": f"No suitable tactile-guided route found between '{start_node_meta.get('label', start_id)}' and '{end_node_meta.get('label', end_id)}'."
            }
        else:
            return {
                "error": f"No path found between '{start_node_meta.get('label', start_id)}' and '{end_node_meta.get('label', end_id)}'."
            }

    def _format_route(self, path: List[str], edge_history: List[Dict[str, Any]], total_distance: int, user_profile: str) -> Dict[str, Any]:
        """Convert calculated graph path into natural human-friendly directions & metadata"""
        steps = []
        floors_set = set()
        floor_transitions = []
        features_used = set()
        warnings = []

        for node_id in path:
            node_info = self.nodes_data.get(node_id, {})
            if "floor" in node_info:
                floors_set.add(node_info["floor"])

        for i in range(len(path) - 1):
            curr_id = path[i]
            next_id = path[i + 1]
            curr_node = self.nodes_data.get(curr_id, {"label": curr_id.replace("_", " ").title(), "floor": 0})
            next_node = self.nodes_data.get(next_id, {"label": next_id.replace("_", " ").title(), "floor": 0})

            edge_info = edge_history[i] if i < len(edge_history) else {"type": "pathway", "distance": 10}
            edge_type = edge_info.get("type", "pathway")
            edge_dist = edge_info.get("distance", 10)

            curr_floor = curr_node.get("floor", 0)
            next_floor = next_node.get("floor", 0)
            curr_floor_str = "Ground Floor" if curr_floor == 0 else f"Floor {curr_floor}"
            next_floor_str = "Ground Floor" if next_floor == 0 else f"Floor {next_floor}"

            if edge_type == "elevator" or (curr_floor != next_floor and edge_type != "stairs"):
                instruction = f"Take the Voice-Assisted Passenger Elevator from {curr_node['label']} ({curr_floor_str}) to {next_node['label']} ({next_floor_str})."
                features_used.add("Voice-Guided Passenger Elevator")
                floor_transitions.append({
                    "fromFloor": curr_floor,
                    "toFloor": next_floor,
                    "type": "elevator",
                    "description": f"Elevator from {curr_floor_str} to {next_floor_str}"
                })
            elif edge_type == "stairs":
                instruction = f"Take the stairs from {curr_node['label']} ({curr_floor_str}) to {next_node['label']} ({next_floor_str})."
                floor_transitions.append({
                    "fromFloor": curr_floor,
                    "toFloor": next_floor,
                    "type": "stairs",
                    "description": f"Stairs from {curr_floor_str} to {next_floor_str}"
                })
            elif edge_type == "bridge" or ("_f" in curr_id and "_f" in next_id and curr_id[:7] != next_id[:7]):
                instruction = f"Cross the step-free connecting bridge from {curr_node['label']} to {next_node['label']} ({edge_dist}m)."
                features_used.add("Accessible Connecting Bridge")
            elif edge_type == "ramp":
                instruction = f"Follow the accessible graded ramp from {curr_node['label']} to {next_node['label']} ({edge_dist}m)."
                features_used.add("Wheelchair Accessible Ramp")
            else:
                if i == 0:
                    instruction = f"Start at {curr_node['label']} ({curr_floor_str}) and follow the accessible walkway towards {next_node['label']} ({edge_dist}m)."
                else:
                    instruction = f"Continue along corridor from {curr_node['label']} to {next_node['label']} ({edge_dist}m)."
                
                if edge_info.get("tactile", False):
                    features_used.add("Tactile Ground Surface Paving")

            steps.append(instruction)

        # Final destination step
        dest_node = self.nodes_data.get(path[-1], {"label": path[-1].replace("_", " ").title(), "floor": 0})
        dest_floor_str = "Ground Floor" if dest_node.get("floor", 0) == 0 else f"Floor {dest_node.get('floor', 0)}"
        steps.append(f"Arrive at destination: {dest_node['label']} ({dest_floor_str}).")

        # Travel speed (m/s)
        speed_mps = 1.1 if user_profile == "standard" else 0.7
        est_minutes = max(1, round((total_distance / speed_mps) / 60))

        # Profile route type label
        if user_profile == "wheelchair":
            route_type_label = "Step-Free / Elevator Assisted (Ramp Prioritized)"
            features_used.add("Barrier-Free Pathway")
        elif user_profile == "blind":
            route_type_label = "Tactile Paved & Auditory Guided Route"
            features_used.add("Tactile Ground Indicators")
        else:
            route_type_label = "Standard Shortest Walking Route"

        # Voice navigation script
        start_label = self.nodes_data.get(path[0], {}).get("label", path[0].replace("_", " ").title())
        dest_label = dest_node.get("label", path[-1].replace("_", " ").title())
        
        voice_script = self._generate_natural_voice_script(path, start_label, dest_label, total_distance, est_minutes)

        return {
            "status": "success",
            "start_location": path[0],
            "end_location": path[-1],
            "profile_used": user_profile,
            "total_distance_meters": total_distance,
            "estimated_time_minutes": est_minutes,
            "floors_involved": sorted(list(floors_set)),
            "floor_transitions": floor_transitions,
            "path_nodes": path,
            "step_by_step_directions": steps,
            "voice_navigation": voice_script,
            "accessible_features_used": sorted(list(features_used)),
            "warnings": warnings,
            "route_type_label": route_type_label
        }

    def _generate_natural_voice_script(self, path: List[str], start_label: str, end_label: str, total_dist: int, est_mins: int) -> str:
        raw_actions = []
        i = 0
        while i < len(path) - 1:
            curr_id = path[i]
            next_id = path[i+1]
            
            # Elevator
            if "lift" in curr_id.lower():
                j = i + 1
                while j < len(path) and "lift" in path[j].lower():
                    j += 1
                dest_node = self.nodes_data.get(path[j-1], {})
                dest_floor = dest_node.get("floor", 0)
                curr_floor = self.nodes_data.get(curr_id, {}).get("floor", 0)
                floor_str = f"Floor {dest_floor}" if dest_floor > 0 else "the Ground Floor"
                lift_name = "Lift 1" if "lift1" in curr_id else "Lift 2" if "lift2" in curr_id else "the elevator"
                if dest_floor < curr_floor:
                    raw_actions.append(("action", f"take {lift_name} down to {floor_str}"))
                elif dest_floor > curr_floor:
                    raw_actions.append(("action", f"take {lift_name} up to {floor_str}"))
                else:
                    raw_actions.append(("action", f"take {lift_name} to {floor_str}"))
                i = j - 1
                i += 1
                continue
                
            # Stairs
            if "stairs" in curr_id.lower():
                j = i + 1
                while j < len(path) and "stairs" in path[j].lower():
                    j += 1
                dest_node = self.nodes_data.get(path[j-1], {})
                dest_floor = dest_node.get("floor", 0)
                curr_floor = self.nodes_data.get(curr_id, {}).get("floor", 0)
                floor_str = f"Floor {dest_floor}" if dest_floor > 0 else "the Ground Floor"
                if dest_floor < curr_floor:
                    raw_actions.append(("action", f"take the stairs down to {floor_str}"))
                elif dest_floor > curr_floor:
                    raw_actions.append(("action", f"take the stairs up to {floor_str}"))
                else:
                    raw_actions.append(("action", f"take the stairs to {floor_str}"))
                i = j - 1
                i += 1
                continue

            # Bridge
            if "bridge" in curr_id.lower():
                dest_node = self.nodes_data.get(next_id, {})
                bldg = dest_node.get("building_id", "")
                bldg_name = bldg.replace("block_", "Block ").title()
                if bldg and bldg != self.nodes_data.get(curr_id, {}).get("building_id", ""):
                    raw_actions.append(("action", f"cross the connecting skybridge into {bldg_name}"))
                else:
                    raw_actions.append(("action", "cross the connecting skybridge"))
                i += 1
                continue

            # Landmarks
            if i > 0 and i < len(path) - 1:
                curr_lbl = self.nodes_data.get(curr_id, {}).get("label", "").split("(")[0].strip()
                if "roundabout" in curr_id.lower():
                    raw_actions.append(("action", "continue through the Central Campus Roundabout"))
                elif any(curr_id.startswith(k) for k in ["block_a", "block_b", "block_c", "block_d", "block_e"]):
                    clean_name = curr_lbl.replace(" Entrance", "").replace(" Gate", "").strip()
                    if clean_name:
                        raw_actions.append(("landmark", clean_name))
            i += 1
        
        final_phrases = []
        current_landmarks = []
        
        def flush_landmarks():
            nonlocal current_landmarks
            if not current_landmarks:
                return
            seen = []
            for lm in current_landmarks:
                if lm not in seen:
                    seen.append(lm)
            if len(seen) == 1:
                final_phrases.append("proceed past " + seen[0])
            elif len(seen) == 2:
                final_phrases.append("proceed past " + seen[0] + " and " + seen[1])
            else:
                final_phrases.append("proceed past " + ", ".join(seen[:-1]) + ", and " + seen[-1])
            current_landmarks = []

        for kind, val in raw_actions:
            if kind == "landmark":
                current_landmarks.append(val)
            else:
                flush_landmarks()
                final_phrases.append(val)
        flush_landmarks()

        cleaned_phrases = []
        for p in final_phrases:
            if not cleaned_phrases or cleaned_phrases[-1] != p:
                cleaned_phrases.append(p)

        if not cleaned_phrases:
            route_sentence = f"Start from {start_label} and proceed along the main accessible pathway directly to {end_label}."
        else:
            route_sentence = f"Start from {start_label}, " + ", ".join(cleaned_phrases) + f", and arrive at {end_label}."

        dist_sentence = f"Total distance is {total_dist} meters, taking approximately {est_mins} minute" + ("s" if est_mins > 1 else "") + "."
        
        return f"{route_sentence} {dist_sentence}"

# Singleton instance
router_engine = AccessibilityRouter()
