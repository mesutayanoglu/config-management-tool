# Config Management Tool — Proje Dokümantasyonu

Ağ cihazlarının (FortiGate, Aruba CX, Huawei, Cisco) konfigürasyonlarını SSH ile periyodik olarak çekip
GitHub'da saklayan, web arayüzünden izleme ve diff imkânı sunan iç ağ yönetim aracı.

---

## Dizin Yapısı

```
config-management-tool/
├── backend/                  # FastAPI uygulaması
│   ├── app/
│   │   ├── core/             # config.py, database.py, security.py
│   │   ├── models/           # SQLAlchemy ORM modelleri
│   │   ├── schemas/          # Pydantic request/response şemaları
│   │   ├── routers/          # FastAPI router'ları (HTTP endpoint'ler)
│   │   ├── services/         # İş mantığı servisleri
│   │   ├── tasks/            # Sadece __init__.py (Celery kalıntıları temizlendi)
│   │   └── main.py           # FastAPI app, lifespan, CORS
│   ├── alembic/              # DB migration'ları
│   └── requirements.txt
├── frontend/                 # React + Vite uygulaması
│   ├── src/
│   │   ├── components/       # UI bileşenleri
│   │   ├── pages/            # Sayfa bileşenleri
│   │   ├── services/api.js   # Axios HTTP client
│   │   ├── store/            # Zustand state (auth)
│   │   └── i18n/index.jsx    # TR/EN çeviriler
│   ├── nginx.conf            # Nginx reverse proxy config
│   └── Dockerfile            # Production build (Nginx)
└── docker-compose.yml        # Tüm servisleri ayağa kaldırır
```

---

## Stack

### Backend
| Paket | Versiyon | Kullanım |
|---|---|---|
| FastAPI | 0.115.0 | HTTP framework |
| Uvicorn | 0.30.6 | ASGI server (--reload aktif) |
| SQLAlchemy | 2.0.35 | Async ORM |
| asyncpg | 0.29.0 | PostgreSQL async driver |
| Alembic | 1.13.3 | DB migration |
| Pydantic | 2.9.2 | Şema validasyonu |
| pydantic-settings | 2.5.2 | .env config yönetimi |
| python-jose | 3.3.0 | JWT token |
| bcrypt | 4.2.0 | Şifre hash |
| Netmiko | 4.4.0 | SSH config toplama |
| PyGithub | 2.4.0 | GitHub API |
| APScheduler | 3.10.4 | Zamanlanmış görevler |

### Frontend
| Paket | Kullanım |
|---|---|
| React + Vite | SPA framework |
| Tailwind CSS | Stil |
| Axios | HTTP client |
| Zustand | Auth state yönetimi |
| React Router | Client-side routing |

