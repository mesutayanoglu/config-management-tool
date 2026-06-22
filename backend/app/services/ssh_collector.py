import asyncio
import json
import threading
from functools import partial

import paramiko
from netmiko import ConnectHandler

from app.services.github_service import github_service as github
from app.services.config_parser import parse_model_version

# ── Global default: legacy KEX algoritmaları etkinleştir ─────────────────────
# Paramiko 3.x'te bu algoritmalar _kex_info'da mevcuttur ancak
# _preferred_kex listesinde yer almaz. Eski cihazlarla (FortiGate, Aruba,
# Huawei vb.) bağlantı kurabilmek için buraya ekleniyor.
def _enable_legacy_kex():
    from paramiko.transport import Transport
    legacy = [
        "diffie-hellman-group14-sha1",
        "diffie-hellman-group-exchange-sha1",
        "diffie-hellman-group1-sha1",
    ]
    supported = getattr(Transport, "_kex_info", {})
    current = list(Transport._preferred_kex)
    for algo in legacy:
        if algo in supported and algo not in current:
            current.append(algo)
    Transport._preferred_kex = tuple(current)


_enable_legacy_kex()

# ── Per-bağlantı algoritma kilidi ────────────────────────────────────────────
# Profil tabanlı algoritma ayarları, Paramiko Transport'un class-level
# değişkenlerini geçici olarak günceller. Lock, eş zamanlı bağlantıların
# bu global state'i bozmamasını sağlar (KEX negotiation tamamlanana kadar
# kilit tutulur, ardından varsayılana geri döner).
_kex_lock = threading.Lock()

VENDOR_DEVICE_TYPE_SSH = {
    "cisco":     "cisco_ios",
    "fortigate": "fortinet",
    "huawei":    "huawei",
    "aruba":     "aruba_osswitch",
    "aruba_cx":  "aruba_oscx",
}

VENDOR_DEVICE_TYPE_TELNET = {
    "cisco":     "cisco_ios_telnet",
    "fortigate": "fortinet",           # Netmiko'da telnet varyantı yok, SSH tipini kullan
    "huawei":    "huawei_telnet",
    "aruba":     "aruba_osswitch",     # Netmiko'da telnet varyantı yok
    "aruba_cx":  "aruba_oscx",         # Netmiko'da telnet varyantı yok
}


def _ssh_collect_sync(
    device_type: str,
    host: str,
    username: str,
    password: str,
    command: str,
    timeout: int,
    port: int = 22,
    enable_secret: str | None = None,
    kex_algs: list | None = None,
    host_key_algs: list | None = None,
    cipher_algs: list | None = None,
) -> str:
    need_lock = bool(kex_algs or host_key_algs or cipher_algs)
    saved = {}

    if need_lock:
        _kex_lock.acquire()
        if kex_algs:
            saved["kex"] = paramiko.Transport._preferred_kex
            paramiko.Transport._preferred_kex = tuple(kex_algs)
        if host_key_algs:
            saved["keys"] = paramiko.Transport._preferred_keys
            paramiko.Transport._preferred_keys = tuple(host_key_algs)
        if cipher_algs:
            saved["ciphers"] = paramiko.Transport._preferred_ciphers
            paramiko.Transport._preferred_ciphers = tuple(cipher_algs)

    conn = None
    try:
        params = {
            "device_type": device_type,
            "host": host,
            "username": username,
            "password": password,
            "port": port,
            "timeout": timeout,
            "conn_timeout": timeout,
            "global_delay_factor": 2,
        }
        if enable_secret:
            params["secret"] = enable_secret
        conn = ConnectHandler(**params)

        # Bağlantı kuruldu, KEX tamamlandı → kilidi bırak, global state'i geri yükle
        if need_lock:
            if "kex" in saved:
                paramiko.Transport._preferred_kex = saved["kex"]
            if "keys" in saved:
                paramiko.Transport._preferred_keys = saved["keys"]
            if "ciphers" in saved:
                paramiko.Transport._preferred_ciphers = saved["ciphers"]
            _kex_lock.release()
            need_lock = False

        # Cisco: enable_secret verilmese bile user exec modunda kalınırsa
        # privileged exec moduna geç (şifresiz enable için de gerekli)
        if device_type.startswith("cisco") and not conn.check_enable_mode():
            conn.enable()

        output = conn.send_command(command, read_timeout=60)
        conn.disconnect()
        return output

    except Exception:
        if need_lock:
            if "kex" in saved:
                paramiko.Transport._preferred_kex = saved["kex"]
            if "keys" in saved:
                paramiko.Transport._preferred_keys = saved["keys"]
            if "ciphers" in saved:
                paramiko.Transport._preferred_ciphers = saved["ciphers"]
            _kex_lock.release()
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass
        raise


