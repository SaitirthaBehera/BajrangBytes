from typing import Optional,Dict,Any
from fastapi import APIRouter,Path,Query
from services.crowd_service import get_floor_crowd_density
router=APIRouter()
@router.get('/crowd-density/{floor_id}')
def get_crowd_density(floor_id:str=Path(...),source:Optional[str]=Query(None))->Dict[str,Any]:
 return get_floor_crowd_density(floor_id,source)
