"""Crowd Zone to Navigation Graph Mapping Layer."""
from typing import Dict, List, Optional

NODE_TO_CROWD_ZONE: Dict[str, str] = {
    "block_e_main_entrance": "cz-e0-entrance",
    "e_f0_lift1": "cz-e0-west-lifts", "e_f0_lift2": "cz-e0-west-lifts", "e_f0_west_corridor": "cz-e0-west-lifts",
    "e_f0_lift3": "cz-e0-east-lifts", "e_f0_lift4": "cz-e0-east-lifts", "e_f0_east_corridor": "cz-e0-east-lifts",
    "e_f0_north_corridor": "cz-e0-central-hall", "e_f0_south_corridor": "cz-e0-south-hall", "e_f0_stairs": "cz-e0-south-hall",
    "e_f1_lift1": "cz-e1-west-lifts", "e_f1_lift2": "cz-e1-west-lifts", "e_f1_west_corridor": "cz-e1-west-lifts",
    "e_f1_lift3": "cz-e1-east-lifts", "e_f1_lift4": "cz-e1-east-lifts", "e_f1_east_corridor": "cz-e1-east-lifts",
    "e_f1_north_corridor": "cz-e1-central-hall", "e_f1_south_corridor": "cz-e1-south-hall", "e_f1_stairs": "cz-e1-south-hall",
    "e_f2_bridge_d": "cz-e2-bridge-d", "e_f2_lift1": "cz-e2-west-lifts", "e_f2_lift2": "cz-e2-west-lifts", "e_f2_west_corridor": "cz-e2-west-lifts",
    "e_f2_lift3": "cz-e2-east-lifts", "e_f2_lift4": "cz-e2-east-lifts", "e_f2_east_corridor": "cz-e2-east-lifts",
    "e_f2_north_corridor": "cz-e2-central-hall", "e_f2_south_corridor": "cz-e2-central-hall", "e_f2_stairs": "cz-e2-central-hall",
    "e_f3_lift1": "cz-e3-west-lifts", "e_f3_lift2": "cz-e3-west-lifts", "e_f3_lift3": "cz-e3-west-lifts", "e_f3_lift4": "cz-e3-west-lifts",
    "e_f3_west_corridor": "cz-e3-west-lifts", "e_f3_stairs": "cz-e3-west-lifts", "e_f3_north_corridor": "cz-e3-central-hall", "e_f3_east_corridor": "cz-e3-central-hall", "e_f3_south_corridor": "cz-e3-central-hall",
    "block_d_entrance": "cz-d0-entrance", "d_f0_bridge_c": "cz-d0-entrance", "d_f0_corridor": "cz-d0-central-hall", "d_f0_stairs2": "cz-d0-north-hall", "d_f0_stairs1": "cz-d0-east-stair", "d_f0_bridge_e": "cz-d0-east-stair",
    "d_f1_bridge_c": "cz-d1-bridge-c", "d_f1_corridor": "cz-d1-central-hall", "d_f1_stairs2": "cz-d1-north-hall", "d_f1_stairs1": "cz-d1-north-hall", "d_f1_bridge_e": "cz-d1-north-hall",
    "d_f2_bridge_e": "cz-d2-skywalk-e", "d_f2_corridor": "cz-d2-central-hall", "d_f2_stairs1": "cz-d2-east-lab", "d_f2_stairs2": "cz-d2-east-lab",
    "d_f3_corridor": "cz-d3-central-hall", "d_f3_stairs1": "cz-d3-east-stair", "d_f3_stairs2": "cz-d3-east-stair",
    "c_f0_ent_football": "cz-c0-south-lobby", "c_f0_ent_sc_block": "cz-c0-south-lobby", "block_c_football_entrance": "cz-c0-south-lobby", "block_c_sc_entrance": "cz-c0-south-lobby",
    "c_f0_stairs1": "cz-c0-north-lobby", "c_f0_stairs2": "cz-c0-north-lobby", "c_f0_stairs_1": "cz-c0-north-lobby", "c_f0_stairs_2": "cz-c0-north-lobby",
    "c_f0_corridor": "cz-c0-central-corridor", "c_f0_corridor_main": "cz-c0-central-corridor", "c_f0_bridge_d": "cz-c0-west-corridor", "c_f0_ent_block_d": "cz-c0-west-corridor",
    "c_f1_stairs1": "cz-c1-north-stair", "c_f1_corridor": "cz-c1-central-corridor", "c_f1_stairs2": "cz-c1-east-stair", "c_f1_bridge_d": "cz-c1-south-balcony",
    "c_f2_stairs1": "cz-c2-bridge", "c_f2_corridor": "cz-c2-central-corridor", "c_f2_stairs2": "cz-c2-north-study",
}

def get_zone_id_for_node(node_id: str) -> Optional[str]:
    return NODE_TO_CROWD_ZONE.get(node_id.strip()) if node_id else None

def get_floor_for_zone_id(zone_id: str) -> Optional[str]:
    if not zone_id or not zone_id.startswith("cz-"): return None
    parts = zone_id.split("-")
    if len(parts) >= 2:
        code = parts[1].upper()
        if len(code) >= 2 and code[0] in ("C", "D", "E"):
            return f"{code[0]}-F{code[1]}"
    return None

def get_zone_ids_for_edge(u: str, v: str) -> List[str]:
    zones=[]
    for node in (u,v):
        z=get_zone_id_for_node(node)
        if z and z not in zones: zones.append(z)
    return zones
