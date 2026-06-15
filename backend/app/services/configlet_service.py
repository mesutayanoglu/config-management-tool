import asyncio
import json
import queue as queue_module
import re
import time
from functools import partial
from typing import AsyncGenerator

import paramiko
from jinja2 import Template, TemplateError
from netmiko import ConnectHandler

from app.services.ssh_collector import (
    VENDOR_DEVICE_TYPE_SSH,
    VENDOR_DEVICE_TYPE_TELNET,
    _kex_lock,
)


def extract_variables(content: str) -> list[str]:
    matches = re.findall(r'\{\{\s*(\w+)\s*\}\}', content)
    seen = set()
    result = []
    for m in matches:
        if m not in seen:
            seen.add(m)
            result.append(m)
    return result


def render_template(content: str, variables: dict) -> str:
    template = Template(content)
    return template.render(**variables)


def _execute_configlet_sync(
    device_type: str,
    host: str,
    username: str,
    password: str,
    commands: list[str],
    port: int = 22,
    enable_secret: str | None = None,
    kex_algs: list | None = None,
    host_key_algs: list | None = None,
    cipher_algs: list | None = None,
    _log_queue: queue_module.Queue | None = None,
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
            "timeout": 30,
            "conn_timeout": 30,
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

        # Cisco: enable_secret verilmese bile user exec modunda kalınırsa
        # privileged exec moduna geç (send_config_set config modunu gerektirir)
        if device_type.startswith("cisco") and not conn.check_enable_mode():
            conn.enable()

        if _log_queue is not None:
            _log_queue.put({"type": "sending", "count": len(commands)})

        # cmd_verify=False: Netmiko does not wait for the prompt after each command.
        # This fixes the "hostname/sysname changes the prompt mid-session" bug where
        # Netmiko would fail to match the original prompt after a rename command,
        # even though the command was successfully applied on the device.
        # exit_config_mode=False: we handle exit manually below for the same reason.
        output = conn.send_config_set(
            commands,
            read_timeout=60,
            cmd_verify=False,
            exit_config_mode=False,
        )

        # Attempt to exit config mode; silently ignore if prompt changed (e.g. hostname cmd).
        try:
            conn.exit_config_mode()
        except Exception:
            pass

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


def _build_exec_params(device):
    """Extract connection params from device model."""
    vendor = device.vendor.lower()

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
        kex_algs = None
        host_key_algs = None
        cipher_algs = None
    else:
        device_type = VENDOR_DEVICE_TYPE_SSH.get(vendor, "cisco_ios")

    return device_type, username, password, port, enable_secret, kex_algs, host_key_algs, cipher_algs


async def execute_on_device(device, rendered_content: str) -> dict:
    """Original concurrent execution (non-streaming)."""
    start = time.monotonic()

    commands = [
        line for line in rendered_content.split('\n')
        if line.strip() and not line.strip().startswith('!')
    ]

    if not commands:
        return {
            "device_id": device.id,
            "hostname": device.hostname,
            "ip_address": device.ip_address,
            "status": "failed",
            "output": None,
            "error": "Şablon render sonrası çalıştırılacak komut bulunamadı.",
            "duration_ms": 0,
        }

    device_type, username, password, port, enable_secret, kex_algs, host_key_algs, cipher_algs = _build_exec_params(device)

    try:
        loop = asyncio.get_running_loop()
        output = await loop.run_in_executor(
            None,
            partial(
                _execute_configlet_sync,
                device_type, device.ip_address, username, password,
                commands, port, enable_secret, kex_algs, host_key_algs, cipher_algs,
            ),
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        return {
            "device_id": device.id,
            "hostname": device.hostname,
            "ip_address": device.ip_address,
            "status": "success",
            "output": output,
            "error": None,
            "duration_ms": duration_ms,
        }
    except Exception as e:
        duration_ms = int((time.monotonic() - start) * 1000)
        return {
            "device_id": device.id,
            "hostname": device.hostname,
            "ip_address": device.ip_address,
            "status": "failed",
            "output": None,
            "error": str(e),
            "duration_ms": duration_ms,
        }


async def execute_on_device_streaming(device, rendered_content: str) -> AsyncGenerator[dict, None]:
    """Async generator that streams progress events while executing on a device."""
    commands = [
        line for line in rendered_content.split('\n')
        if line.strip() and not line.strip().startswith('!')
    ]

    base = {
        "device_id": device.id,
        "hostname": device.hostname,
        "ip_address": device.ip_address,
    }

    if not commands:
        yield {**base, "type": "done", "status": "failed",
               "error": "Çalıştırılacak komut bulunamadı.", "duration_ms": 0, "output": None}
        return

    device_type, username, password, port, enable_secret, kex_algs, host_key_algs, cipher_algs = _build_exec_params(device)

    yield {**base, "type": "connecting"}

    start = time.monotonic()
    log_q: queue_module.Queue = queue_module.Queue()

    def _run():
        try:
            out = _execute_configlet_sync(
                device_type, device.ip_address, username, password,
                commands, port, enable_secret, kex_algs, host_key_algs, cipher_algs,
                _log_queue=log_q,
            )
            log_q.put(("__result__", out, None))
        except Exception as exc:
            log_q.put(("__result__", None, exc))

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, _run)

    # Drain progress events from the queue while the thread is running.
    while True:
        try:
            item = log_q.get_nowait()
        except queue_module.Empty:
            await asyncio.sleep(0.08)
            continue

        if isinstance(item, dict):
            # Progress event from inside the sync function
            yield {**base, **item}
        elif isinstance(item, tuple) and item[0] == "__result__":
            _, output, exc = item
            break

    duration_ms = int((time.monotonic() - start) * 1000)
    if exc:
        yield {**base, "type": "done", "status": "failed",
               "error": str(exc), "output": None, "duration_ms": duration_ms}
    else:
        yield {**base, "type": "done", "status": "success",
               "error": None, "output": output, "duration_ms": duration_ms}
