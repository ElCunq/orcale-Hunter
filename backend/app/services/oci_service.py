import os
from pathlib import Path
from typing import Dict, Any
from app.services.config_service import PROJECT_ROOT, read_oci_config, read_env_file

def test_oci_connection() -> Dict[str, Any]:
    oci_cfg = read_oci_config()
    env_cfg = read_env_file()

    tenancy = oci_cfg.get("tenancy", "") or env_cfg.get("OCI_COMPARTMENT_ID", "")
    user = oci_cfg.get("user", "")
    fingerprint = oci_cfg.get("fingerprint", "")
    region = oci_cfg.get("region", "eu-frankfurt-1")

    key_file = PROJECT_ROOT / "oci" / "private-key.pem"

    if not tenancy or not user or not fingerprint or not key_file.exists():
        return {
            "success": False,
            "message": "OCI kimlik bilgileri (User, Tenancy, Fingerprint) veya private-key.pem dosyası eksik. Lütfen tüm alanları doldurun."
        }

    config = {
        "user": user,
        "fingerprint": fingerprint,
        "tenancy": tenancy,
        "region": region,
        "key_file": str(key_file)
    }

    try:
        import oci
        try:
            identity_client = oci.identity.IdentityClient(config)
            response = identity_client.list_availability_domains(tenancy)
            ads_list = [ad.name for ad in response.data]
            return {
                "success": True,
                "message": f"OCI API Bağlantısı Başarılı! {len(ads_list)} Availability Domain doğrulandı.",
                "availability_domains": ads_list
            }
        except Exception as identity_err:
            try:
                compute_client = oci.core.ComputeClient(config)
                shapes_resp = compute_client.list_shapes(tenancy)
                ads_list = list(set([s.availability_domain for s in shapes_resp.data if getattr(s, 'availability_domain', None)]))
                if ads_list:
                    return {
                        "success": True,
                        "message": f"OCI API Bağlantısı Başarılı (Compute API)! {len(ads_list)} Availability Domain doğrulandı.",
                        "availability_domains": ads_list
                    }
            except Exception:
                pass
            raise identity_err
    except Exception as e:
        err_msg = str(e)
        if "Invalid" in err_msg or "NotAuthorizedOrNotFound" in err_msg or "401" in err_msg:
            return {
                "success": False,
                "message": f"OCI API Kimlik Doğrulama Hatası (401/404): Girilen User OCID, Tenancy OCID, Fingerprint veya Private Key uyumsuz! Detay: {err_msg}"
            }
        return {
            "success": False,
            "message": f"OCI API Test Hatası: {err_msg}"
        }
