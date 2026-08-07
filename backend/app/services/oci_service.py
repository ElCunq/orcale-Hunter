import subprocess
from pathlib import Path
from typing import Dict, Any
from app.services.config_service import PROJECT_ROOT, read_oci_config, read_env_file

def test_oci_connection() -> Dict[str, Any]:
    oci_cfg = read_oci_config()
    env_cfg = read_env_file()

    tenancy = oci_cfg.get("tenancy", "") or env_cfg.get("OCI_COMPARTMENT_ID", "")
    if not tenancy:
        return {"success": False, "message": "OCI Tenancy / Compartment ID is missing in configuration."}

    # Test via docker container run using mounted config
    cmd = [
        "docker", "run", "--rm",
        "-v", f"{PROJECT_ROOT}/oci:/oracle/.oci",
        "ghcr.io/oracle/oci-cli:latest",
        "iam", "availability-domain", "list",
        "--compartment-id", tenancy,
        "--query", "data[].name",
        "--raw-output"
    ]

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        if res.returncode == 0:
            ads_raw = res.stdout.strip().replace("[", "").replace("]", "").replace('"', '').replace(',', ' ')
            ads_list = [ad.strip() for ad in ads_raw.split() if ad.strip()]
            return {
                "success": True,
                "message": f"Successfully connected to OCI API! Found {len(ads_list)} Availability Domains.",
                "availability_domains": ads_list
            }
        else:
            return {
                "success": False,
                "message": f"OCI API Test failed: {res.stderr or res.stdout}"
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Execution error testing OCI connection: {str(e)}"
        }
