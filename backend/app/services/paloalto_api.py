import re
import time
import xml.etree.ElementTree as ET

import requests
import urllib3

# Datnes içi cihazlar genelde kendinden imzalı sertifika kullanıyor (diğer vendor
# entegrasyonlarında da SSH host-key doğrulaması aynı sebeple gevşetiliyor).
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# PAN-OS XML API kimlik bilgilerini (password) ve oturum anahtarını (key) GET query
# parametresi olarak bekler. requests/urllib3 bağlantı hatası/timeout mesajları tam
# URL'i (query string dahil) içerir; bu maskeleme olmadan şifre/anahtar, RestoreLog
# tablosuna veya HTTP 500 response body'sine düz metin sızabilir.
_SECRET_PARAM_RE = re.compile(r"((?:password|key)=)[^&\s'\"]*", re.IGNORECASE)


def _sanitize(text: str) -> str:
    return _SECRET_PARAM_RE.sub(r"\1***", text)


def _request(method: str, url: str, **kwargs) -> requests.Response:
    """requests çağrılarını sarar: bağlantı hatası/HTTP hata mesajlarında URL'e
    gömülü password/key query parametrelerinin sızmasını engeller."""
    try:
        resp = getattr(requests, method)(url, **kwargs)
        resp.raise_for_status()
        return resp
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(_sanitize(str(exc))) from None


def _get_api_key_sync(host: str, username: str, password: str, port: int, timeout: int) -> str:
    resp = _request(
        "get",
        f"https://{host}:{port}/api/",
        params={"type": "keygen", "user": username, "password": password},
        verify=False,
        timeout=timeout,
    )
    root = ET.fromstring(resp.text)
    if root.get("status") != "success":
        msg = root.findtext(".//msg") or resp.text[:300]
        raise RuntimeError(f"Palo Alto API anahtarı alınamadı: {msg}")
    key = root.findtext(".//key")
    if not key:
        raise RuntimeError("Palo Alto API anahtarı yanıtta bulunamadı.")
    return key


def _prettify_xml(text: str) -> str:
    """API'nin tek satır döndürdüğü XML'i GUI'nin 'Export configuration version'
    çıktısıyla aynı girintili biçime çevirir (git diff'lerin okunabilir olması için)."""
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return text
    ET.indent(root, space="  ")
    body = ET.tostring(root, encoding="unicode")
    return f'<?xml version="1.0"?>\n{body}\n'


def _export_running_config_sync(host: str, api_key: str, port: int, timeout: int) -> str:
    """GUI'deki 'Export configuration version' ile aynı XML çıktısını üretir."""
    resp = _request(
        "get",
        f"https://{host}:{port}/api/",
        params={"type": "export", "category": "configuration", "key": api_key},
        verify=False,
        timeout=timeout,
    )
    text = resp.text
    if text.lstrip().startswith("<response"):
        root = ET.fromstring(text)
        if root.get("status") == "error":
            msg = root.findtext(".//msg") or text[:300]
            raise RuntimeError(f"Palo Alto config export başarısız: {msg}")
    return _prettify_xml(text)


def _get_system_info_sync(host: str, api_key: str, port: int, timeout: int) -> dict:
    resp = _request(
        "get",
        f"https://{host}:{port}/api/",
        params={"type": "op", "cmd": "<show><system><info></info></system></show>", "key": api_key},
        verify=False,
        timeout=timeout,
    )
    try:
        root = ET.fromstring(resp.text)
        return {
            "model": root.findtext(".//system/model"),
            "version": root.findtext(".//system/sw-version"),
        }
    except ET.ParseError:
        return {"model": None, "version": None}


def collect_sync(host: str, username: str, password: str, port: int = 443, timeout: int = 30) -> dict:
    api_key = _get_api_key_sync(host, username, password, port, timeout)
    config_xml = _export_running_config_sync(host, api_key, port, timeout)
    info = _get_system_info_sync(host, api_key, port, timeout)
    return {"config": config_xml, **info}


def import_config_sync(
    host: str, api_key: str, filename: str, content: str, port: int, timeout: int
) -> None:
    """Config dosyasını PAN-OS'e yükler (GUI'deki Device > Operations >
    'Import named configuration snapshot' ile aynı API: type=import&category=configuration)."""
    resp = _request(
        "post",
        f"https://{host}:{port}/api/",
        params={"type": "import", "category": "configuration", "key": api_key},
        files={"file": (filename, content.encode("utf-8"))},
        verify=False,
        timeout=timeout,
    )
    text = resp.text
    if text.lstrip().startswith("<response"):
        root = ET.fromstring(text)
        if root.get("status") == "error":
            msg = root.findtext(".//msg") or text[:300]
            raise RuntimeError(f"Palo Alto config yüklemesi (import) başarısız: {msg}")


def load_config_sync(host: str, api_key: str, filename: str, port: int, timeout: int) -> None:
    """Yüklenen dosyayı candidate config olarak devreye alır
    (GUI'deki 'Load named configuration snapshot' ile aynı davranış)."""
    resp = _request(
        "get",
        f"https://{host}:{port}/api/",
        params={
            "type": "op",
            "cmd": f"<load><config><from>{filename}</from></config></load>",
            "key": api_key,
        },
        verify=False,
        timeout=timeout,
    )
    root = ET.fromstring(resp.text)
    if root.get("status") == "error":
        msg = root.findtext(".//msg") or resp.text[:300]
        raise RuntimeError(f"Palo Alto config yükleme (load) başarısız: {msg}")


def commit_sync(host: str, api_key: str, port: int, timeout: int) -> str:
    """Candidate config'i commit eder, job tamamlanana kadar (~60sn, 2sn aralıklarla) poll eder.
    Dönüş: commit job'ının sonuç mesajı (audit log için)."""
    resp = _request(
        "get",
        f"https://{host}:{port}/api/",
        params={"type": "commit", "cmd": "<commit></commit>", "key": api_key},
        verify=False,
        timeout=timeout,
    )
    root = ET.fromstring(resp.text)
    if root.get("status") == "error":
        msg = root.findtext(".//msg") or resp.text[:300]
        raise RuntimeError(f"Palo Alto commit başlatılamadı: {msg}")

    job_id = root.findtext(".//job")
    if not job_id:
        # Bazı PAN-OS sürümlerinde değişiklik yoksa commit hemen job üretmeden döner
        return root.findtext(".//msg/line") or root.findtext(".//msg") or "Commit tamamlandı (değişiklik yoktu)."

    max_attempts = 30
    for _ in range(max_attempts):
        time.sleep(2)
        status_resp = _request(
            "get",
            f"https://{host}:{port}/api/",
            params={
                "type": "op",
                "cmd": f"<show><jobs><id>{job_id}</id></jobs></show>",
                "key": api_key,
            },
            verify=False,
            timeout=timeout,
        )
        status_root = ET.fromstring(status_resp.text)
        job_status = status_root.findtext(".//job/status")
        if job_status == "FIN":
            result = status_root.findtext(".//job/result")
            if result != "OK":
                details = status_root.findtext(".//job/details") or status_resp.text[:300]
                raise RuntimeError(f"Palo Alto commit başarısız: {details}")
            return status_root.findtext(".//job/details") or "Commit başarılı."

    raise RuntimeError("Palo Alto commit işlemi zaman aşımına uğradı (job tamamlanmadı).")
