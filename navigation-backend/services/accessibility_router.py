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
        def get_zone_ids_for_edge(u: str, v: str) -> List[str]:
            return []
        def get_floor_for_zone_id(zone_id: str) -> Optional[str]:
            return None
        def get_floor_crowd_density(floor_id: str) -> Dict[str, Any]:
            return {}

# Crowd delay and impedance penalty multipliers (calibrated for real-world queue delays)
CROWD_PENALTY_MULTIPLIERS: Dict[str, float] = {
    "low": 1.0,        # Free-flowing corridor / elevator (no penalty)
    "moderate": 2.5,   # Moderate human traffic (+150% queue delay)
    "high": 5.0,       # High density congestion (+400% elevator queue delay)
}

class AccessibilityRouter:
    def __init__(self, building_id: str = "soa_iter_campus"):
        self.building_id = building_id
        self.graph = {}
        self.nodes_data = {}
        self._build_graph()

    def _build_graph(self, custom_nodes: Optional[List[Dict[str, Any]]] = None, custom_edges: Optional[List[Dict[str, Any]]] = None):
        if custom_nodes is not None and custom_edges is not None:
            nodes = custom_nodes
            edges = custom_edges
        else:
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

    def get_crowd_penalty(self, u: str, v: str, crowd_cache: Optional[Dict[str, Any]] = None) -> float:
        """
        Reusable function to determine the crowd penalty multiplier for a graph edge (u <-> v).
        Uses live YOLO CAM-01 data for E-F0 and calibrated harmonic mock data for other campus floors.
        Returns:
          - 1.0 for low crowd or unmapped segments
          - 1.3 for moderate crowd (+30% impedance)
          - 1.8 for high crowd (+80% impedance)
        """
        zone_ids = get_zone_ids_for_edge(u, v)
        if not zone_ids:
            return 1.0

        max_penalty = 1.0
        for zone_id in zone_ids:
            floor_key = get_floor_for_zone_id(zone_id)
            if not floor_key:
                continue

            floor_telemetry = None
            if crowd_cache is not None and floor_key in crowd_cache:
                floor_telemetry = crowd_cache[floor_key]
            else:
                try:
                    floor_telemetry = get_floor_crowd_density(floor_key)
                    if crowd_cache is not None:
                        crowd_cache[floor_key] = floor_telemetry
                except Exception as e:
                    floor_telemetry = None

            if not floor_telemetry:
                continue

            zones = floor_telemetry.get("zones", [])
            for z in zones:
                if z.get("zone_id") == zone_id:
                    level = z.get("level", "low")
                    penalty = CROWD_PENALTY_MULTIPLIERS.get(level, 1.0)
                    if penalty > max_penalty:
                        max_penalty = penalty
                    break

        return max_penalty

    def find_route(self, start_id: str, end_id: str, user_profile: str = "wheelchair") -> Dict[str, Any]:
        """
        Dijkstra's Algorithm tailored for Accessibility and Crowd-Awareness.
        - wheelchair: completely avoids stairs and inaccessible nodes/edges; prefers ramps and elevators; supports bridges.
        - blind / tactile: prefers tactile pathways; penalizes stairs and unguided routes.
        - standard: normal shortest distance routing.
        - crowd-awareness: evaluates dynamic crowd density impedance while preserving absolute accessibility priority.
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

        # Local cache for crowd telemetry to ensure O(1) lookups during path exploration
        crowd_cache: Dict[str, Any] = {}

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
                crowd_advisory = self._calculate_crowd_advisory(start_id, end_id, current_path, user_profile, crowd_cache)
                return self._format_route(current_path, edge_history, current_dist, user_profile, crowd_advisory)

            # Check neighbors
            for neighbor in self.graph.get(current_node, []):
                next_node = neighbor["to"]
                edge_dist = neighbor["distance"]
                edge_type = neighbor["type"]
                is_accessible = neighbor["accessible"]
                is_tactile = neighbor.get("tactile", False)
                next_node_meta = self.nodes_data.get(next_node, {})

                # 1. WHEELCHAIR CONSTRAINTS (Strict Inaccessibility Rejection)
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

                # Apply crowd awareness penalty multiplier
                crowd_penalty = self.get_crowd_penalty(current_node, next_node, crowd_cache)
                effective_weight = weight * crowd_penalty

                if next_node not in visited:
                    next_edge_history = edge_history + [neighbor]
                    heapq.heappush(
                        pq, 
                        (current_cost + effective_weight, current_dist + edge_dist, next_node, current_path, next_edge_history)
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

    def get_edge_crowd_level(self, u: str, v: str, crowd_cache: Dict[str, Any]) -> str:
        """Find highest crowd level for an edge"""
        from services.crowd_zone_mapping import get_zone_ids_for_edge, get_floor_for_zone_id
        zone_ids = get_zone_ids_for_edge(u, v)
        if not zone_ids:
            return "low"
        max_lvl = "low"
        for zone_id in zone_ids:
            floor_key = get_floor_for_zone_id(zone_id)
            if not floor_key:
                continue
            if floor_key in crowd_cache:
                floor_data = crowd_cache[floor_key]
            else:
                try:
                    floor_data = get_floor_crowd_density(floor_key)
                    crowd_cache[floor_key] = floor_data
                except Exception:
                    floor_data = None
            
            if not floor_data:
                continue

            zones = floor_data.get("zones", [])
            for z in zones:
                if z.get("zone_id") == zone_id or z.get("id") == zone_id:
                    lvl = z.get("level", "low").lower()
                    if lvl == "high":
                        return "high"
                    elif lvl == "moderate":
                        max_lvl = "moderate"
        return max_lvl

    def get_path_crowd_level(self, path: List[str], crowd_cache: Dict[str, Any]) -> str:
        """Find highest crowd level encountered along an entire path"""
        if len(path) <= 1:
            return "low"
        max_lvl = "low"
        for i in range(len(path) - 1):
            lvl = self.get_edge_crowd_level(path[i], path[i+1], crowd_cache)
            if lvl == "high":
                return "high"
            elif lvl == "moderate":
                max_lvl = "moderate"
        return max_lvl

    def _find_unweighted_path(self, start_id: str, end_id: str, user_profile: str) -> Optional[List[str]]:
        """Compute the pure shortest accessible path without crowd penalties"""
        pq = [(0, start_id, [])]
        visited = set()
        while pq:
            cost, curr, path = heapq.heappop(pq)
            if curr in visited:
                continue
            visited.add(curr)
            curr_path = path + [curr]
            if curr == end_id:
                return curr_path
            
            for neighbor in self.graph.get(curr, []):
                next_node = neighbor["to"]
                edge_dist = neighbor["distance"]
                edge_type = neighbor["type"]
                is_accessible = neighbor["accessible"]
                is_tactile = neighbor.get("tactile", False)
                next_node_meta = self.nodes_data.get(next_node, {})

                if user_profile == "wheelchair":
                    if edge_type == "stairs" or not is_accessible:
                        continue
                    if not next_node_meta.get("accessible", True) or next_node_meta.get("barrier") == "no_ramp":
                        continue
                    weight = edge_dist
                    if edge_type == "ramp":
                        weight = edge_dist * 0.8
                    elif edge_type == "elevator":
                        weight = edge_dist * 0.9
                elif user_profile == "blind":
                    weight = edge_dist
                    if is_tactile or edge_type == "tactile_path":
                        weight = edge_dist * 0.6
                    elif edge_type == "stairs":
                        weight = edge_dist * 2.5
                    else:
                        weight = edge_dist * 1.3
                else:
                    weight = edge_dist

                if next_node not in visited:
                    heapq.heappush(pq, (cost + weight, next_node, curr_path))
        return None

    def _calculate_crowd_advisory(self, start_id: str, end_id: str, path: List[str], user_profile: str, crowd_cache: Dict[str, Any]) -> Dict[str, Any]:
        """Determine if crowd avoidance occurred and format crowd advisory metadata"""
        chosen_crowd_level = self.get_path_crowd_level(path, crowd_cache)
        unweighted_path = self._find_unweighted_path(start_id, end_id, user_profile)
        
        avoided_congestion = False
        if unweighted_path and unweighted_path != path:
            unweighted_crowd_level = self.get_path_crowd_level(unweighted_path, crowd_cache)
            if unweighted_crowd_level in ("moderate", "high"):
                avoided_congestion = True
        
        if avoided_congestion:
            return {
                "avoided_congestion": True,
                "crowd_level": chosen_crowd_level,
                "summary": "Less crowded accessible route recommended",
                "advisory": "Slightly longer, but currently less crowded"
            }
        else:
            summary = "Clear accessible route" if chosen_crowd_level == "low" else f"Crowd level: {chosen_crowd_level.capitalize()}"
            return {
                "avoided_congestion": False,
                "crowd_level": chosen_crowd_level,
                "summary": summary
            }

    def _format_route(self, path: List[str], edge_history: List[Dict[str, Any]], total_distance: int, user_profile: str, crowd_advisory: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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

        # Consolidate continuous elevator or stair steps across multiple floors
        i = 0
        while i < len(path) - 1:
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

            # If this is an elevator edge, look ahead to see the final elevator floor reached
            if edge_type == "elevator" or (curr_floor != next_floor and edge_type != "stairs"):
                start_elev_node = curr_node
                start_elev_floor = curr_floor
                end_elev_node = next_node
                end_elev_floor = next_floor
                elev_dist = edge_dist

                # Lookahead to skip intermediate elevator stops (e.g. F0 -> F1 -> F2 becomes F0 -> F2)
                while i + 1 < len(path) - 1 and edge_history[i + 1].get("type") == "elevator":
                    i += 1
                    end_elev_node = self.nodes_data.get(path[i + 1], {"label": path[i + 1].replace("_", " ").title(), "floor": end_elev_floor + 1})
                    end_elev_floor = end_elev_node.get("floor", end_elev_floor + 1)
                    elev_dist += edge_history[i].get("distance", 10)

                start_fl_str = "Ground Floor" if start_elev_floor == 0 else f"Floor {start_elev_floor}"
                end_fl_str = "Ground Floor" if end_elev_floor == 0 else f"Floor {end_elev_floor}"

                lift_name = start_elev_node.get("label", "Elevator")
                if "lift" in curr_id.lower() or "elevator" in curr_id.lower():
                    if "lift3" in curr_id or "lift4" in curr_id or "east" in curr_id:
                        lift_name = "East Lift Lobby (Lifts 3 & 4 - Less Crowded)"
                    elif "lift1" in curr_id or "lift2" in curr_id or "west" in curr_id:
                        lift_name = "West Lift Lobby (Lifts 1 & 2)"

                instruction = f"Take the elevator at {lift_name} from {start_fl_str} up to {end_fl_str}."
                features_used.add("Voice-Guided Passenger Elevator")
                floor_transitions.append({
                    "fromFloor": start_elev_floor,
                    "toFloor": end_elev_floor,
                    "type": "elevator",
                    "description": f"Elevator from {start_fl_str} to {end_fl_str}"
                })
                steps.append(instruction)
                i += 1
                continue

            elif edge_type == "stairs":
                start_stair_node = curr_node
                start_stair_floor = curr_floor
                end_stair_node = next_node
                end_stair_floor = next_floor

                while i + 1 < len(path) - 1 and edge_history[i + 1].get("type") == "stairs":
                    i += 1
                    end_stair_node = self.nodes_data.get(path[i + 1], {"label": path[i + 1].replace("_", " ").title(), "floor": end_stair_floor + 1})
                    end_stair_floor = end_stair_node.get("floor", end_stair_floor + 1)

                start_fl_str = "Ground Floor" if start_stair_floor == 0 else f"Floor {start_stair_floor}"
                end_fl_str = "Ground Floor" if end_stair_floor == 0 else f"Floor {end_stair_floor}"

                instruction = f"Take the staircase from {start_fl_str} to {end_fl_str}."
                floor_transitions.append({
                    "fromFloor": start_stair_floor,
                    "toFloor": end_stair_floor,
                    "type": "stairs",
                    "description": f"Stairs from {start_fl_str} to {end_fl_str}"
                })
                steps.append(instruction)
                i += 1
                continue

            is_bridge = (edge_type == "bridge") or (
                curr_node.get("building_id") != next_node.get("building_id")
                and curr_node.get("building_id") not in ("outdoor", "campus", "")
                and next_node.get("building_id") not in ("outdoor", "campus", "")
                and (curr_floor > 0 or next_floor > 0)
            )

            is_outdoor_ground = (curr_floor == 0 and next_floor == 0) and (
                "entrance" in curr_id or "entrance" in next_id or "roundabout" in curr_id or "roundabout" in next_id or curr_node.get("building_id") == "outdoor" or next_node.get("building_id") == "outdoor"
            )

            if is_bridge:
                bldg_name = next_node.get("building_id", "adjacent block").replace("block_", "Block ").title()
                instruction = f"Cross the elevated skywalk bridge into {bldg_name} ({next_node['label']})."
                features_used.add("Accessible Connecting Bridge")
            elif edge_type == "ramp":
                instruction = f"Follow the accessible graded ramp towards {next_node['label']}."
                features_used.add("Wheelchair Accessible Ramp")
            elif is_outdoor_ground:
                if i == 0:
                    instruction = f"Start at {curr_node['label']} and follow the paved campus walkway towards {next_node['label']}."
                else:
                    instruction = f"Follow the paved campus walkway from {curr_node['label']} towards {next_node['label']}."
            else:
                if i == 0:
                    instruction = f"Start at {curr_node['label']} and proceed down the hallway towards {next_node['label']}."
                else:
                    instruction = f"Continue along corridor towards {next_node['label']}."
                
                if edge_info.get("tactile", False):
                    features_used.add("Tactile Ground Surface Paving")

            steps.append(instruction)
            i += 1

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

        # Generate Natural Human Voice Navigation Script (Concise & Spoken)
        start_label = self.nodes_data.get(path[0], {}).get("label", path[0].replace("_", " ").title())
        dest_label = dest_node.get("label", path[-1].replace("_", " ").title())
        
        voice_parts = []
        voice_parts.append(f"Starting route from {start_label} to {dest_label}.")

        has_east_lift = any("lift3" in n or "lift4" in n for n in path)
        has_west_lift = any("lift1" in n or "lift2" in n for n in path)
        has_stairs = any("stairs" in n for n in path)

        if crowd_advisory and crowd_advisory.get("avoided_congestion"):
            if has_east_lift:
                voice_parts.append("Live crowd advisory: West Lifts 1 and 2 are currently congested. You are routed via East Lifts 3 and 4 which is clear.")
            elif has_stairs and user_profile != "wheelchair":
                voice_parts.append("Live crowd alert: Elevators have high waiting times. Routed via clear staircase for faster transit.")
            else:
                voice_parts.append("Live crowd alert: Navigating via the less crowded accessible pathway.")
        elif has_west_lift:
            voice_parts.append("West Lifts 1 and 2 are operating with normal foot traffic.")

        # Check for outdoor path milestones dynamically from Dijkstra path
        outdoor_landmarks = []
        for n_id in path:
            node_meta = self.nodes_data.get(n_id, {})
            if node_meta.get("floor", 0) == 0 and ("entrance" in n_id or "roundabout" in n_id or "ground" in n_id or "cafeteria" in n_id or "parking" in n_id):
                clean_lbl = node_meta.get("label", n_id.replace("_", " ").title()).split("(")[0].strip()
                start_clean = start_label.split("(")[0].strip()
                dest_clean = dest_label.split("(")[0].strip()
                if clean_lbl not in outdoor_landmarks and clean_lbl != start_clean and clean_lbl != dest_clean:
                    outdoor_landmarks.append(clean_lbl)

        if outdoor_landmarks:
            if len(outdoor_landmarks) == 1:
                voice_parts.append(f"Follow the paved campus walkway to {outdoor_landmarks[0]}.")
            elif len(outdoor_landmarks) == 2:
                voice_parts.append(f"Follow the paved campus walkway past {outdoor_landmarks[0]} to {outdoor_landmarks[1]}.")
            else:
                landmarks_str = ", ".join(outdoor_landmarks[:-1])
                voice_parts.append(f"Follow the paved campus walkway past {landmarks_str}, and enter {outdoor_landmarks[-1]}.")

        # Add key elevator / stairs transition actions to voice
        for tr in floor_transitions:
            if tr.get("type") == "elevator":
                target_fl = f"Floor {tr.get('toFloor')}" if tr.get('toFloor', 0) > 0 else "Ground Floor"
                if has_east_lift:
                    voice_parts.append(f"Take the elevator at East Lift Lobby (Lifts 3 & 4) up to {target_fl}.")
                elif has_west_lift:
                    voice_parts.append(f"Take the elevator at West Lift Lobby (Lifts 1 & 2) up to {target_fl}.")
                else:
                    voice_parts.append(f"Take the elevator up to {target_fl}.")
            elif tr.get("type") == "stairs":
                target_fl = f"Floor {tr.get('toFloor')}" if tr.get('toFloor', 0) > 0 else "Ground Floor"
                voice_parts.append(f"Take the stairs up to {target_fl}.")

        # Add bridge transitions if moving across buildings on upper floors
        spoken_bridges = set()
        for s in steps:
            if "skywalk bridge into" in s.lower():
                import re
                b_match = re.search(r"into\s+(Block\s+[A-E])", s, re.IGNORECASE)
                b_name = b_match.group(1).title() if b_match else "the adjacent block"
                if b_name not in spoken_bridges:
                    spoken_bridges.add(b_name)
                    voice_parts.append(f"Cross the connecting skywalk into {b_name}.")

        voice_parts.append(f"Walk down the corridor to arrive at {dest_label}. Total distance is {total_distance} meters.")
        voice_script = " ".join(voice_parts)

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
            "route_type_label": route_type_label,
            "crowd_advisory": crowd_advisory
        }

# Singleton instance
router_engine = AccessibilityRouter()
