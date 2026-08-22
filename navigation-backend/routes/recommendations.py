import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from pydantic import BaseModel, Field

from services.vision_model import AccessibilityDetector

router = APIRouter()
detector = AccessibilityDetector()

TEMP_DIR = "data/temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)

# In-memory dynamic queue for live AI-evaluated campus reports
LIVE_RECOMMENDATIONS: List[Dict[str, Any]] = []

class RecommendationCreate(BaseModel):
    buildingId: str = "bldg-iter-main"
    buildingName: str = "SOA ITER Academic Block C"
    title: str
    problem: str
    solution: str
    severity: str = "High"
    priority: str = "High"
    disabilityTypesAffected: List[str] = ["wheelchair"]
    estimatedUsersAffected: int = 150
    costCategory: str = "Low"
    estimatedCostAmount: str = "₹1,500 - ₹3,500"
    expectedImpact: str = "High"
    impactScore: int = 85
    status: str = "Pending"
    floorId: int = 0
    locationName: str = "Campus Facility"

class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Pending | In Progress | Completed")

@router.get("/recommendations")
def get_recommendations(buildingId: Optional[str] = None):
    """Returns dynamic recommendations from live user reports."""
    if buildingId:
        return [r for r in LIVE_RECOMMENDATIONS if r.get("buildingId") == buildingId]
    return list(LIVE_RECOMMENDATIONS)

@router.post("/reports/analyze")
@router.post("/recommendations/analyze")
async def analyze_and_queue_report(
    file: Optional[UploadFile] = File(None),
    user_query: str = Form(""),
    building_name: str = Form("SOA ITER Academic Block C"),
    building_id: str = Form("bldg-iter-main"),
    floor_id: int = Form(0),
    reporter_name: str = Form("Campus Reporter"),
    disability_type: str = Form("wheelchair"),
    report_id: Optional[str] = Form(None)
):
    """Analyzes user complaint + photo using SOA-AccessTwin AI and generates a real Fix Suggestion."""
    if report_id:
        for existing in LIVE_RECOMMENDATIONS:
            if existing.get("reportId") == report_id or existing.get("report_id") == report_id:
                return {
                    "status": "success",
                    "message": "Recommendation already exists for this verified report.",
                    "data": existing
                }

    temp_path = os.path.join(TEMP_DIR, f"rep_{uuid.uuid4().hex}.jpg")
    
    try:
        if file and file.filename:
            content = await file.read()
            with open(temp_path, "wb") as f:
                f.write(content)
        else:
            with open(temp_path, "wb") as f:
                f.write(b"")

        ai_eval = detector.analyze_user_report(
            image_path=temp_path,
            user_description=user_query,
            location=building_name
        )

        rec_id = f"rec-{uuid.uuid4().hex[:8]}"
        detected_problem = ai_eval.get("detected_problem") or user_query or "Reported accessibility barrier"
        recommended_fix = ai_eval.get("recommended_fix") or "Repair and make pathway barrier-free"
        priority_val = ai_eval.get("priority", "High")
        cost_val = ai_eval.get("estimated_cost_inr", "₹1,500 - ₹3,500")
        impact_val = ai_eval.get("impact_score", 88)
        cost_cat = ai_eval.get("cost_category", "Low")
        disabilities = ai_eval.get("disability_types_affected", [disability_type] if disability_type else ["wheelchair"])
        users_affected = ai_eval.get("estimated_users_affected", 180)

        new_card = {
            "id": rec_id,
            "reportId": report_id,
            "buildingId": building_id,
            "buildingName": building_name,
            "title": f"Fix: {detected_problem[:60]}",
            "problem": detected_problem,
            "solution": recommended_fix,
            "severity": priority_val,
            "priority": priority_val,
            "disabilityTypesAffected": disabilities,
            "estimatedUsersAffected": users_affected,
            "costCategory": cost_cat,
            "estimatedCostAmount": cost_val,
            "expectedImpact": "High" if impact_val >= 80 else "Medium",
            "impactScore": impact_val,
            "status": "Pending",
            "floorId": floor_id,
            "locationName": building_name,
            "ai_verified": ai_eval.get("is_verified", True)
        }

        # Prepend to live recommendations
        LIVE_RECOMMENDATIONS.insert(0, new_card)

        return {
            "status": "success",
            "message": "Report analyzed and fix recommendation queued.",
            "data": {
                "id": rec_id,
                "reportId": report_id,
                "buildingId": building_id,
                "buildingName": building_name,
                "title": new_card["title"],
                "problem": detected_problem,
                "solution": recommended_fix,
                "ai_verified": ai_eval.get("is_verified", True),
                "verification_status": "AI_VERIFIED" if ai_eval.get("is_verified", True) else "FLAGGED",
                "confidence": int(float(ai_eval.get("confidence", 0.92)) * 100),
                "type": ai_eval.get("issue_type", "Service Barrier"),
                "issue": detected_problem,
                "recommendation": recommended_fix,
                "estimated_cost_inr": cost_val,
                "costCategory": cost_cat,
                "priority": priority_val,
                "impact_score": impact_val,
                "disability_types_affected": disabilities,
                "estimated_users_affected": users_affected,
                "voice_message": ai_eval.get("voice_message", f"Report analyzed. Estimated remediation cost is {cost_val}.")
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.post("/recommendations")
def create_recommendation(payload: RecommendationCreate):
    """Creates a real recommendation in the active queue."""
    rec_id = f"rec-{uuid.uuid4().hex[:8]}"
    item = payload.dict()
    item["id"] = rec_id
    LIVE_RECOMMENDATIONS.insert(0, item)
    return item

@router.patch("/recommendations/{rec_id}/status")
def update_recommendation_status(rec_id: str, payload: StatusUpdateRequest):
    """Updates recommendation implementation state."""
    if payload.status not in ["Pending", "In Progress", "Completed"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be Pending, In Progress, or Completed.")
    
    for r in LIVE_RECOMMENDATIONS:
        if r.get("id") == rec_id:
            r["status"] = payload.status
            return r
            
    raise HTTPException(status_code=404, detail="Recommendation not found in active queue.")

@router.delete("/recommendations/{rec_id}")
def delete_recommendation(rec_id: str):
    """Deletes a recommendation from the queue."""
    global LIVE_RECOMMENDATIONS
    LIVE_RECOMMENDATIONS = [r for r in LIVE_RECOMMENDATIONS if r.get("id") != rec_id]
    return {"status": "success", "message": "Recommendation removed."}

@router.delete("/recommendations")
def clear_all_recommendations():
    """Clears all recommendations in memory."""
    global LIVE_RECOMMENDATIONS
    LIVE_RECOMMENDATIONS.clear()
    return {"status": "success", "message": "All recommendations cleared."}