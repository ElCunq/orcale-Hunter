import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List

PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", Path(__file__).resolve().parent.parent.parent.parent))
DATA_DIR = PROJECT_ROOT / "data"
SUCCESS_MARKER = DATA_DIR / "success"
LOG_FILE = DATA_DIR / "hunter.log"

def is_success_marker_present() -> bool:
    return SUCCESS_MARKER.exists()

def clear_success_marker() -> bool:
    if SUCCESS_MARKER.exists():
        SUCCESS_MARKER.unlink()
        return True
    return False

def get_container_status() -> Dict[str, Any]:
    # Check via docker compose ps or docker ps
    try:
        res = subprocess.run(
            ["docker", "compose", "ps", "hunter", "--format", "json"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=5
        )
        if res.returncode == 0 and res.stdout.strip():
            output = res.stdout.strip()
            is_running = "running" in output.lower() or "Up" in output
            return {
                "status": "RUNNING" if is_running else "STOPPED",
                "detail": output,
                "success_marker": is_success_marker_present()
            }
    except Exception as e:
        pass

    # Fallback to docker ps filter by container name oracle-a1-hunter
    try:
        res = subprocess.run(
            ["docker", "ps", "-a", "--filter", "name=oracle-a1-hunter", "--format", "{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        status_str = res.stdout.strip()
        is_running = status_str.startswith("Up")
        return {
            "status": "RUNNING" if is_running else ("STOPPED" if status_str else "IDLE"),
            "detail": status_str or "Container not created",
            "success_marker": is_success_marker_present()
        }
    except Exception as e:
        return {
            "status": "UNKNOWN",
            "detail": str(e),
            "success_marker": is_success_marker_present()
        }

from app.services.config_service import ensure_dirs

def start_hunter() -> Dict[str, Any]:
    try:
        ensure_dirs()
        # Run docker compose up -d hunter
        res = subprocess.run(
            ["docker", "compose", "up", "-d", "hunter"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=30
        )
        if res.returncode == 0:
            return {"success": True, "message": "Hunter container started successfully."}
        else:
            return {"success": False, "message": res.stderr or res.stdout}
    except Exception as e:
        return {"success": False, "message": str(e)}

def stop_hunter() -> Dict[str, Any]:
    try:
        res = subprocess.run(
            ["docker", "compose", "stop", "hunter"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=30
        )
        if res.returncode == 0:
            return {"success": True, "message": "Hunter container stopped successfully."}
        else:
            return {"success": False, "message": res.stderr or res.stdout}
    except Exception as e:
        return {"success": False, "message": str(e)}

def get_recent_logs(lines: int = 100) -> List[str]:
    # Try docker compose logs first
    try:
        res = subprocess.run(
            ["docker", "compose", "logs", "--tail", str(lines), "hunter"],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True,
            timeout=5
        )
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip().split("\n")
    except Exception:
        pass

    # Fallback to reading LOG_FILE if exists
    if LOG_FILE.exists():
        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
            return [line.strip() for line in all_lines[-lines:]]

    return ["No logs available yet. Start the hunter service to see live logs."]
