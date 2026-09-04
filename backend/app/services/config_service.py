import os
import re
from pathlib import Path
from typing import Dict, Any, Optional

PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", Path(__file__).resolve().parent.parent.parent.parent))

ENV_FILE = PROJECT_ROOT / "data" / ".env"
LEGACY_ENV_FILE = PROJECT_ROOT / ".env"
OCI_DIR = PROJECT_ROOT / "oci"
OCI_CONFIG_FILE = OCI_DIR / "config"
OCI_KEY_FILE = OCI_DIR / "private-key.pem"
SSH_DIR = PROJECT_ROOT / "ssh"
SSH_KEYS_FILE = SSH_DIR / "authorized_keys"

def ensure_dirs():
    OCI_DIR.mkdir(parents=True, exist_ok=True)
    OCI_DIR.chmod(0o755)
    SSH_DIR.mkdir(parents=True, exist_ok=True)
    SSH_DIR.chmod(0o755)
    data_dir = PROJECT_ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    data_dir.chmod(0o755)

    # Ensure root .env and data .env exist so Docker Compose never errors on missing env file
    root_env = PROJECT_ROOT / ".env"
    if not root_env.exists():
        try:
            root_env.write_text("# Oracle A1 Hunter Environment\n")
            root_env.chmod(0o644)
        except Exception:
            pass

    data_env = data_dir / ".env"
    if not data_env.exists():
        try:
            data_env.write_text("# Oracle A1 Hunter Data Environment\n")
            data_env.chmod(0o644)
        except Exception:
            pass

    # Ensure fresh hunter.sh script is synced atomically to data directory
    src_script = PROJECT_ROOT / "hunter.sh"
    target_script = data_dir / "hunter.sh"
    temp_script = data_dir / "hunter.sh.tmp"
    if src_script.exists() and src_script.is_file():
        import shutil
        shutil.copy2(src_script, temp_script)
        temp_script.chmod(0o755)
        shutil.move(temp_script, target_script)

    if OCI_CONFIG_FILE.exists():
        OCI_CONFIG_FILE.chmod(0o644)
    if OCI_KEY_FILE.exists():
        OCI_KEY_FILE.chmod(0o644)

