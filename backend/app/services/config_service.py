import os
import re
from pathlib import Path
from typing import Dict, Any, Optional

PROJECT_ROOT = Path(os.getenv("PROJECT_ROOT", Path(__file__).resolve().parent.parent.parent.parent))

ENV_FILE = PROJECT_ROOT / ".env"
OCI_DIR = PROJECT_ROOT / "oci"
OCI_CONFIG_FILE = OCI_DIR / "config"
OCI_KEY_FILE = OCI_DIR / "private-key.pem"
SSH_DIR = PROJECT_ROOT / "ssh"
SSH_KEYS_FILE = SSH_DIR / "authorized_keys"

def ensure_dirs():
    OCI_DIR.mkdir(parents=True, exist_ok=True)
    SSH_DIR.mkdir(parents=True, exist_ok=True)
    (PROJECT_ROOT / "data").mkdir(parents=True, exist_ok=True)

def read_env_file() -> Dict[str, str]:
    if not ENV_FILE.exists():
        return {}
    env_vars = {}
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env_vars[key.strip()] = value.strip().strip('"').strip("'")
    return env_vars

def write_env_file(data: Dict[str, str]):
    ensure_dirs()
    lines = [
        "# Telegram Notifications",
        f"TELEGRAM_BOT_TOKEN={data.get('TELEGRAM_BOT_TOKEN', '')}",
        f"TELEGRAM_CHAT_ID={data.get('TELEGRAM_CHAT_ID', '')}",
        "",
        "# Oracle Cloud Infrastructure Parameters",
        f"OCI_COMPARTMENT_ID={data.get('OCI_COMPARTMENT_ID', '')}",
        f"OCI_SUBNET_ID={data.get('OCI_SUBNET_ID', '')}",
        f"OCI_IMAGE_ID={data.get('OCI_IMAGE_ID', '')}",
        f"OCI_SSH_PUBLIC_KEY={data.get('OCI_SSH_PUBLIC_KEY', '')}",
    ]
    with open(ENV_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

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
    OCI_CONFIG_FILE.chmod(0o600)

def read_private_key() -> str:
    if not OCI_KEY_FILE.exists():
        return ""
    with open(OCI_KEY_FILE, "r", encoding="utf-8") as f:
        return f.read()

def write_private_key(key_content: str):
    ensure_dirs()
    key_content = key_content.strip()
    if key_content:
        with open(OCI_KEY_FILE, "w", encoding="utf-8") as f:
            f.write(key_content + "\n")
        OCI_KEY_FILE.chmod(0o600)

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
        "telegram_bot_token": env_vars.get("TELEGRAM_BOT_TOKEN", ""),
        "telegram_chat_id": env_vars.get("TELEGRAM_CHAT_ID", ""),
        "oci_user": oci_cfg.get("user", ""),
        "oci_fingerprint": oci_cfg.get("fingerprint", ""),
        "oci_tenancy": oci_cfg.get("tenancy", ""),
        "oci_region": oci_cfg.get("region", "eu-frankfurt-1"),
        "oci_compartment_id": env_vars.get("OCI_COMPARTMENT_ID", oci_cfg.get("tenancy", "")),
        "oci_subnet_id": env_vars.get("OCI_SUBNET_ID", ""),
        "oci_image_id": env_vars.get("OCI_IMAGE_ID", ""),
        "private_key": pem_key,
        "ssh_public_key": ssh_key or env_vars.get("OCI_SSH_PUBLIC_KEY", ""),
    }

def save_full_config(data: Dict[str, Any]):
    # Save .env
    env_data = {
        "TELEGRAM_BOT_TOKEN": data.get("telegram_bot_token", ""),
        "TELEGRAM_CHAT_ID": data.get("telegram_chat_id", ""),
        "OCI_COMPARTMENT_ID": data.get("oci_compartment_id", ""),
        "OCI_SUBNET_ID": data.get("oci_subnet_id", ""),
        "OCI_IMAGE_ID": data.get("oci_image_id", ""),
        "OCI_SSH_PUBLIC_KEY": data.get("ssh_public_key", ""),
    }
    write_env_file(env_data)

    # Save OCI config
    oci_data = {
        "user": data.get("oci_user", ""),
        "fingerprint": data.get("oci_fingerprint", ""),
        "tenancy": data.get("oci_tenancy", ""),
        "region": data.get("oci_region", "eu-frankfurt-1"),
    }
    write_oci_config(oci_data)

    # Save private key
    if "private_key" in data and data["private_key"].strip():
        write_private_key(data["private_key"])

    # Save SSH key
    if "ssh_public_key" in data:
        write_ssh_key(data["ssh_public_key"])
