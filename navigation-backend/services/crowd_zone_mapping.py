"""
Crowd Zone to Navigation Graph Mapping Layer
============================================
Associates navigation graph nodes and edges with crowd monitoring zones across campus buildings.

Supported Buildings & Floors:
  - Block E: E-F0 (Live YOLO CAM-01 + Mock), E-F1, E-F2, E-F3 (Mock Harmonic)
  - Block D: D-F0, D-F1, D-F2, D-F3 (Mock Harmonic)
  - Block C: C-F0, C-F1, C-F2 (Mock Harmonic)
"""

from typing import Dict, List, Optional

# Mapping between navigation graph nodes in unified_graph.json and crowd zones in crowd_service.py / crowdDensityData.ts
NODE_TO_CROWD_ZONE: Dict[str, str] = {
    # ==========================================
    # ACADEMIC BLOCK E — GROUND FLOOR (E-F0)
    # ==========================================
    "block_e_main_entrance": "cz-e0-entrance",
    "e_f0_lift1": "cz-e0-west-lifts",
    "e_f0_lift2": "cz-e0-west-lifts",
    "e_f0_west_corridor": "cz-e0-west-lifts",
    "e_f0_lift3": "cz-e0-east-lifts",
    "e_f0_lift4": "cz-e0-east-lifts",
    "e_f0_east_corridor": "cz-e0-east-lifts",
    "e_f0_north_corridor": "cz-e0-central-hall",
    "e_f0_south_corridor": "cz-e0-south-hall",
    "e_f0_stairs": "cz-e0-south-hall",

    # ==========================================
    # ACADEMIC BLOCK E — FLOOR 1 (E-F1)
    # ==========================================
    "e_f1_lift1": "cz-e1-west-lifts",
    "e_f1_lift2": "cz-e1-west-lifts",
    "e_f1_west_corridor": "cz-e1-west-lifts",
    "e_f1_lift3": "cz-e1-east-lifts",
    "e_f1_lift4": "cz-e1-east-lifts",
    "e_f1_east_corridor": "cz-e1-east-lifts",
    "e_f1_north_corridor": "cz-e1-central-hall",
    "e_f1_south_corridor": "cz-e1-south-hall",
    "e_f1_stairs": "cz-e1-south-hall",

    # ==========================================
    # ACADEMIC BLOCK E — FLOOR 2 (E-F2)
    # ==========================================
    "e_f2_bridge_d": "cz-e2-bridge-d",
    "e_f2_lift1": "cz-e2-west-lifts",
    "e_f2_lift2": "cz-e2-west-lifts",
    "e_f2_west_corridor": "cz-e2-west-lifts",
    "e_f2_lift3": "cz-e2-east-lifts",
    "e_f2_lift4": "cz-e2-east-lifts",
    "e_f2_east_corridor": "cz-e2-east-lifts",
    "e_f2_north_corridor": "cz-e2-central-hall",
    "e_f2_south_corridor": "cz-e2-central-hall",
    "e_f2_stairs": "cz-e2-central-hall",

    # ==========================================
    # ACADEMIC BLOCK E — FLOOR 3 (E-F3)
    # ==========================================
    "e_f3_lift1": "cz-e3-west-lifts",
    "e_f3_lift2": "cz-e3-west-lifts",
    "e_f3_lift3": "cz-e3-west-lifts",
    "e_f3_lift4": "cz-e3-west-lifts",
    "e_f3_west_corridor": "cz-e3-west-lifts",
    "e_f3_stairs": "cz-e3-west-lifts",
    "e_f3_north_corridor": "cz-e3-central-hall",
    "e_f3_east_corridor": "cz-e3-central-hall",
    "e_f3_south_corridor": "cz-e3-central-hall",

    # ==========================================
    # ACADEMIC BLOCK D — GROUND FLOOR (D-F0)
    # ==========================================
    "block_d_entrance": "cz-d0-entrance",
    "d_f0_bridge_c": "cz-d0-entrance",
    "d_f0_corridor": "cz-d0-central-hall",
    "d_f0_stairs2": "cz-d0-north-hall",
    "d_f0_stairs1": "cz-d0-east-stair",
    "d_f0_bridge_e": "cz-d0-east-stair",

    # ==========================================
    # ACADEMIC BLOCK D — FLOOR 1 (D-F1)
    # ==========================================
    "d_f1_bridge_c": "cz-d1-bridge-c",
    "d_f1_corridor": "cz-d1-central-hall",
    "d_f1_stairs2": "cz-d1-north-hall",
    "d_f1_stairs1": "cz-d1-north-hall",
    "d_f1_bridge_e": "cz-d1-north-hall",

    # ==========================================
    # ACADEMIC BLOCK D — FLOOR 2 (D-F2)
    # ==========================================
    "d_f2_bridge_e": "cz-d2-skywalk-e",
    "d_f2_corridor": "cz-d2-central-hall",
    "d_f2_stairs1": "cz-d2-east-lab",
    "d_f2_stairs2": "cz-d2-east-lab",

    # ==========================================
    # ACADEMIC BLOCK D — FLOOR 3 (D-F3)
    # ==========================================
    "d_f3_corridor": "cz-d3-central-hall",
    "d_f3_stairs1": "cz-d3-east-stair",
    "d_f3_stairs2": "cz-d3-east-stair",

    # ==========================================
    # ACADEMIC BLOCK C — GROUND FLOOR (C-F0)
    # ==========================================
    "c_f0_ent_football": "cz-c0-south-lobby",
    "c_f0_ent_sc_block": "cz-c0-south-lobby",
    "block_c_football_entrance": "cz-c0-south-lobby",
    "block_c_sc_entrance": "cz-c0-south-lobby",
    "c_f0_stairs1": "cz-c0-north-lobby",
    "c_f0_stairs2": "cz-c0-north-lobby",
    "c_f0_stairs_1": "cz-c0-north-lobby",
    "c_f0_stairs_2": "cz-c0-north-lobby",
    "c_f0_corridor": "cz-c0-central-corridor",
    "c_f0_corridor_main": "cz-c0-central-corridor",
    "c_f0_bridge_d": "cz-c0-west-corridor",
    "c_f0_ent_block_d": "cz-c0-west-corridor",

    # ==========================================
    # ACADEMIC BLOCK C — FLOOR 1 (C-F1)
    # ==========================================
    "c_f1_stairs1": "cz-c1-north-stair",
    "c_f1_corridor": "cz-c1-central-corridor",
    "c_f1_stairs2": "cz-c1-east-stair",
    "c_f1_bridge_d": "cz-c1-south-balcony",

    # ==========================================
    # ACADEMIC BLOCK C — FLOOR 2 (C-F2)
    # ==========================================
    "c_f2_stairs1": "cz-c2-bridge",
    "c_f2_corridor": "cz-c2-central-corridor",
    "c_f2_stairs2": "cz-c2-north-study"
}

