#!/usr/bin/env bash
set -e

export OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING=True

SUCCESS_MARKER="/data/success"

# 1. Success marker check
if [ -f "$SUCCESS_MARKER" ]; then
    echo "[INFO] Success marker found ($SUCCESS_MARKER). Instance has already been launched. Exiting."
    exit 0
fi

# Robust environment variable loader (handles spaces and quotes safely)
load_env() {
    local env_file="$1"
    if [ -f "$env_file" ] && [ ! -d "$env_file" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            [[ -z "$line" || "$line" =~ ^# ]] && continue
            if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
                local var_name="${BASH_REMATCH[1]}"
                local var_val="${BASH_REMATCH[2]}"
                var_val=$(echo "$var_val" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
                export "$var_name"="$var_val"
            fi
        done < "$env_file"
    fi
}

load_env "/data/.env"
load_env "/.env"

# Target CPU / Memory configuration (Default: 4 OCPU, 24 GB RAM)
OCI_OCPUS="${OCI_OCPUS:-4}"
OCI_MEMORY_GB="${OCI_MEMORY_GB:-24}"

# 2. Telegram notification helper
telegram() {
    local msg="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${msg}" >/dev/null 2>&1 || true
    fi
}

# 3. Verify OCI Config and essential fields exist
if [ ! -f "/oracle/.oci/config" ] || [ ! -f "/oracle/.oci/private-key.pem" ]; then
    echo "[INFO] OCI konfigürasyon dosyaları (/oracle/.oci/config veya private-key.pem) henüz bulunamadı."
    echo "[INFO] Lütfen Web Dashboard üzerinden OCI API ve Telegram bilgilerinizi kaydedin."
    sleep 30
    exit 0
fi

if [ -z "$OCI_COMPARTMENT_ID" ]; then
    OCI_COMPARTMENT_ID=$(grep -E '^tenancy=' /oracle/.oci/config | head -n1 | cut -d'=' -f2 | tr -d ' "\r' || true)
fi

if [ -z "$OCI_COMPARTMENT_ID" ] || [ "$OCI_COMPARTMENT_ID" = "null" ]; then
    echo "[INFO] OCI_COMPARTMENT_ID (Tenancy OCID) henüz tanımlanmamış."
    echo "[INFO] Lütfen Web Dashboard üzerinden Tenancy / Compartment OCID bilginizi kaydedin."
    sleep 30
    exit 0
fi

if [ -z "$OCI_SUBNET_ID" ] || [ "$OCI_SUBNET_ID" = "null" ]; then
    echo "[INFO] OCI_SUBNET_ID henüz tanımlanmamış."
    echo "[INFO] Lütfen Web Dashboard üzerinden Subnet OCID bilginizi kaydedin."
    sleep 30
    exit 0
fi

echo "[INFO] Compartment ID: $OCI_COMPARTMENT_ID"
echo "[INFO] Target Spec: ${OCI_OCPUS} OCPU / ${OCI_MEMORY_GB} GB RAM"

# Send startup notification
telegram "🚀 Oracle A1 Hunter servisi başlatıldı. Target: VM.Standard.A1.Flex (${OCI_OCPUS} OCPU, ${OCI_MEMORY_GB}GB RAM, 200GB Boot Disk)"

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

# 6. Resolve Image ID (Automatic discovery fallback)
IMAGE_ID="$OCI_IMAGE_ID"

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo "[INFO] OCI_IMAGE_ID belirtilmemiş. En güncel Canonical Ubuntu ARM64 imajı otomatik sorgulanıyor..."
    IMAGE_ID=$(oci compute image list \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --operating-system "Canonical Ubuntu" \
        --shape "VM.Standard.A1.Flex" \
        --query "data[?contains(\"display-name\", 'aarch64')].id | [0]" \
        --raw-output 2>/dev/null || echo "")
fi

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo "[ERROR] Canonical Ubuntu ARM64 imajı otomatik bulunamadı."
    telegram "❌ Oracle A1 Hunter Hata: Canonical Ubuntu ARM64 imajı bulunamadı. Lütfen Image OCID girin."
    exit 1
fi

echo "[INFO] Using Image ID: $IMAGE_ID"

# Ensure readable permissions for container user
chmod 644 /oracle/.oci/config /oracle/.oci/private-key.pem 2>/dev/null || true

# 7. Check Subnet Type (Regional vs AD-Specific)
SUBNET_AD=$(oci network subnet get --subnet-id "$OCI_SUBNET_ID" --query 'data."availability-domain"' --raw-output 2>/dev/null || echo "")

if [ -n "$SUBNET_AD" ] && [ "$SUBNET_AD" != "null" ]; then
    echo "[INFO] Subnet AD-specific ($SUBNET_AD). Sadece bu AD taranacak."
    ADS="$SUBNET_AD"
else
    echo "[INFO] Subnet Regional. Tüm Availability Domain'ler taranacak."
    get_ads() {
        local raw_ads
        raw_ads=$(oci iam availability-domain list \
            --compartment-id "$OCI_COMPARTMENT_ID" \
            --query "data[].name" \
            --raw-output 2>/dev/null || true)
        
        echo "$raw_ads" | grep -v 'ERROR:' | grep -v 'Abort' | grep -v 'Could not find' | tr -d '[],"' | xargs -n1 2>/dev/null || true
    }
    ADS=$(get_ads)
fi

if [ -z "$ADS" ]; then
    echo "[WARN] OCI API'den AD listesi çekilemedi (veya config erişilebilir değil)."
    echo "[WARN] 15 saniye beklenip tekrar denenecek."
    sleep 15
    exit 0
fi

# Convert ADS string to array for rotation
AD_LIST=($ADS)
NUM_ADS=${#AD_LIST[@]}

echo "[INFO] Target Availability Domains ($NUM_ADS adet): ${AD_LIST[*]}"

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

    # Rotate AD order on each round (Round-Robin Shift)
    OFFSET=$(( (ROUND - 1) % NUM_ADS ))
    CURRENT_ADS=()
    for (( i=0; i<NUM_ADS; i++ )); do
        IDX=$(( (i + OFFSET) % NUM_ADS ))
        CURRENT_ADS+=("${AD_LIST[$IDX]}")
    done

    echo "[INFO] Round #$ROUND AD Queue Order: ${CURRENT_ADS[*]}"

    for AD in "${CURRENT_ADS[@]}"; do
        echo "[INFO] Trying Availability Domain: $AD..."

        # Attempt to launch instance
        LAUNCH_OUTPUT=$(oci compute instance launch \
            --compartment-id "$OCI_COMPARTMENT_ID" \
            --availability-domain "$AD" \
            --subnet-id "$OCI_SUBNET_ID" \
            --image-id "$IMAGE_ID" \
            --shape "VM.Standard.A1.Flex" \
            --shape-config "{\"ocpus\":${OCI_OCPUS},\"memoryInGBs\":${OCI_MEMORY_GB}}" \
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
OCPU: ${OCI_OCPUS}
RAM: ${OCI_MEMORY_GB} GB
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
        if echo "$LAUNCH_OUTPUT" | grep -q -iE "Out of host capacity|Out of capacity|OutOfCapacity"; then
            echo "[WARN] Capacity unavailable in $AD. Retrying next AD..."
            continue
        fi

        # Check for Rate Limit (429 / TooManyRequests)
        if echo "$LAUNCH_OUTPUT" | grep -q -iE "TooManyRequests|429"; then
            echo "[WARN] Rate limit (429 / TooManyRequests) encountered in $AD."
            HAD_RATE_LIMIT=true
            break
        fi

        # Check for Transient Network / Connection Timeouts
        if echo "$LAUNCH_OUTPUT" | grep -q -iE "ConnectTimeout|connection timed out|timed out|ServiceUnavailable|500|502|503|504|Connection reset"; then
            echo "[WARN] Temporary OCI network timeout on $AD. Sleeping 60s before retrying..."
            sleep 60
            continue
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
        # Add random jitter (540s to 660s) to avoid exact 10-min pattern spikes
        JITTER=$(( 540 + RANDOM % 120 ))
        echo "[INFO] All ADs checked, no capacity available. Sleeping $JITTER seconds..."
        sleep $JITTER
    fi

    ROUND=$((ROUND + 1))
done
