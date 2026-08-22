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
        
        voice_script = f"Navigating from {start_label} to {dest_label} using {route_type_label}. Total distance is {total_distance} meters, estimated travel time is {est_minutes} minute{'s' if est_minutes > 1 else ''}. "
        for idx, step_text in enumerate(steps[:-1]):
            voice_script += f"Step {idx + 1}: {step_text} "
        voice_script += f"Finally, you will arrive at your destination, {dest_label}."

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

# Singleton instance
router_engine = AccessibilityRouter()
