import xml.etree.ElementTree as ET

import requests
import urllib3

# Datnes içi cihazlar genelde kendinden imzalı sertifika kullanıyor (diğer vendor
# entegrasyonlarında da SSH host-key doğrulaması aynı sebeple gevşetiliyor).
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def _get_api_key_sync(host: str, username: str, password: str, port: int, timeout: int) -> str:
    resp = requests.get(
        f"https://{host}:{port}/api/",
        params={"type": "keygen", "user": username, "password": password},
        verify=False,
        timeout=timeout,
    )
    resp.raise_for_status()
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
    resp = requests.get(
        f"https://{host}:{port}/api/",
        params={"type": "export", "category": "configuration", "key": api_key},
        verify=False,
        timeout=timeout,
    )
    resp.raise_for_status()
    text = resp.text
    if text.lstrip().startswith("<response"):
        root = ET.fromstring(text)
        if root.get("status") == "error":
            msg = root.findtext(".//msg") or text[:300]
            raise RuntimeError(f"Palo Alto config export başarısız: {msg}")
    return _prettify_xml(text)


def _get_system_info_sync(host: str, api_key: str, port: int, timeout: int) -> dict:
    resp = requests.get(
        f"https://{host}:{port}/api/",
        params={"type": "op", "cmd": "<show><system><info></info></system></show>", "key": api_key},
        verify=False,
        timeout=timeout,
    )
    resp.raise_for_status()
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