def _ssh_multi_sync(
    device_type: str,
    host: str,
    username: str,
    password: str,
    commands: list,
    timeout: int,
    port: int = 22,
    enable_secret: str | None = None,
    kex_algs: list | None = None,
    host_key_algs: list | None = None,
    cipher_algs: list | None = None,
) -> list:
    """Tek SSH oturumunda birden fazla komut çalıştırır, çıktıları liste olarak döner."""
    need_lock = bool(kex_algs or host_key_algs or cipher_algs)
    saved = {}

    if need_lock:
        _kex_lock.acquire()
        if kex_algs:
            saved["kex"] = paramiko.Transport._preferred_kex
            paramiko.Transport._preferred_kex = tuple(kex_algs)
        if host_key_algs:
            saved["keys"] = paramiko.Transport._preferred_keys
            paramiko.Transport._preferred_keys = tuple(host_key_algs)
        if cipher_algs:
            saved["ciphers"] = paramiko.Transport._preferred_ciphers
            paramiko.Transport._preferred_ciphers = tuple(cipher_algs)

    conn = None
    try:
        params = {
            "device_type": device_type,
            "host": host,
            "username": username,
            "password": password,
            "port": port,
            "timeout": timeout,
            "conn_timeout": timeout,
            "global_delay_factor": 2,
        }
        if enable_secret:
            params["secret"] = enable_secret
        conn = ConnectHandler(**params)

        if need_lock:
            if "kex" in saved:
                paramiko.Transport._preferred_kex = saved["kex"]
            if "keys" in saved:
                paramiko.Transport._preferred_keys = saved["keys"]
            if "ciphers" in saved:
                paramiko.Transport._preferred_ciphers = saved["ciphers"]
            _kex_lock.release()
            need_lock = False

        if device_type.startswith("cisco") and not conn.check_enable_mode():
            conn.enable()

        outputs = []
        for cmd in commands:
            out = conn.send_command(cmd, read_timeout=60)
            outputs.append(out)

        conn.disconnect()
        return outputs

    except Exception:
        if need_lock:
            if "kex" in saved:
                paramiko.Transport._preferred_kex = saved["kex"]
            if "keys" in saved:
                paramiko.Transport._preferred_keys = saved["keys"]
            if "ciphers" in saved:
                paramiko.Transport._preferred_ciphers = saved["ciphers"]
            _kex_lock.release()
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass
        raise


async def collect_config(device) -> dict:
    vendor = device.vendor.lower()

    # Kimlik bilgileri: önce profil, yoksa cihazın kendi alanları
    if device.credential_profile:
        p = device.credential_profile
        conn_type = (p.connection_type or "ssh").lower()
        username = p.username
        password = p.password
        port = p.port
        enable_secret = p.enable_secret or None
        kex_algs = json.loads(p.kex_algs) if p.kex_algs else None
        host_key_algs = json.loads(p.host_key_algs) if p.host_key_algs else None
        cipher_algs = json.loads(p.cipher_algs) if p.cipher_algs else None
    else:
        conn_type = "ssh"
        username = device.ssh_username
        password = device.ssh_password
        port = 22
        enable_secret = None
        kex_algs = None
        host_key_algs = None
        cipher_algs = None

    if conn_type == "telnet":
        device_type = VENDOR_DEVICE_TYPE_TELNET.get(vendor, "cisco_ios_telnet")
        # Telnet'te SSH algoritma overrideleri anlamsız, temizle
        kex_algs = None
        host_key_algs = None
        cipher_algs = None
    else:
        device_type = VENDOR_DEVICE_TYPE_SSH.get(vendor, "cisco_ios")

    loop = asyncio.get_event_loop()
    output = await loop.run_in_executor(
        None,
        partial(
            _ssh_collect_sync,
            device_type,
            device.ip_address,
            username,
            password,
            device.config_command or "show running-config",
            30,
            port,
            enable_secret,
            kex_algs,
            host_key_algs,
            cipher_algs,
        ),
    )

    if not output or not output.strip():
        raise RuntimeError(
            f"SSH bağlantısı kuruldu ancak komut çıktısı boş geldi. "
            f"Cihaz tipi '{device_type}' doğru mu? "
            f"Komut: '{device.config_command}'"
        )

    # Cisco hata çıktısını yakala: kısa çıktı + "% " hata satırı içeriyorsa kaydetme
    stripped = output.strip()
    stripped_lines = [l for l in stripped.splitlines() if l.strip()]
    if len(stripped_lines) <= 3 and any(l.lstrip().startswith("% ") for l in stripped_lines):
        raise RuntimeError(
            f"Cihaz hata yanıtı döndürdü (yetersiz yetki veya geçersiz komut): "
            f"{stripped[:300]}"
        )

    old_content = await github.get_config(device.device_uid)
    github_path = await github.commit_config(
        device.device_uid, device.hostname, device.ip_address, device.vendor, output
    )
    parsed = parse_model_version(device.vendor, output)
    changed = old_content is not None and old_content.strip() != output.strip()

    return {
        "github_path": github_path,
        "changed": changed,
        "old_content": old_content or "",
        "new_content": output,
        **parsed,
    }
