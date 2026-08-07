import os
import subprocess
from pathlib import Path
from typing import Dict, Any, List

PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", Path(__file__).resolve().parent.parent.parent.parent))
DATA_DIR = PROJECT_ROOT / "data"
SUCCESS_MARKER = DATA_DIR / "success"
LOG_FILE = DATA_DIR / "hunter.log"

def get_compose_cmd() -> List[str]:
    compose_file = PROJECT_ROOT / "docker-compose.yml"
    if not compose_file.exists():
        alt = Path("/app/docker-compose.yml")
        if alt.exists():
            compose_file = alt

    env_file = DATA_DIR / ".env"
    if not env_file.exists():
        env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        try:
            env_file.write_text("# env\n")
        except Exception:
            pass

    cmd = ["docker", "compose"]
    if env_file.exists():
        cmd.extend(["--env-file", str(env_file)])
    if compose_file.exists():
        cmd.extend(["-f", str(compose_file)])
    return cmd

def is_success_marker_present() -> bool:
    return SUCCESS_MARKER.exists()

def clear_success_marker() -> bool:
    if SUCCESS_MARKER.exists():
        SUCCESS_MARKER.unlink()
        return True
    return False

def get_hunter_container_id() -> str:
    try:
        res = subprocess.run(
            ["docker", "ps", "-a", "--filter", "label=com.docker.compose.service=hunter", "--format", "{{.ID}}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        lines = [l.strip() for l in res.stdout.strip().split("\n") if l.strip()]
        return lines[0] if lines else ""
    except Exception:
        return ""

def get_container_status() -> Dict[str, Any]:
    # Check via docker ps filtering by compose service label
    try:
        res = subprocess.run(
            ["docker", "ps", "-a", "--filter", "label=com.docker.compose.service=hunter", "--format", "{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=5
        )
        status_str = res.stdout.strip()
        if status_str:
            is_running = status_str.startswith("Up")
            return {
                "status": "RUNNING" if is_running else "STOPPED",
                "detail": status_str,
                "success_marker": is_success_marker_present()
            }
    except Exception:
        pass

    # Check via docker compose ps
    try:
        cmd = get_compose_cmd() + ["ps", "hunter", "--format", "json"]
        res = subprocess.run(
            cmd,
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
        return {
            "status": "UNKNOWN",
            "detail": str(e),
            "success_marker": is_success_marker_present()
        }

    return {
        "status": "IDLE",
        "detail": "Container not created",
        "success_marker": is_success_marker_present()
    }

from app.services.config_service import ensure_dirs

def start_hunter() -> Dict[str, Any]:
    try:
        ensure_dirs()

        # 1. Try starting existing container directly if found by label
        cid = get_hunter_container_id()
        if cid:
            res_start = subprocess.run(
                ["docker", "start", cid],
                capture_output=True,
                text=True,
                timeout=10
            )
            if res_start.returncode == 0:
                return {"success": True, "message": "Hunter container started successfully."}

        # 2. Fallback to docker compose up -d --no-recreate hunter
        cmd = get_compose_cmd() + ["up", "-d", "--no-recreate", "hunter"]
        res = subprocess.run(
            cmd,
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
        cid = get_hunter_container_id()
        if cid:
            res_stop = subprocess.run(
                ["docker", "stop", cid],
                capture_output=True,
                text=True,
                timeout=15
            )
            if res_stop.returncode == 0:
                return {"success": True, "message": "Hunter container stopped successfully."}

        cmd = get_compose_cmd() + ["stop", "hunter"]
        res = subprocess.run(
            cmd,
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
    # Try docker logs by container ID first
    cid = get_hunter_container_id()
    if cid:
        try:
            res = subprocess.run(
                ["docker", "logs", "--tail", str(lines), cid],
                capture_output=True,
                text=True,
                timeout=5
            )
            if res.returncode == 0 and res.stdout.strip():
                return res.stdout.strip().split("\n")
        except Exception:
            pass

    # Try docker compose logs
    try:
        cmd = get_compose_cmd() + ["logs", "--tail", str(lines), "hunter"]
        res = subprocess.run(
            cmd,
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
