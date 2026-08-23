from enum import Enum
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.accessibility_router import router_engine

router = APIRouter()

# Clean Campus Dropdowns for Swagger UI
class CampusNode(str, Enum):
    MAIN_ENTRANCE = "main_entrance"
    BLOCK_A = "block_a_entrance"
    BLOCK_B = "block_b_entrance"
    BLOCK_C = "block_c_entrance"
    BLOCK_D = "block_d_entrance"
    BLOCK_E = "block_e_entrance"
    BLOCK_F = "block_f_entrance"
    DATA_SCIENCE_BLOCK = "ds_block_entrance"
    AUDITORIUM = "auditorium_entrance"
    SC_BLOCK = "sc_block_entrance"
    LIBRARY = "library_entrance"
    CAFETERIA = "iter_cafeteria"
    FOOTBALL_GROUND = "football_ground"
    CRICKET_GROUND = "cricket_ground"
    PARKING = "parking_area"
    ROUNDABOUT = "roundabout"

class DisabilityProfile(str, Enum):
    WHEELCHAIR = "wheelchair"
    BLIND = "blind"
    STANDARD = "standard"

class NavigateRequest(BaseModel):
    startNodeId: Optional[str] = None
    targetNodeId: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    profile: Optional[str] = "wheelchair"

def _normalize_node_id(node_id: Optional[str]) -> str:
    if not node_id:
        return "main_entrance"
    n = node_id.strip().lower()
    if "library" in n:
        return "library_entrance"
    if "auditorium" in n:
        return "auditorium_entrance"
    if "cafeteria" in n:
        return "iter_cafeteria"
    if "block-a" in n or "block_a" in n:
        return "block_a_entrance"
    if "block-b" in n or "block_b" in n:
        return "block_b_entrance"
    if "block-c" in n or "block_c" in n:
        return "block_c_entrance"
    if "block-d" in n or "block_d" in n:
        return "block_d_entrance"
    if "block-e" in n or "block_e" in n:
        return "block_e_entrance"
    return n

def _build_route_response(start_id: str, end_id: str, profile: str) -> Dict[str, Any]:
    route_result = router_engine.find_route(
        start_id=start_id,
        end_id=end_id,
        user_profile=profile
    )

    if not route_result or "error" in route_result:
        raise HTTPException(
            status_code=404,
            detail=route_result.get("error", f"No accessible route found between '{start_id}' and '{end_id}' for {profile} profile.")
        )

    total_dist = route_result.get("total_distance_meters", 0)
    est_mins = route_result.get("estimated_time_minutes", 1)
    path_nodes = route_result.get("path_nodes", [])
    raw_steps = route_result.get("step_by_step_directions", [])
    floors_involved = route_result.get("floors_involved", [0])
    floor_transitions = route_result.get("floor_transitions", [])
    voice_msg = route_result.get("voice_navigation", "")
    accessible_features = route_result.get("accessible_features_used", [])
    route_type_label = route_result.get("route_type_label", "Accessible Route")

    formatted_steps = []
    for i, step_text in enumerate(raw_steps):
        node_id = path_nodes[i] if i < len(path_nodes) else end_id
        formatted_steps.append({
            "stepNumber": i + 1,
            "instruction": step_text,
            "floorId": 0,
            "floorName": "Ground Floor",
            "distanceMeters": int(total_dist / max(1, len(raw_steps))),
            "nodeId": node_id,
            "featureTypeUsed": "ramp" if "ramp" in step_text.lower() else "lift" if "elevator" in step_text.lower() else "bridge" if "bridge" in step_text.lower() else "corridor"
        })

    return {
        "status": "success",
        "start_location": start_id,
        "end_location": end_id,
        "profile_used": profile,
        "total_distance_meters": total_dist,
        "estimated_time_minutes": est_mins,
        "floors_involved": floors_involved,
        "floor_transitions": floor_transitions,
        "path_nodes": path_nodes,
        "step_by_step_directions": raw_steps,
        "voice_navigation": voice_msg,
        "accessible_features_used": accessible_features,
        "route_type_label": route_type_label,
        "warnings": route_result.get("warnings", []),
        # Legacy/Twin digital map fields for UI compatibility
        "fromNode": {
            "id": start_id,
            "name": start_id.replace("_", " ").title(),
            "floorId": floors_involved[0] if floors_involved else 0,
            "buildingId": "soa_iter_campus",
            "type": "entrance",
            "isAccessible": True,
            "x": 20,
            "y": 20
        },
        "toNode": {
            "id": end_id,
            "name": end_id.replace("_", " ").title(),
            "floorId": floors_involved[-1] if floors_involved else 0,
            "buildingId": "soa_iter_campus",
            "type": "room",
            "isAccessible": True,
            "x": 80,
            "y": 80
        },
        "profile": profile,
        "totalDistanceMeters": total_dist,
        "estimatedMinutes": est_mins,
        "pathNodeIds": path_nodes,
        "steps": formatted_steps,
    }

@router.post("/navigate")
async def post_accessible_route(payload: NavigateRequest):
    start_id = _normalize_node_id(payload.startNodeId or payload.start)
    end_id = _normalize_node_id(payload.targetNodeId or payload.end or "library_entrance")
    profile = (payload.profile or "wheelchair").lower()
    return _build_route_response(start_id, end_id, profile)

@router.get("/navigate")
def get_accessible_route(
    start: str = Query("main_entrance", description="Select start location"),
    end: str = Query("library_entrance", description="Select destination"),
    profile: DisabilityProfile = Query(DisabilityProfile.WHEELCHAIR, description="Select accessibility profile")
):
    start_id = _normalize_node_id(start)
    end_id = _normalize_node_id(end)
    return _build_route_response(start_id, end_id, profile.value)