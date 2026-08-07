#!/usr/bin/env bash
set -e

SUCCESS_MARKER="/data/success"

# 1. Success marker check
if [ -f "$SUCCESS_MARKER" ]; then
    echo "[INFO] Success marker found ($SUCCESS_MARKER). Instance has already been launched. Exiting."
    exit 0
fi

# Load environment variables from persistent storage
if [ -f "/data/.env" ]; then
    set -a
    source /data/.env
    set +a
elif [ -f "/.env" ] && [ ! -d "/.env" ]; then
    set -a
    source /.env
    set +a
fi

# 2. Telegram notification helper
telegram() {
    local msg="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${msg}" >/dev/null 2>&1 || true
    fi
}

# 3. Resolve Compartment ID
if [ -z "$OCI_COMPARTMENT_ID" ]; then
    OCI_COMPARTMENT_ID=$(grep -E '^tenancy=' /oracle/.oci/config | head -n1 | cut -d'=' -f2 | tr -d ' \r')
fi

if [ -z "$OCI_COMPARTMENT_ID" ]; then
    echo "[ERROR] OCI_COMPARTMENT_ID is missing and could not be parsed from /oracle/.oci/config!"
    telegram "❌ Oracle A1 Hunter Hata: OCI_COMPARTMENT_ID tanımlanmamış ve config dosyasından okunamadı."
    exit 1
fi

echo "[INFO] Compartment ID: $OCI_COMPARTMENT_ID"

# Send startup notification
telegram "🚀 Oracle A1 Hunter servisi başlatıldı. Target: VM.Standard.A1.Flex (2 OCPU, 12GB RAM, 200GB Boot Disk)"

# 4. SSH Key setup
AUTHORIZED_KEYS_PATH="/tmp/authorized_keys"
if [ -n "$OCI_SSH_PUBLIC_KEY" ]; then
    echo "$OCI_SSH_PUBLIC_KEY" > "$AUTHORIZED_KEYS_PATH"
elif [ -f "/ssh/authorized_keys" ]; then
    cp /ssh/authorized_keys "$AUTHORIZED_KEYS_PATH"
else
    echo "[ERROR] SSH public key not provided in OCI_SSH_PUBLIC_KEY env or /ssh/authorized_keys!"
    telegram "❌ Oracle A1 Hunter Hata: SSH Public Key bulunamadı! Lütfen .env veya ssh/authorized_keys dosyasını ayarlayın."
    exit 1
fi

# 5. Check if hermes-vps instance already exists
echo "[INFO] Existing instance 'hermes-vps' check running..."
EXISTING_INSTANCES=$(oci compute instance list \
    --compartment-id "$OCI_COMPARTMENT_ID" \
    --display-name "hermes-vps" \
    --query "data[?\"lifecycle-state\"=='RUNNING' || \"lifecycle-state\"=='PROVISIONING' || \"lifecycle-state\"=='STARTING'].id" \
    --output json 2>/dev/null || echo "[]")

EXISTING_COUNT=$(echo "$EXISTING_INSTANCES" | grep -c "ocid1.instance" || true)

if [ "$EXISTING_COUNT" -gt 0 ]; then
    echo "[INFO] Active 'hermes-vps' instance already exists in compartment."
    telegram "ℹ️ Oracle A1 Hunter: 'hermes-vps' isimli aktif bir instance zaten mevcut! Hunter sonlandırılıyor."
    touch "$SUCCESS_MARKER"
    exit 0
fi

# 6. Resolve Image ID
IMAGE_ID="$OCI_IMAGE_ID"

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo "[ERROR] OCI_IMAGE_ID tanımlanmamış."
    telegram "❌ Oracle A1 Hunter Hata: OCI_IMAGE_ID eksik! Lütfen .env dosyasında OCI_IMAGE_ID değerini tanımlayın."
    exit 1
fi

echo "[INFO] Using Image ID: $IMAGE_ID"

# 7. Fetch Availability Domains
get_ads() {
    local ads
    ads=$(oci iam availability-domain list \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --query "data[].name" \
        --raw-output 2>/dev/null | tr -d '[]," ')
    echo "$ads"
}

ADS=$(get_ads)

if [ -z "$ADS" ]; then
    echo "[WARN] Could not fetch AD list via OCI API. Falling back to default AD scan."
fi

echo "[INFO] Target Availability Domains:"
for ad in $ADS; do
    echo "  - $ad"
done