def read_env_file() -> Dict[str, str]:
    target_env = ENV_FILE if ENV_FILE.exists() else (LEGACY_ENV_FILE if LEGACY_ENV_FILE.exists() and not LEGACY_ENV_FILE.is_dir() else None)
    if not target_env:
        return {}
    env_vars = {}
    with open(target_env, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip().strip('"').strip("'")
    return env_vars

def write_env_file(data: Dict[str, str]):
    ensure_dirs()
    def quote_val(val: str) -> str:
        clean = str(val or "").strip().replace('"', '\\"').replace('\n', ' ')
        return f'"{clean}"'

    lines = [
        "# Telegram Notifications",
        f"TELEGRAM_BOT_TOKEN={quote_val(data.get('TELEGRAM_BOT_TOKEN', ''))}",
        f"TELEGRAM_CHAT_ID={quote_val(data.get('TELEGRAM_CHAT_ID', ''))}",
        "",
        "# Oracle Cloud Infrastructure Parameters",
        f"OCI_COMPARTMENT_ID={quote_val(data.get('OCI_COMPARTMENT_ID', ''))}",
        f"OCI_SUBNET_ID={quote_val(data.get('OCI_SUBNET_ID', ''))}",
        f"OCI_IMAGE_ID={quote_val(data.get('OCI_IMAGE_ID', ''))}",
        f"OCI_OCPUS={quote_val(data.get('OCI_OCPUS', '4'))}",
        f"OCI_MEMORY_GB={quote_val(data.get('OCI_MEMORY_GB', '24'))}",
        f"HUNTER_MODE={quote_val(data.get('HUNTER_MODE', 'GRADUAL'))}",
        f"OCI_SSH_PUBLIC_KEY={quote_val(data.get('OCI_SSH_PUBLIC_KEY', ''))}",
    ]
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    ENV_FILE.chmod(0o644)

def read_oci_config() -> Dict[str, str]:
    if not OCI_CONFIG_FILE.exists():
        return {}
    config_dict = {}
    with open(OCI_CONFIG_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("[") and "=" in line:
                key, val = line.split("=", 1)
                config_dict[key.strip()] = val.strip()
    return config_dict

def write_oci_config(data: Dict[str, str]):
    ensure_dirs()
    user = data.get("user", "")
    fingerprint = data.get("fingerprint", "")
    tenancy = data.get("tenancy", "")
    region = data.get("region", "eu-frankfurt-1")
    
    # Always keep container path for key_file
    key_file_path = "/oracle/.oci/private-key.pem"

    content = f"""[DEFAULT]
user={user}
fingerprint={fingerprint}
tenancy={tenancy}
region={region}
key_file={key_file_path}
"""
    with open(OCI_CONFIG_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    OCI_CONFIG_FILE.chmod(0o644)

def read_private_key() -> str:
    if not OCI_KEY_FILE.exists():
        return ""
    with open(OCI_KEY_FILE, "r", encoding="utf-8") as f:
        return f.read()

def write_private_key(key_content: str):
    ensure_dirs()
    key_content = (key_content or "").strip()
    if key_content:
        # Convert literal '\n' or '\\n' text strings into real line breaks
        key_content = key_content.replace("\\n", "\n")

        # Automatically strip trailing variable names/junk text after -----END ... PRIVATE KEY-----
        end_match = re.search(r'(-----END [A-Z ]+-----)', key_content)
        if end_match:
            end_pos = end_match.end()
            key_content = key_content[:end_pos]

        # Ensure proper PEM header/footer formatting if missing line breaks
        if "-----BEGIN" in key_content and "\n" not in key_content:
            key_content = re.sub(r'(-----BEGIN [A-Z ]+-----)\s*', r'\1\n', key_content)
            key_content = re.sub(r'\s*(-----END [A-Z ]+-----)', r'\n\1', key_content)

        with open(OCI_KEY_FILE, "w", encoding="utf-8") as f:
            f.write(key_content.strip() + "\n")
        OCI_KEY_FILE.chmod(0o644)

def read_ssh_key() -> str:
    if not SSH_KEYS_FILE.exists():
        return ""
    with open(SSH_KEYS_FILE, "r", encoding="utf-8") as f:
        return f.read().strip()

def write_ssh_key(ssh_content: str):
    ensure_dirs()
    ssh_content = ssh_content.strip()
    with open(SSH_KEYS_FILE, "w", encoding="utf-8") as f:
        f.write(ssh_content + "\n" if ssh_content else "")

def get_full_config() -> Dict[str, Any]:
    env_vars = read_env_file()
    oci_cfg = read_oci_config()
    pem_key = read_private_key()
    ssh_key = read_ssh_key()

    return {
        "telegram_bot_token": env_vars.get("TELEGRAM_BOT_TOKEN", "").strip(),
        "telegram_chat_id": env_vars.get("TELEGRAM_CHAT_ID", "").strip(),
        "oci_user": oci_cfg.get("user", "").strip(),
        "oci_fingerprint": oci_cfg.get("fingerprint", "").strip(),
        "oci_tenancy": oci_cfg.get("tenancy", "").strip(),
        "oci_region": oci_cfg.get("region", "eu-frankfurt-1").strip(),
        "oci_compartment_id": env_vars.get("OCI_COMPARTMENT_ID", oci_cfg.get("tenancy", "")).strip(),
        "oci_subnet_id": env_vars.get("OCI_SUBNET_ID", "").strip(),
        "oci_image_id": env_vars.get("OCI_IMAGE_ID", "").strip(),
        "oci_ocpus": env_vars.get("OCI_OCPUS", "1").strip(),
        "oci_memory_gb": env_vars.get("OCI_MEMORY_GB", "6").strip(),
        "hunter_mode": env_vars.get("HUNTER_MODE", "QUAD_1C6G").strip(),
        "oci_ad_list": env_vars.get("OCI_AD_LIST", "").strip(),
        "private_key": pem_key,
        "ssh_public_key": ssh_key or env_vars.get("OCI_SSH_PUBLIC_KEY", "").strip(),
    }

def save_full_config(data: Dict[str, Any]):
    compartment_id = (data.get("oci_compartment_id", "") or "").strip() or (data.get("oci_tenancy", "") or "").strip()
    # Save .env
    env_data = {
        "TELEGRAM_BOT_TOKEN": (data.get("telegram_bot_token", "") or "").strip(),
        "TELEGRAM_CHAT_ID": (data.get("telegram_chat_id", "") or "").strip(),
        "OCI_COMPARTMENT_ID": compartment_id,
        "OCI_SUBNET_ID": (data.get("oci_subnet_id", "") or "").strip(),
        "OCI_IMAGE_ID": (data.get("oci_image_id", "") or "").strip(),
        "OCI_OCPUS": (data.get("oci_ocpus", "1") or "").strip(),
        "OCI_MEMORY_GB": (data.get("oci_memory_gb", "6") or "").strip(),
        "HUNTER_MODE": (data.get("hunter_mode", "QUAD_1C6G") or "").strip(),
        "OCI_AD_LIST": (data.get("oci_ad_list", "") or "").strip(),
        "OCI_SSH_PUBLIC_KEY": (data.get("ssh_public_key", "") or "").strip(),
    }
    write_env_file(env_data)

    # Save OCI config
    oci_data = {
        "user": (data.get("oci_user", "") or "").strip(),
        "fingerprint": (data.get("oci_fingerprint", "") or "").strip(),
        "tenancy": (data.get("oci_tenancy", "") or "").strip(),
        "region": (data.get("oci_region", "eu-frankfurt-1") or "").strip(),
    }
    write_oci_config(oci_data)

    # Save private key
    if "private_key" in data and str(data["private_key"]).strip():
        write_private_key(str(data["private_key"]))

    # Save SSH key
    if "ssh_public_key" in data:
        write_ssh_key(str(data["ssh_public_key"]))
