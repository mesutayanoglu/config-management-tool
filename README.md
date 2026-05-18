# Config Management Tool

Ağ cihazlarının (FortiGate, Aruba CX, Huawei, Cisco) konfigürasyonlarını SSH üzerinden periyodik olarak toplayıp GitHub'a kaydeden ve web arayüzünden izleme ile karşılaştırma imkânı sunan araç.

---

## Gereksinimler

- Docker ve Docker Compose
- GitHub hesabı (konfigürasyonların saklanacağı bir repo)

---

## Kurulum

### 1. Depoyu klonla

```bash
git clone <repo-url>
cd config-management-tool
```

### 2. GitHub repo hazırla

Konfigürasyon dosyalarının saklanacağı ayrı bir GitHub deposu oluştur. Bu depo private olabilir. Ardından bu depoya yazma yetkisi olan bir **Personal Access Token** oluştur:

GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)

Token izinleri: `repo` (tam erişim) yeterli.

### 3. Ortam değişkenlerini ayarla

Proje kök dizininde `.env` dosyasını düzenle:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/configdb
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=configdb

SECRET_KEY=<güçlü-rastgele-bir-anahtar>
ACCESS_TOKEN_EXPIRE_MINUTES=1440

GITHUB_TOKEN=
GITHUB_REPO=

SSH_TIMEOUT=30

ENVIRONMENT=production
FRONTEND_URL=http://localhost

INITIAL_SUPERADMIN_USERNAME=admin
INITIAL_SUPERADMIN_PASSWORD=<ilk-giris-sifresi>

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
```

**Dikkat edilmesi gereken alanlar:**

- `SECRET_KEY`: JWT imzalamada kullanılır. Rastgele ve güçlü bir değer gir. Üretmek için: `openssl rand -hex 32`
- `INITIAL_SUPERADMIN_USERNAME` / `INITIAL_SUPERADMIN_PASSWORD`: İlk açılışta oluşturulacak yönetici hesabı. Uygulama bir kez ayağa kalktıktan sonra bu iki satırı temizleyebilirsin.
- `GITHUB_TOKEN` ve `GITHUB_REPO`: Kurulumdan sonra arayüzün Settings bölümünden de girilebilir. Şimdilik boş bırakılabilir.
- `SMTP_*`: Şifre sıfırlama maili gönderilmesini istiyorsan doldur. Zorunlu değil.

### 4. Uygulamayı başlat

```bash
docker compose up --build -d
```

İlk çalıştırmada:
- PostgreSQL veritabanı oluşturulur
- Tablolar ve ilk yönetici hesabı otomatik olarak kurulur
- Backend ve frontend servisleri ayağa kalkar

Durum kontrolü:

```bash
docker compose ps
```

Üç servisin (`backend`, `frontend`, `postgres`) `running` durumunda olması gerekir.

### 5. Arayüze giriş yap

Tarayıcıdan `http://localhost` adresini aç.

`.env` dosyasında belirlediğin `INITIAL_SUPERADMIN_USERNAME` ve `INITIAL_SUPERADMIN_PASSWORD` ile giriş yap.

### 6. GitHub bağlantısını yapılandır

Üst menüden **Settings** sayfasına gir. GitHub Token ve GitHub Repo alanlarını doldur. Repo formatı: `kullaniciadi/repo-adi`

Bağlantıyı test etmek için "Test Et" butonunu kullan.

---

## Cihaz Ekleme

Settings ayarları tamamlandıktan sonra **Cihazlar** sayfasından ağ cihazlarını ekleyebilirsin.

Desteklenen cihaz tipleri: Cisco, FortiGate, Huawei, Aruba, Aruba CX

Her cihaz için gereken bilgiler: IP adresi, SSH kullanıcı adı, SSH şifresi, konfigürasyon komutu (örn. `show running-config`).

---

## Zamanlayıcı Kurma

**Zamanlayıcılar** sayfasından, hangi cihazların konfigürasyonunun ne zaman toplanacağını belirleyebilirsin.

Desteklenen zamanlama tipleri: belirli aralıklarla (dakika/saat), günlük, haftalık, aylık.

---

## Güncelleme

```bash
git pull
docker compose up --build -d
```

---

## Servis Logları

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Durdurma

```bash
docker compose down
```

Veritabanı verilerini de silmek istersen:

```bash
docker compose down -v
```
