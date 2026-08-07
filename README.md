# Oracle Cloud A1 Hunter Service

Docker Compose tabanlı Oracle Cloud Infrastructure (OCI) `VM.Standard.A1.Flex` kapasite avcısı.

## 📁 Proje Yapısı

```text
/home/cunq/Desktop/Projects/oracle-a1-hunter/
├── compose.yaml          # Docker Compose servisi
├── hunter.sh             # OCI kapasite arama ve instance oluşturma scripti
├── .env                  # Telegram & OCI ortam değişkenleri
├── .env.example          # Örnek konfigürasyon dosyası
├── oci/
│   ├── config            # OCI CLI konfigürasyonu (mount: /oracle/.oci/config)
│   └── private-key.pem   # OCI API Key (mount: /oracle/.oci/private-key.pem)
├── ssh/
│   └── authorized_keys   # Sunucuya eklenecek varsayılan SSH public key
└── data/
    └── success           # Instance başarıyla oluşturulduğunda oluşturulan marker
```

## ⚙️ Kurulum ve Çalıştırma

### 1. Konfigürasyonu Düzenleyin (`.env`)
`.env` dosyasını açıp Telegram bot bilgilerinizi ve OCI subnet id bilgilerinizi girin:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=987654321

OCI_COMPARTMENT_ID=ocid1.tenancy.oc1..aaaaaaaaza6oyygqwfsvdxg4qmm5txf4nncp2x7y5y45q53fe4qaof4uwp4q
OCI_SUBNET_ID=ocid1.subnet.oc1.eu-frankfurt-1.aaaaaaaa...

# İsteğe bağlı (Boş bırakılırsa otomatik Canonical Ubuntu Minimal aarch64 seçilir)
OCI_IMAGE_ID=
```

### 2. Hunter Servisini Başlatın

```bash
docker compose up -d
```

### 3. Logları Canlı İzleyin

```bash
docker compose logs -f
```

### 4. Servisi Durdurun

```bash
docker compose down
```

## 🎯 Özellikler ve Çalışma Mantığı

1. **Çift Instance Koruması**: Başlangıçta ve `/data/success` marker dosyası kontrol edilerek ikinci bir instance açılması engellenir.
2. **Otomatik AD Taraması**: Bölgedeki tüm Availability Domain'leri (AD-1, AD-2, AD-3 vb.) otomatik sorgular.
3. **Akıllı Retry**:
   - Out of capacity durumunda sıradaki AD'yi dener; tüm AD'ler doluysa **600 saniye (10 dakika)** bekler.
   - Rate limit (`429 / TooManyRequests`) alındığında **900 saniye (15 dakika)** bekler.
   - Auth/Quota/Bad ID hatalarında sonsuz döngüye girmez; Telegram'a hata bildirip durur.
4. **Telegram Bildirimi**:
   - Başlangıçta bilgilendirme
   - Mevcut active `hermes-vps` varsa bildirim
   - Instance başarıyla oluşturulup `RUNNING` durumuna geçtiğinde IP ve OCID ile birlikte başarı mesajı
   - Beklenmeyen kritik bir hata oluştuğunda hata detayı