### Altyapı
- **PostgreSQL 16** — Ana veritabanı
- **Redis 7** — Kaldırıldı (Celery ile birlikte docker-compose'dan çıkarıldı)
- **Docker Compose** — Tüm servisler container'da çalışır
- **Nginx** — Frontend static dosyaları serve eder + `/api/` → backend proxy

---

## Docker Compose Servisleri

```
backend   → localhost:8000  (FastAPI + Uvicorn --reload)
frontend  → localhost:80    (Nginx, production build)
postgres  → localhost:5432
```

> **Not:** `celery_worker`, `celery_beat` ve `redis` servisleri kaldırıldı.
> APScheduler backend process içinde çalışıyor, ayrı worker gerekmez.

### Projeyi başlatmak

```bash
# İlk çalıştırma veya kod değişikliği sonrası
docker compose up --build -d

# Sadece başlatmak (image zaten build edilmişse)
docker compose up -d

# Frontend yeniden build (frontend dosyası değişince)
docker compose build frontend && docker compose up -d frontend
```

---

## Backend Mimarisi

### `app/main.py` — Uygulama Giriş Noktası

Lifespan fonksiyonunda iki kritik işlem:
1. `_load_settings_from_db()` — `site_settings` tablosundan GitHub token/repo'yu belleğe yükler
2. `job_scheduler.start()` — APScheduler'ı başlatır, DB'deki aktif scheduler'ları yükler

CORS: `localhost:5173` ve `localhost:3000` origin'lerine izin var (development).
Nginx production'da `localhost:80` üzerinden `/api/` → `backend:8000/` proxy yapar.

### `app/core/`

**`config.py`** — `pydantic-settings` ile `.env` dosyasından ayarları yükler.
```python
settings.GITHUB_TOKEN  # runtime'da settings.py'den güncellenir
settings.GITHUB_REPO
settings.DATABASE_URL
settings.SECRET_KEY
```
GitHub token/repo `.env`'den ya da DB'den (`site_settings` tablosu) gelir.
DB'deki değer her zaman `.env`'i ezer (startup'ta yüklenir).

**`database.py`** — `asyncpg` + `AsyncSession` + `create_async_engine`.
`AsyncSessionLocal` scheduler job'larında da (FastAPI DI dışında) kullanılır.

**`security.py`** — `bcrypt` hash, JWT encode/decode (`python-jose`).
Token payload: `{sub: user_id, username, role}`.
Token süresi: `ACCESS_TOKEN_EXPIRE_MINUTES` (varsayılan 1440 dk = 24 saat).

FastAPI dependency'leri:
- `get_current_user` — JWT doğrular, DB'den taze user çeker (role her zaman DB'den okunur)
- `get_super_admin_user` — `role != 'super_administrator'` ise 403
- `get_write_user` — `role == 'read_only'` ise 403

### `app/models/` — Veritabanı Modelleri

**`User`** (`users` tablosu)
```
id, username (unique), email (nullable), hashed_password, is_admin, is_active,
role (VARCHAR 32: 'super_administrator' | 'admin' | 'read_only')
```
`role` alanı yetkiyi belirler. `is_admin` backward compat için tutuldu ama kullanılmıyor.

**`PasswordResetToken`** (`password_reset_tokens` tablosu)
```
id, user_id (FK → users.id CASCADE), token (unique, 64 char),
expires_at (TIMESTAMPTZ), used_at (TIMESTAMPTZ nullable)
```
Tek kullanımlık, 1 saatlik TTL. `secrets.token_urlsafe(32)` ile üretilir.

**`Organization`** (`organizations` tablosu)
```
id, name (unique), description
→ sites (one-to-many)
```

**`Site`** (`sites` tablosu)
```
id, name, location, organization_id (FK)
→ devices (one-to-many)
```

**`Device`** (`devices` tablosu)
```
id, device_uid (12 hex char, unique), hostname, ip_address, vendor,
model, version, config_command, ssh_username, ssh_password,
status (online/offline/unknown), site_id (FK),
last_collected_at (DateTime timezone=True)
```
`device_uid`: GitHub'daki klasör adı. UUID v4'ün ilk 12 hex karakteri.
`last_collected_at`: `DateTime(timezone=True)` → PostgreSQL TIMESTAMPTZ → UTC olarak saklanır, Pydantic `+00:00` suffix ile serialize eder → frontend doğru yorumlar.

**`Scheduler`** (`schedulers` tablosu)
```
id, name, schedule_type (interval|daily|weekly|monthly),
interval_value, interval_unit (minutes|hours),
time_of_day (HH:MM), days_of_week (comma-sep 0-6), day_of_month (1-31),
target_type (manual|org|site), target_org_id (FK), target_site_id (FK),
is_active (0/1), last_run_at (DateTime — naive, Istanbul saati)
```
`last_run_at`: `DateTime` (timezone YOK) → naive datetime.
**Kritik:** `ZoneInfo("Europe/Istanbul")` ile kaydedilmeli, UTC ile değil.
Aksi halde frontend 3 saat yanlış gösterir (naive UTC → local time yanlış yorumu).

**`SchedulerDevice`** (`scheduler_devices` tablosu)
```
id, scheduler_id (FK), device_id (FK)
```
Scheduler ile Device arasında many-to-many köprü tablosu.
Bir cihaz bir scheduler'a bağlıysa, cihaz silinemez (FK constraint → HTTP 409).

### `app/routers/` — HTTP Endpoint'ler

| Router | Prefix | Açıklama |
|---|---|---|
| `auth.py` | `/auth` | RBAC'lı kullanıcı yönetimi, şifre sıfırlama |
| `devices.py` | `/devices` | CRUD + ping + collect (`get_current_user` / `get_write_user`) |
| `configs.py` | `/configs` | GitHub config listeleme ve okuma (`get_current_user`) |
| `schedulers.py` | `/schedulers` | CRUD + APScheduler (`get_current_user` / `get_write_user`) |
| `organizations.py` | `/organizations` | Org + site CRUD (`get_current_user` / `get_write_user`) |
| `settings.py` | `/settings` | GitHub + SMTP ayarları (`get_current_user` / `get_super_admin_user`) |

**`auth.py` endpoint'leri:**

| Endpoint | Yetki | Açıklama |
|---|---|---|
| `POST /auth/login` | public | JSON body: `{username, password}` → JWT + user bilgisi |
| `GET /auth/me` | any user | Giriş yapan kullanıcı bilgisi |
| `POST /auth/users` | super_admin | Kullanıcı oluşturma |
| `GET /auth/users` | super_admin | Kullanıcı listesi |
| `DELETE /auth/users/{id}` | super_admin | Son super_admin silinemez |
| `PUT /auth/users/{id}/profile` | own / super_admin | Username + email güncelleme |
| `PUT /auth/users/{id}/password` | own (+ current_pwd) / super_admin | Şifre değiştirme |
| `PUT /auth/users/{id}/role` | super_admin | Rol atama (son super_admin rolü düşürülemez) |
| `POST /auth/forgot-password` | public | SMTP yapılandırılmamışsa production'da 503 |
| `POST /auth/reset-password` | public | Token doğrulama + şifre güncelleme |

**Login notu:** Login endpoint `OAuth2PasswordRequestForm` **değil**, `LoginRequest` (JSON body) kullanır.
`curl` ile test: `-H "Content-Type: application/json" -d '{"username":"x","password":"y"}'`

**`devices.py` — Cihaz silme davranışı:**
Scheduler'a bağlı cihaz silinmeye çalışıldığında `IntegrityError` yakalanır,
`HTTP 409` + `detail: "scheduler_conflict"` döner.
Frontend bunu kırmızı toast olarak gösterir.

**`devices.py` — Manuel config toplama:**
`POST /devices/{id}/collect` → `collect_config(device)` çağırır →
`device.last_collected_at = datetime.now(timezone.utc)` günceller (timezone-aware).

**`configs.py` — Config karşılaştırma:**
`GET /configs/{uid}/compare?sha_a=...&sha_b=...`
Frontend her zaman eskiyi `sha_a`, yeniyi `sha_b` olarak gönderir (seçim sırasından bağımsız).

### `app/services/` — İş Mantığı

**`github_service.py` — GitHubService**

Her backup'ta atomik commit ile iki dosya yazar:
```
{device_uid}/
  running-config.txt   ← SSH'dan gelen ham config
  _device_info.yaml    ← hostname, ip, vendor, last_backup (her backup'ta değişir)
```
Commit mesajı: `{hostname} - YYYY-MM-DD - HH:MM` (Istanbul saati).
`_device_info.yaml` her backup'ta değiştiği için `list_configs` bu dosyanın commit geçmişini listeler
→ config değişmese bile her backup ayrı commit olarak görünür.

`GitHubService` lazy init: `client` ve `repo` property'leri ilk çağrıda oluşur.
GitHub token runtime'da değiştirilebilir (Settings sayfası) ama `_client` cache'lenmiş olur
→ token güncellenmişse `_client = None` reset edilmeli (mevcut kodda bug: reset yapılmıyor).

**`ssh_collector.py` — collect_config**

Vendor → Netmiko device_type eşleşmesi:
```python
"cisco"     → "cisco_ios"
"fortigate" → "fortinet"
"huawei"    → "huawei"
"aruba"     → "aruba_osswitch"
"aruba_cx"  → "aruba_oscx"
```
SSH işlemi `asyncio.run_in_executor` ile thread pool'da çalışır (blocking IO).
SSH sonrası `config_parser.parse_model_version()` ile model/versiyon çıkarılır.
Sonuç GitHub'a commit edilir. `last_collected_at` router'da güncellenir, servis içinde değil.

**`job_scheduler.py` — APScheduler**

```python
_apscheduler = AsyncIOScheduler(timezone="Europe/Istanbul")
```

Trigger tipleri:
- `interval` → `IntervalTrigger(hours=N)` veya `IntervalTrigger(minutes=N)`
- `daily` → `CronTrigger(hour, minute, timezone="Europe/Istanbul")`
- `weekly` → `CronTrigger(day_of_week, hour, minute, timezone="Europe/Istanbul")`
- `monthly` → `CronTrigger(day, hour, minute, timezone="Europe/Istanbul")`

Job çalışınca (`_run_job`):
1. DB'den scheduler ve cihazları yükler
2. Her cihaz için `collect_config(device)` çağırır
3. `s.last_run_at = datetime.now(ZoneInfo("Europe/Istanbul")).replace(tzinfo=None)` yazar

> **Kritik timezone notu:** `last_run_at` kolonu naive DateTime.
> UTC ile yazılırsa frontend 3 saat yanlış gösterir.
> Her zaman `ZoneInfo("Europe/Istanbul")` kullanılmalı.

**`config_parser.py`** — Regex ile config metninden model/versiyon çıkarır (Cisco, FortiGate, Huawei, Aruba).

**`ping_service.py`** — Cihaz erişilebilirlik servisi.

#### Device Online/Offline Detection (Ping Logic)

`ping_device(ip, port=22, timeout=3.0)` fonksiyonu ICMP (ping) **kullanmaz**.
Bunun yerine hedef IP'ye TCP port 22 (SSH) üzerinde `asyncio.open_connection` ile bağlantı açar.
Bağlantı 3 saniye içinde kurulursa `True` (online), timeout veya hata alınırsa `False` (offline) döner.

**Ne ölçülüyor:**
- TCP port 22'nin SYN/ACK ile yanıt verip vermediği
- Yani: "Bu IP'de SSH servisi TCP bağlantısını kabul ediyor mu?"

**Ne ölçülmüyor:**
- Cihazın gerçek sağlığı (CPU, bellek, arayüz durumu)
- SSH kimlik doğrulamasının başarılı olup olmayacağı
- Konfigürasyonun toplanabilirliği

**Yanıltıcı durumlar:**
- Cihaz ayakta ama port 22 firewall ile kapalıysa → **offline görünür** (yanlış negatif)
- Port 22 açık ama SSH auth başarısız olacaksa → **online görünür**, config toplanamaz
- `8.8.8.8` gibi public IP'lerde port 22 genellikle kapalı olduğundan → **offline** görünür; cihaz aslında erişilebilir olabilir
- VPN/NAT arkasındaki cihazlar, backend'in erişemediği ağ segmentlerindeyse → **offline** görünür

**Özet:** `status = 'online'` → port 22 erişilebilir. `status = 'online'` ≠ cihaz sağlıklı veya config toplanabilir.

### `app/routers/settings.py` — GitHub + SMTP Ayarları

Tüm ayarlar iki yerde saklanır:
1. `site_settings` DB tablosu — key/value (kalıcı)
2. `settings` nesnesi — bellekte (Pydantic Settings)

`main.py` startup'ta DB'den belleğe yükler. UI'dan kayıt edilince hem DB hem bellek güncellenir.

**GitHub:** Token `***` maskelenir; `***` gönderilirse mevcut token korunur. URL formatı kabul edilir.

**SMTP:** `site_settings` tablosunda `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` key'leriyle saklanır.
- Port 465 → `smtplib.SMTP_SSL` (implicit SSL)
- Port 587+ → `smtplib.SMTP` + `STARTTLS`
- Şifre `***` maskelenir; `***` gönderilirse mevcut şifre korunur
- `POST /settings/test-smtp` → giriş yapan super_admin'in email'ine test maili atar (email yoksa 400)

**`email_service.py`:**
- `send_password_reset_email()` — reset akışı için, hata yakalanır + loglanır
- `send_test_email()` — SMTP test için, hata **yakalanmaz** (router'a bırakılır → 400 döner)

**Forgot-password SMTP davranışı:**
- `ENVIRONMENT=development` + SMTP yok → token backend log'una yazılır, 200 döner
- `ENVIRONMENT=production` + SMTP yok → `503 "Mail servisi yapılandırılmamış"` döner

---

## Frontend Mimarisi

### Routing (React Router)

```
/login              → LoginPage          (public)
/forgot-password    → ForgotPasswordPage (public)
/reset-password     → ResetPasswordPage  (public, ?token=... query param)
/                   → DashboardPage      (private)
/devices            → DevicesPage        (private)
/configs            → ConfigsPage        (private)
/schedulers         → SchedulersPage     (private)
/locations          → OrganizationsPage  (private)
/settings           → SettingsPage       (private)
```

### State Yönetimi

**`authStore.js`** (Zustand + persist):
```javascript
{ token, user: { id, username, role }, setToken, setUser, logout,
  isSuperAdmin: () => user?.role === 'super_administrator',
  isReadOnly:   () => user?.role === 'read_only' }
```
`localStorage`'a `auth-storage` key ile persist edilir.
Token süresi dolunca backend 401 döner → interceptor `logout()` çağırır → `/login`'e yönlendirir.

**Not:** `user` nesnesinde email **saklanmaz**. Email gerektiğinde `GET /auth/me` çağrılır (Navbar profil modal'ı bunu yapar).

**`api.js`** (Axios):
- `baseURL: '/api'` → Nginx üzerinden backend'e proxy
- Request interceptor: her isteğe `Authorization: Bearer {token}` ekler
- Response interceptor: 401 → otomatik logout

### Sayfa Mantıkları

**`DevicesPage.jsx`**
- Her 30 saniyede device listesi yenilenir
- Her 10 saniyede tüm cihazlar ping'lenir (UI status güncellemesi)
- `handleDelete` → önce ConfirmModal, sonra API call, 409 gelirse hata toast'ı

**`ConfigsPage.jsx`**
- 3 panel: Filtre+Cihaz | Commit geçmişi | Config içeriği/diff
- `pickForCompare`: iki SHA karşılaştırılmadan önce `commits` listesindeki tarihe bakılır,
  her zaman eskisi `sha_a` (sol), yenisi `sha_b` (sağ) olarak gönderilir
- Seçim sırasından bağımsız olarak diff tutarlıdır

**`SchedulersPage.jsx`**
- `last_run_at` → `new Date(s.last_run_at).toLocaleString('tr-TR')` ile gösterilir
- Naive datetime string geldiğinde tarayıcı local time olarak yorumlar
  → backend'in Istanbul zamanını naive olarak kaydetmesi zorunludur

### i18n (`src/i18n/index.jsx`)

TR ve EN için tüm UI metinleri `tr` ve `en` nesnelerinde saklanır.
`useLanguage()` hook'u ile `t('key')` çağrısıyla erişilir.
`localStorage`'da `lang` key'i ile persist edilir.

### Nginx Yapılandırması

```nginx
location /          → React SPA (index.html fallback)
location /api/      → proxy_pass http://backend:8000/
```
Frontend, `/api/` prefix'ini soyar ve backend'e `/` den başlayan path olarak iletir.

---

## Veritabanı

### Şema Özeti

```
users
  id, username (unique), email (nullable), hashed_password, is_admin, is_active,
  role ('super_administrator' | 'admin' | 'read_only')

password_reset_tokens
  id, user_id → users.id (CASCADE), token (unique 64ch),
  expires_at (TIMESTAMPTZ), used_at (TIMESTAMPTZ nullable)

organizations
  id, name (unique), description

sites
  id, name, location, organization_id → organizations.id

devices
  id, device_uid (12 hex), hostname, ip_address, vendor, model, version,
  config_command, ssh_username, ssh_password, status,
  last_collected_at (TIMESTAMPTZ), site_id → sites.id

schedulers
  id, name, schedule_type, interval_value, interval_unit,
  time_of_day, days_of_week, day_of_month,
  target_type, target_org_id → organizations.id, target_site_id → sites.id,
  is_active, last_run_at (TIMESTAMP — naive Istanbul)

scheduler_devices
  id, scheduler_id → schedulers.id, device_id → devices.id

site_settings
  key (PK), value
  ← GitHub: GITHUB_TOKEN, GITHUB_REPO
  ← SMTP: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
```

### Migration'lar (Alembic)

```
ad9fde8a3a55  initial (temel tablolar)
413b898c209e  add last_collected_at
c3d4e5f6a7b8  add device_uid
d1e2f3a4b5c6  scheduler_extended (yeni alanlar)
e2f3a4b5c6d7  interval_minutes_nullable
f1a2b3c4d5e6  add_user_role + password_reset_tokens
```

Migration çalıştırmak: `alembic upgrade head` (backend container içinde)

---

## Önemli Tasarım Kararları

### Celery → APScheduler Geçişi
Celery kaldırıldı, APScheduler backend process içinde `AsyncIOScheduler` olarak çalışıyor.
Ayrı worker container gerektirmiyor. Redis ve Celery docker-compose ve requirements.txt'ten tamamen kaldırıldı.
`github_service.py` singleton pattern kullanıyor — token güncellenince `reset_client()` çağırılır.

### GitHub Config Depolama Stratejisi
Config değişmese bile her backup ayrı commit oluşturur.
Bunun nedeni: `_device_info.yaml` her backup'ta `last_backup` timestamp'iyle değişir.
`list_configs` bu dosyanın commit geçmişini listeler → her backup kaydı görünür.

### Timezone Tutarlılığı

| Alan | Tip | Kaydedilen değer | Neden |
|---|---|---|---|
| `last_collected_at` | `DateTime(timezone=True)` (TIMESTAMPTZ) | UTC aware | Postgres UTC'ye çevirir, frontend `+00:00` suffix ile doğru okur |
| `last_run_at` | `DateTime` (TIMESTAMP naive) | Istanbul naive | Naive kolona UTC yazılırsa frontend +3 saat yanlış okur |

Bu asimetri teknik borç. İdeal çözüm: `last_run_at` da `DateTime(timezone=True)` olmalı (migration gerekir).

### Cihaz Silme Kısıtı
`scheduler_devices`'ta FK var ama `ON DELETE CASCADE` yok.
Scheduler'a bağlı cihaz silinmeye çalışıldığında PostgreSQL `IntegrityError` fırlatır.
Backend bunu yakalar ve `HTTP 409 + "scheduler_conflict"` döner.
Kullanıcıya toast mesajı: önce scheduler'dan cihazı çıkar, sonra sil.

### SSH Async Wrapper
Netmiko tamamen senkron (blocking). `asyncio.get_event_loop().run_in_executor(None, ...)` ile
thread pool'da çalıştırılır, event loop bloklanmaz.

---

## Güvenlik Notları

- JWT token `SECRET_KEY` ile imzalanır. Production'da `.env`'de güçlü bir key olmalı.
- SSH şifreleri DB'de plain text saklanıyor — production'da şifreleme düşünülmeli.
- GitHub token ve SMTP şifresi `site_settings` tablosunda plain text saklanıyor.
- Tüm endpoint'ler JWT ile korunuyor; read_only kullanıcılar write işlem yapamaz (backend enforce eder).
- Son `super_administrator` silinemez / rolü düşürülemez (backend kontrolü).
- Forgot-password: kullanıcı adı/email varlığı her durumda aynı yanıtla gizlenir (bilgi sızdırmama).

---

## Önemli Değişiklik Geçmişi

### 2026-05-14

**docker-compose.yml**
- `celery_worker` ve `celery_beat` servisleri kaldırıldı
- `version: "3.9"` kaldırıldı (obsolete)

**Cihaz Silme — Scheduler Çakışması (HTTP 409)**
- `backend/app/routers/devices.py`: `delete_device` endpoint'ine `IntegrityError` yakalama eklendi
- `frontend/src/pages/DevicesPage.jsx`: `handleDelete` içine try/catch + hata toast eklendi
- `frontend/src/i18n/index.jsx`: `devices.toast.deleteSchedulerError` TR/EN anahtarları eklendi

**Config Diff — Seçim Sırası Düzeltmesi**
- `frontend/src/pages/ConfigsPage.jsx`: `pickForCompare` fonksiyonu güncellendi
- İki SHA'nın `commits` listesindeki tarihine bakılır; her zaman eskisi sol (`sha_a`), yenisi sağ (`sha_b`)
- Seçim sırasından bağımsız olarak diff tutarlı

**Scheduler Timezone Düzeltmesi**
- `backend/app/services/job_scheduler.py` satır 97:
  - Eski: `datetime.now(timezone.utc).replace(tzinfo=None)` → UTC naive yazıyordu → 3 saat yanlış
  - Yeni: `datetime.now(ZoneInfo("Europe/Istanbul")).replace(tzinfo=None)` → doğru

---

### 2026-05-15

**RBAC Sistemi — Tam implementasyon**

*Backend:*
- `users` tablosuna `role` kolonu eklendi (`super_administrator` / `admin` / `read_only`)
- `password_reset_tokens` tablosu eklendi (şifre sıfırlama akışı)
- `security.py`: `get_current_user`, `get_super_admin_user`, `get_write_user` FastAPI dependency'leri eklendi
- `auth.py`: tüm endpoint'lere yetki eklendi; `/me`, `/users/{id}/profile`, `/users/{id}/password`, `/users/{id}/role`, `/forgot-password`, `/reset-password` eklendi
- Tüm router'lara (devices, configs, organizations, schedulers, settings) JWT koruması eklendi
- `email_service.py`: `send_password_reset_email()` + `send_test_email()` eklendi
- Login yanıtı artık `{ access_token, user: { id, username, role } }` döner (JSON body, form değil)

*DB Migration:*
- `f1a2b3c4d5e6` — users.role + password_reset_tokens tablosu
- `alembic upgrade head` ile uygulandı; mevcut admin kullanıcı `super_administrator` rolü aldı

**SMTP Ayarları — UI'dan yönetim**

- `/settings` → E-posta bölümü: SMTP form (sadece super_admin)
- SMTP ayarları `site_settings` DB tablosuna kaydedilir, startup'ta belleğe yüklenir
- Port 465 → SSL, Port 587 → STARTTLS otomatik ayrımı
- "Test Maili Gönder": giriş yapan kullanıcının email'ine test maili atar
- Gmail App Password kılavuzu UI'da mevcut
- Forgot-password: production'da SMTP yoksa `503` döner (development'ta token log'a yazılır)

**Frontend — Yeni özellikler**

- `authStore`: `role`, `isSuperAdmin()`, `isReadOnly()` eklendi
- `Navbar`: kullanıcı adı yanında kalem ikonu → profil modal (username + email düzenleme + şifre değiştirme)
- `SettingsPage`: 3 bölüm — Entegrasyonlar / E-posta / Yöneticiler (son ikisi sadece super_admin)
- `ForgotPasswordPage` + `ResetPasswordPage`: şifre sıfırlama akışı
- Read-only enforcement: tüm sayfalarda create/edit/delete butonları `isReadOnly()` kontrolüyle gizlenir
- `api.js`: `authApi`, `settingsApi` genişletildi (yeni endpoint çağrıları)