# 8. Main Hunter Loop
ROUND=1
while true; do
    if [ -f "$SUCCESS_MARKER" ]; then
        echo "[INFO] Success marker created. Exiting loop."
        exit 0
    fi

    echo "=========================================="
    echo "[INFO] Starting hunting round #$ROUND at $(date)"
    echo "=========================================="

    if [ -z "$OCI_SUBNET_ID" ]; then
        echo "[ERROR] OCI_SUBNET_ID is missing in environment!"
        telegram "❌ Oracle A1 Hunter Hata: OCI_SUBNET_ID tanımlanmamış. Lütfen .env dosyasında OCI_SUBNET_ID doldurun."
        exit 1
    fi

    HAD_RATE_LIMIT=false

    for AD in $ADS; do
        echo "[INFO] Trying Availability Domain: $AD..."

        # Attempt to launch instance
        LAUNCH_OUTPUT=$(oci compute instance launch \
            --compartment-id "$OCI_COMPARTMENT_ID" \
            --availability-domain "$AD" \
            --subnet-id "$OCI_SUBNET_ID" \
            --image-id "$IMAGE_ID" \
            --shape "VM.Standard.A1.Flex" \
            --shape-config '{"ocpus":2,"memoryInGBs":12}' \
            --boot-volume-size-in-gbs 200 \
            --assign-public-ip true \
            --ssh-authorized-keys-file "$AUTHORIZED_KEYS_PATH" \
            --display-name "hermes-vps" 2>&1) || LAUNCH_EXIT_CODE=$?

        # Success check
        if echo "$LAUNCH_OUTPUT" | grep -q '"id": "ocid1.instance'; then
            INSTANCE_OCID=$(echo "$LAUNCH_OUTPUT" | grep -o 'ocid1\.instance\.[^"]*' | head -n1)
            echo "=========================================="
            echo "[SUCCESS] Instance created successfully!"
            echo "Instance OCID: $INSTANCE_OCID"
            echo "=========================================="

            echo "[INFO] Waiting for instance to reach RUNNING state..."
            
            # Poll until RUNNING
            STATE=""
            for i in $(seq 1 30); do
                STATE=$(oci compute instance get --instance-id "$INSTANCE_OCID" --query 'data."lifecycle-state"' --raw-output 2>/dev/null || echo "")
                echo "[INFO] Current state: $STATE"
                if [ "$STATE" = "RUNNING" ]; then
                    break
                fi
                sleep 10
            done

            # Get public IP address
            VNIC_ID=$(oci compute instance list-vnics --instance-id "$INSTANCE_OCID" --query 'data[0].id' --raw-output 2>/dev/null || true)
            PUBLIC_IP="Unknown"
            if [ -n "$VNIC_ID" ] && [ "$VNIC_ID" != "null" ]; then
                PUBLIC_IP=$(oci network vnic get --vnic-id "$VNIC_ID" --query 'data."public-ip"' --raw-output 2>/dev/null || echo "Unknown")
            fi

            SUCCESS_MSG="✅ Oracle A1 Sunucu Başarıyla Oluşturuldu!

Display Name: hermes-vps
Shape: VM.Standard.A1.Flex
Availability Domain: ${AD}
OCPU: 2
RAM: 12 GB
Boot Volume: 200 GB
Public IP: ${PUBLIC_IP}
Instance OCID: ${INSTANCE_OCID}

Hunter servisi tamamlandı ve durduruldu."

            telegram "$SUCCESS_MSG"
            echo "$SUCCESS_MSG"

            touch "$SUCCESS_MARKER"
            exit 0
        fi

        # Check for Out of Capacity error
        if echo "$LAUNCH_OUTPUT" | grep -q -iE "Out of host capacity|Out of capacity"; then
            echo "[WARN] Capacity unavailable in $AD. Retrying next AD..."
            continue
        fi

        # Check for Rate Limit (429 / TooManyRequests)
        if echo "$LAUNCH_OUTPUT" | grep -q -iE "TooManyRequests|429"; then
            echo "[WARN] Rate limit (429 / TooManyRequests) encountered in $AD."
            HAD_RATE_LIMIT=true
            break
        fi

        # Fatal / Unexpected Error
        echo "[ERROR] Launch failed with unexpected error on $AD:"
        echo "$LAUNCH_OUTPUT"
        
        telegram "❌ Oracle A1 Hunter Beklenmeyen Hata!

AD: ${AD}
Hata Detayı:
${LAUNCH_OUTPUT}"
        exit 1
    done

    if [ "$HAD_RATE_LIMIT" = true ]; then
        echo "[INFO] Rate limit reached. Sleeping for 900 seconds (15 minutes)..."
        sleep 900
    else
        echo "[INFO] All ADs checked, no capacity available. Sleeping 600 seconds (10 minutes)..."
        sleep 600
    fi

    ROUND=$((ROUND + 1))
done