def get_zone_id_for_node(node_id: str) -> Optional[str]:
    """Retrieve the crowd zone ID associated with a graph node ID, if mapped."""
    if not node_id:
        return None
    return NODE_TO_CROWD_ZONE.get(node_id.strip())

def get_floor_for_zone_id(zone_id: str) -> Optional[str]:
    """
    Extract the floor key from a zone ID prefix.
    Examples:
      - 'cz-e0-entrance' -> 'E-F0'
      - 'cz-d1-bridge-c' -> 'D-F1'
      - 'cz-c2-bridge'   -> 'C-F2'
    """
    if not zone_id or not zone_id.startswith("cz-"):
        return None
    parts = zone_id.split("-")
    if len(parts) >= 2:
        code = parts[1].upper() # e.g. 'E0', 'D1', 'C2'
        if len(code) >= 2 and code[0] in ("C", "D", "E"):
            return f"{code[0]}-F{code[1]}"
    return None

def get_zone_ids_for_edge(u: str, v: str) -> List[str]:
    """
    Get all unique crowd zone IDs relevant to an edge between nodes u and v.
    """
    zones = []
    z_u = get_zone_id_for_node(u)
    if z_u and z_u not in zones:
        zones.append(z_u)
    z_v = get_zone_id_for_node(v)
    if z_v and z_v not in zones:
        zones.append(z_v)
    return zones
