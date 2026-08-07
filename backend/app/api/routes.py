import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.services import config_service, hunter_service, telegram_service, oci_service

router = APIRouter(prefix="/api")

class ConfigPayload(BaseModel):
    telegram_bot_token: Optional[str] = ""
    telegram_chat_id: Optional[str] = ""
    oci_user: Optional[str] = ""
    oci_fingerprint: Optional[str] = ""
    oci_tenancy: Optional[str] = ""
    oci_region: Optional[str] = "eu-frankfurt-1"
    oci_compartment_id: Optional[str] = ""
    oci_subnet_id: Optional[str] = ""
    oci_image_id: Optional[str] = ""
    private_key: Optional[str] = ""
    ssh_public_key: Optional[str] = ""

class TelegramTestPayload(BaseModel):
    telegram_bot_token: str
    telegram_chat_id: str

@router.get("/status")
def get_status():
    container_info = hunter_service.get_container_status()
    config_info = config_service.get_full_config()

    is_configured = bool(
        config_info.get("oci_user") and
        config_info.get("oci_fingerprint") and
        config_info.get("oci_tenancy") and
        config_info.get("private_key") and
        config_info.get("oci_subnet_id")
    )

    return {
        "status": container_info.get("status"),
        "detail": container_info.get("detail"),
        "success_marker": container_info.get("success_marker"),
        "is_configured": is_configured,
        "region": config_info.get("oci_region"),
        "subnet_id": config_info.get("oci_subnet_id")
    }

@router.websocket("/ws/status")
async def websocket_status(websocket: WebSocket):
    await websocket.accept()
    last_status = None
    try:
        while True:
            st = get_status()
            if st != last_status:
                last_status = st
                await websocket.send_json({"type": "STATUS", "data": st})
            await asyncio.sleep(4)
    except (WebSocketDisconnect, Exception):
        pass

@router.get("/config")
def get_config():
    return config_service.get_full_config()

@router.post("/config")
def update_config(payload: ConfigPayload):
    try:
        data = payload.model_dump()
        config_service.save_full_config(data)
        return {"success": True, "message": "Configuration saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/hunter/start")
def start_hunter():
    result = hunter_service.start_hunter()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.post("/hunter/stop")
def stop_hunter():
    result = hunter_service.stop_hunter()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.post("/hunter/reset")
def reset_marker():
    removed = hunter_service.clear_success_marker()
    return {
        "success": True,
        "message": "Success marker cleared successfully." if removed else "No success marker was found."
    }

@router.post("/test/telegram")
def test_telegram(payload: TelegramTestPayload):
    result = telegram_service.send_telegram_test(
        payload.telegram_bot_token,
        payload.telegram_chat_id
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.post("/test/oci")
def test_oci():
    result = oci_service.test_oci_connection()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.get("/logs")
def get_logs(lines: int = 150):
    return {"logs": hunter_service.get_recent_logs(lines)}
