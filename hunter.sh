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

# Target CPU / Memory configuration & Strategy
HUNTER_MODE="${HUNTER_MODE:-GRADUAL}" # GRADUAL or EXACT
OCI_OCPUS="${OCI_OCPUS:-4}"
OCI_MEMORY_GB="${OCI_MEMORY_GB:-24}"

if [ "$HUNTER_MODE" = "EXACT" ]; then
    TIER_SPECS=("${OCI_OCPUS}:${OCI_MEMORY_GB}")
else
    # Gradual Step-Down: 4C/24G jackpot -> 3C/18G -> 2C/12G
    TIER_SPECS=("4:24" "3:18" "2:12")
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
echo "[INFO] Hunter Mode: $HUNTER_MODE. Target Tiers: ${TIER_SPECS[*]}"

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

# 6. Resolve Image ID (Automatic discovery fallback with TIMECREATED DESC sort)
IMAGE_ID="$OCI_IMAGE_ID"

if [ -z "$IMAGE_ID" ] || [ "$IMAGE_ID" = "null" ]; then
    echo "[INFO] OCI_IMAGE_ID belirtilmemiş. En güncel Canonical Ubuntu ARM64 imajı otomatik sorgulanıyor..."
    IMAGE_ID=$(oci compute image list \
        --compartment-id "$OCI_COMPARTMENT_ID" \
        --operating-system "Canonical Ubuntu" \
        --shape "VM.Standard.A1.Flex" \
        --sort-by TIMECREATED \
        --sort-order DESC \
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

# 7. Helper function to fetch Availability Domains (Tenancy OCID priority + Fallback)
get_ads() {
    local tenancy_id
    tenancy_id=$(grep -E '^tenancy=' /oracle/.oci/config | head -n1 | cut -d'=' -f2 | tr -d ' "\r' || true)
    [ -z "$tenancy_id" ] && tenancy_id="$OCI_COMPARTMENT_ID"

    local raw_output
    raw_output=$(oci iam availability-domain list \
        --compartment-id "$tenancy_id" \
        --output json 2>&1 || true)
    
    local parsed
    parsed=$(echo "$raw_output" | grep -oE '[A-Za-z0-9_-]+:[A-Za-z0-9_-]+-AD-[0-9]+' | sort -u || true)

    if [ -z "$parsed" ] && [ -n "$OCI_COMPARTMENT_ID" ] && [ "$OCI_COMPARTMENT_ID" != "$tenancy_id" ]; then
        raw_output=$(oci iam availability-domain list \
            --compartment-id "$OCI_COMPARTMENT_ID" \
            --output json 2>&1 || true)
        parsed=$(echo "$raw_output" | grep -oE '[A-Za-z0-9_-]+:[A-Za-z0-9_-]+-AD-[0-9]+' | sort -u || true)
    fi

    # Fallback: Infer AD names from compute instances in compartment if IAM listing fails
    if [ -z "$parsed" ] && [ -n "$OCI_COMPARTMENT_ID" ]; then
        local comp_instances
        comp_instances=$(oci compute instance list --compartment-id "$OCI_COMPARTMENT_ID" --output json 2>/dev/null || true)
        parsed=$(echo "$comp_instances" | grep -oE '[A-Za-z0-9_-]+:[A-Za-z0-9_-]+-AD-[0-9]+' | sort -u || true)
    fi

    if [ -z "$parsed" ]; then
        echo "[ERROR] OCI AD listesi çekilemedi. OCI API Yanıtı: $raw_output" >&2
    fi

    echo "$parsed"
}

# 8. Check Subnet Type (Regional vs AD-Specific)
SUBNET_OUTPUT=""
if ! SUBNET_OUTPUT=$(oci network subnet get \
    --subnet-id "$OCI_SUBNET_ID" \
    --query 'data."availability-domain"' \
    --raw-output 2>&1); then
    echo "[WARN] OCI Subnet bilgisi sorgulanamadı (geçici ağ hatası veya varsayılan erişim)."
    echo "[WARN] Regional Subnet varsayılarak tüm Availability Domain'ler taranacak."
    CLEAN_SUBNET_AD=""
else
    # Filter and extract valid OCI AD string if subnet is AD-specific
    CLEAN_SUBNET_AD=$(echo "$SUBNET_OUTPUT" | grep -E '^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+' || true)
fi

if [ -n "$CLEAN_SUBNET_AD" ]; then
    echo "[INFO] Subnet AD-specific ($CLEAN_SUBNET_AD). Sadece bu AD taranacak."
    ADS="$CLEAN_SUBNET_AD"
else
    echo "[INFO] Subnet Regional. Tüm Availability Domain'ler taranacak."
    ADS=$(get_ads)
fi

# Send startup notification ONLY ONCE after initial setup validation
STARTUP_NOTIFIED=false
AUTH_NOTIFIED=false

# 9. Main Hunter Loop
ROUND=1
while true; do
    if [ -f "$SUCCESS_MARKER" ]; then
        echo "[INFO] Success marker created. Exiting loop."
        exit 0
    fi

    # Ensure AD list is populated
    if [ -z "$ADS" ]; then
        echo "[WARN] OCI API'den AD listesi henüz çekilemedi."
        echo "[DEBUG] OCI Config Check: /oracle/.oci/config $([ -f /oracle/.oci/config ] && echo 'MEVCUT' || echo 'EKSİK')"
        echo "[DEBUG] OCI Key Check: /oracle/.oci/private-key.pem $([ -f /oracle/.oci/private-key.pem ] && echo 'MEVCUT' || echo 'EKSİK')"
        if [ "$AUTH_NOTIFIED" = false ]; then
            telegram "⚠️ Oracle A1 Hunter Bildirimi: OCI API'ye bağlanılamıyor. Lütfen Web Dashboard üzerinden OCI User OCID, Fingerprint, Tenancy ve Private Key (.pem) bilgilerinizi kontrol edip yeniden kaydedin."
            AUTH_NOTIFIED=true
        fi
        echo "[WARN] 30 saniye beklenip döngü içinde tekrar denenecek..."
        sleep 30
        ADS=$(get_ads)
        continue
    fi

    # Send startup notification ONCE when main loop is active
    if [ "$STARTUP_NOTIFIED" = false ]; then
        telegram "🚀 Oracle A1 Hunter servisi başlatıldı. Strateji: ${HUNTER_MODE} (${TIER_SPECS[*]}, 200GB Boot Disk)"
        STARTUP_NOTIFIED=true
    fi

    # Convert ADS string to array for rotation
    AD_LIST=($ADS)
    NUM_ADS=${#AD_LIST[@]}

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
        # Validate AD string format (must contain colon e.g. Xbrv:EU-FRANKFURT-1-AD-1)
        if [[ ! "$AD" =~ : ]]; then
            echo "[WARN] Skipping invalid Availability Domain string: '$AD'"
            continue
        fi

        for SPEC in "${TIER_SPECS[@]}"; do
            TARGET_OCPU="${SPEC%:*}"
            TARGET_RAM="${SPEC#*:}"

            echo "[INFO] Trying AD: $AD [Spec: ${TARGET_OCPU} OCPU / ${TARGET_RAM} GB RAM]..."

            # Attempt to launch instance
            LAUNCH_OUTPUT=$(oci compute instance launch \
                --compartment-id "$OCI_COMPARTMENT_ID" \
                --availability-domain "$AD" \
                --subnet-id "$OCI_SUBNET_ID" \
                --image-id "$IMAGE_ID" \
                --shape "VM.Standard.A1.Flex" \
                --shape-config "{\"ocpus\":${TARGET_OCPU},\"memoryInGBs\":${TARGET_RAM}}" \
                --boot-volume-size-in-gbs 200 \
                --assign-public-ip true \
                --ssh-authorized-keys-file "$AUTHORIZED_KEYS_PATH" \
                --display-name "hermes-vps" 2>&1) || LAUNCH_EXIT_CODE=$?

            # Success check
            if echo "$LAUNCH_OUTPUT" | grep -q '"id": "ocid1.instance'; then
                INSTANCE_OCID=$(echo "$LAUNCH_OUTPUT" | grep -o 'ocid1\.instance\.[^"]*' | head -n1)
                echo "=========================================="
                echo "[SUCCESS] Instance created successfully!"
                echo "Instance OCID: $INSTANCE_OCID (${TARGET_OCPU} OCPU / ${TARGET_RAM} GB RAM)"
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
OCPU: ${TARGET_OCPU}
RAM: ${TARGET_RAM} GB
Boot Volume: 200 GB
Public IP: ${PUBLIC_IP}
Instance OCID: ${INSTANCE_OCID}

Hunter servisi başarıyla tamamlandı ve durduruldu."

                telegram "$SUCCESS_MSG"
                echo "$SUCCESS_MSG"

                touch "$SUCCESS_MARKER"
                exit 0
            fi

            # Check for Out of Capacity error
            if echo "$LAUNCH_OUTPUT" | grep -q -iE "Out of host capacity|Out of capacity|OutOfCapacity"; then
                echo "[WARN] Capacity unavailable for ${TARGET_OCPU}C / ${TARGET_RAM}G in $AD. Stepping down..."
                continue
            fi

            # Check for Rate Limit (429 / TooManyRequests)
            if echo "$LAUNCH_OUTPUT" | grep -q -iE "TooManyRequests|429"; then
                echo "[WARN] Rate limit (429 / TooManyRequests) encountered in $AD."
                HAD_RATE_LIMIT=true
                break 2
            fi

            # Check for Transient Network / Connection Timeouts
            if echo "$LAUNCH_OUTPUT" | grep -q -iE "ConnectTimeout|connection timed out|timed out|ServiceUnavailable|500|502|503|504|Connection reset"; then
                echo "[WARN] Temporary OCI network timeout on $AD. Sleeping 60s before retrying..."
                sleep 60
                continue 2
            fi

            # Check for NotAuthorizedOrNotFound / 404 (AD or resource not permitted/available in tenancy)
            if echo "$LAUNCH_OUTPUT" | grep -q -iE "NotAuthorizedOrNotFound|Authorization failed or requested resource not found"; then
                echo "[WARN] AD $AD is not permitted or found (404 NotAuthorizedOrNotFound). Skipping AD..."
                break
            fi

            # Check for NotAuthenticated / 401 (Authentication credential mismatch)
            if echo "$LAUNCH_OUTPUT" | grep -q -iE "NotAuthenticated|401"; then
                echo "[ERROR] OCI API Kimlik Doğrulama Hatası (HTTP 401 NotAuthenticated)!"
                echo "[ERROR] Lütfen Web Dashboard üzerinden OCI User OCID, Fingerprint, Tenancy ve Private Key (.pem) bilgilerinizi kontrol edip yeniden kaydedin."
                telegram "❌ Oracle A1 Hunter Hata: OCI API Kimlik Doğrulama Hatası (HTTP 401 NotAuthenticated)! Lütfen Web UI üzerinden OCI User OCID, Fingerprint, Tenancy ve Private Key (.pem) bilgilerinizi kontrol edip kaydedin."
                sleep 60
                continue 2
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
    done

    if [ "$HAD_RATE_LIMIT" = true ]; then
        echo "[INFO] Rate limit reached. Sleeping for 900 seconds (15 minutes)..."
        sleep 900
    else
        # Add random jitter (540s to 660s) to avoid exact 10-min pattern spikes
        JITTER=$(( 540 + RANDOM % 120 ))
        echo "[INFO] All ADs checked, no capacity available. Sleeping $JITTER seconds (~9-11 min, ±10% jitter)..."
        sleep $JITTER
    fi

    ROUND=$((ROUND + 1))
done
