"""
LLDP/CDP komşu keşfi servisi.
Mevcut SSH altyapısını (_ssh_collect_sync) yeniden kullanır.
Her vendor için özel parser fonksiyonu içerir.
"""
import asyncio
import json
import re
from functools import partial

from app.services.ssh_collector import (
    VENDOR_DEVICE_TYPE_SSH,
    VENDOR_DEVICE_TYPE_TELNET,
    _ssh_collect_sync,
    _ssh_multi_sync,
)

LLDP_COMMANDS = {
    "cisco":     "show lldp neighbors detail",
    "fortigate": "get system lldp neighbors-detail",
    "huawei":    "display lldp neighbor",
    "aruba":     "show lldp info remote-device detail",
    "aruba_cx":  "show lldp neighbors detail",
}

CDP_COMMAND = "show cdp neighbors detail"


# ── Parser'lar ─────────────────────────────────────────────────────────────────

def _parse_cisco_lldp(output: str) -> list[dict]:
    neighbors = []
    blocks = re.split(r'-{10,}', output)
    for block in blocks:
        if not block.strip():
            continue
        local_port = None
        m = re.search(r'Local Intf:\s*(\S+)', block, re.IGNORECASE)
        if m:
            local_port = m.group(1)

        system_name = None
        m = re.search(r'System Name:\s*(\S+)', block, re.IGNORECASE)
        if m:
            system_name = m.group(1).strip()

        port_id = None
        m = re.search(r'Port id:\s*(\S+)', block, re.IGNORECASE)
        if m:
            port_id = m.group(1)

        mgmt_ip = None
        m = re.search(r'\bIP(?:\s+address)?:\s*([\d.]+)', block, re.IGNORECASE)
        if m:
            mgmt_ip = m.group(1)

        if local_port and (system_name or mgmt_ip):
            neighbors.append({
                "local_port": local_port,
                "neighbor_hostname": system_name,
                "neighbor_ip": mgmt_ip,
                "neighbor_port": port_id,
                "protocol": "lldp",
            })
    return neighbors


def _parse_cisco_cdp(output: str) -> list[dict]:
    neighbors = []
    blocks = re.split(r'-{10,}', output)
    for block in blocks:
        if not block.strip():
            continue

        device_id = None
        m = re.search(r'Device ID:\s*(\S+)', block, re.IGNORECASE)
        if m:
            device_id = m.group(1).split('.')[0]

        ip_addr = None
        m = re.search(r'IP address:\s*([\d.]+)', block, re.IGNORECASE)
        if m:
            ip_addr = m.group(1)

        local_intf = None
        m = re.search(r'Interface:\s*(\S+),', block, re.IGNORECASE)
        if m:
            local_intf = m.group(1).rstrip(',')

        remote_port = None
        m = re.search(r'Port ID \(outgoing port\):\s*(\S+)', block, re.IGNORECASE)
        if m:
            remote_port = m.group(1)

        if local_intf and (device_id or ip_addr):
            neighbors.append({
                "local_port": local_intf,
                "neighbor_hostname": device_id,
                "neighbor_ip": ip_addr,
                "neighbor_port": remote_port,
                "protocol": "cdp",
            })
    return neighbors


def _parse_fortigate_lldp(output: str) -> list[dict]:
    neighbors = []
    blocks = re.split(r'==\s*\[', output)
    for block in blocks:
        if not block.strip():
            continue

        local_port = None
        m = re.match(r'\s*(\S+)\s*\]', block)
        if m:
            local_port = m.group(1)

        system_name = None
        m = re.search(r'System name\s*:\s*(.+)', block, re.IGNORECASE)
        if m:
            system_name = m.group(1).strip()

        port_id = None
        m = re.search(r'Port ID\s*:\s*(\S+)', block, re.IGNORECASE)
        if m:
            port_id = m.group(1)

        mgmt_ip = None
        m = re.search(r'Mgmt IP addr\s*:\s*([\d.]+)', block, re.IGNORECASE)
        if not m:
            m = re.search(r'Management IP\s*:\s*([\d.]+)', block, re.IGNORECASE)
        if m:
            mgmt_ip = m.group(1)

        if local_port and (system_name or mgmt_ip):
            neighbors.append({
                "local_port": local_port,
                "neighbor_hostname": system_name,
                "neighbor_ip": mgmt_ip,
                "neighbor_port": port_id,
                "protocol": "lldp",
            })
    return neighbors


def _parse_huawei_lldp(output: str) -> list[dict]:
    neighbors = []
    port_blocks = re.split(r'\n(?=\S+\s+has\s+\d+\s+neighbor)', output, flags=re.IGNORECASE)
    for block in port_blocks:
        local_port = None
        m = re.match(r'(\S+)\s+has\s+\d+\s+neighbor', block, re.IGNORECASE)
        if m:
            local_port = m.group(1)
        if not local_port:
            continue

        system_name = None
        m = re.search(r'SystemName\s*:\s*(.+)', block, re.IGNORECASE)
        if m:
            system_name = m.group(1).strip()

        port_id = None
        m = re.search(r'PortID\s*:\s*(\S+)', block, re.IGNORECASE)
        if m:
            port_id = m.group(1)

        mgmt_ip = None
        m = re.search(r'ManagementAddress\s*\[\d+\]\s*:\s*([\d.]+)', block, re.IGNORECASE)
        if not m:
            m = re.search(r'ManagementAddress\s*:\s*([\d.]+)', block, re.IGNORECASE)
        if m:
            mgmt_ip = m.group(1).strip()

        if system_name or mgmt_ip:
            neighbors.append({
                "local_port": local_port,
                "neighbor_hostname": system_name,
                "neighbor_ip": mgmt_ip,
                "neighbor_port": port_id,
                "protocol": "lldp",
            })
    return neighbors


def _parse_aruba_brief_ports(output: str) -> list[str]:
    """
    'show lldp info remote-device' kısa çıktısından benzersiz port numaralarını çıkarır.
    Satır formatı:
      1         | d4 c9 ef 22 fa 80         42     Port #42  SISTEM-DESTEK
    """
    ports = []
    seen = set()
    for line in output.splitlines():
        m = re.match(r'\s+(\d+)\s+\|', line)
        if m:
            p = m.group(1)
            if p not in seen:
                seen.add(p)
                ports.append(p)
    return ports


def _parse_aruba_detail(local_port: str, output: str) -> list[dict]:
    """
    'show lldp info remote-device {N}' çıktısını ayrıştırır.
    Bir port üzerinde birden fazla komşu olabilir (örn. hub/AP arkasındaki cihazlar).
    Çıktı formatı:
      Local Port   : 1
      ChassisType  : mac-address
      ChassisId    : d4 c9 ef 22 fa 80
      PortType     : local
      PortId       : 42
      SysName      : SISTEM-DESTEK
      ...
      Remote Management Address
         Type    : ipv4
         Address : 192.168.2.10
    """
    if not output or not output.strip():
        return []

    neighbors = []

    # Birden fazla komşu bloğu olabilir; "Local Port" ile başlayan bloklara ayır
    # Boş satırlar ile ayrılmış bloklar
    blocks = re.split(r'\n\s*\n', output.strip())

    current: dict = {}
    for block in blocks:
        # Her blokta ilgili alanları ara
        # \s* yerine [ \t]* kullanıyoruz: boş SysName satırının sonundaki
        # \r\n'yi "geçip" bir sonraki satırı (System Descr :) yakalamamak için.
        sys_name = None
        m = re.search(r'SysName[ \t]*:[ \t]*([^\r\n]+)', block, re.IGNORECASE)
        if m:
            v = m.group(1).strip()
            if v:
                sys_name = v

        port_id = None
        m = re.search(r'PortId[ \t]*:[ \t]*([^\r\n]+)', block, re.IGNORECASE)
        if m:
            port_id = m.group(1).strip() or None

        addr = None
        m = re.search(r'Address[ \t]*:[ \t]*([\d.]+)', block, re.IGNORECASE)
        if m:
            addr = m.group(1)

        # SysName içeren blok → yeni komşu başlangıcı
        if sys_name:
            if current:
                neighbors.append(current)
            current = {
                "local_port": local_port,
                "neighbor_hostname": sys_name,
                "neighbor_ip": None,
                "neighbor_port": port_id,
                "protocol": "lldp",
            }
        # Address içeren blok → mevcut komşuya IP ekle
        if addr and current:
            current["neighbor_ip"] = addr

    if current:
        neighbors.append(current)

    return neighbors


def _parse_aruba_cx_lldp(output: str) -> list[dict]:
    neighbors = []
    blocks = re.split(r'\n\s*Port\s*:\s*', output)
    for block in blocks[1:]:
        local_port = None
        m = re.match(r'(\S+)', block)
        if m:
            local_port = m.group(1)

        system_name = None
        m = re.search(r'Neighbor System Name\s*:\s*(.+)', block, re.IGNORECASE)
        if m:
            system_name = m.group(1).strip()

        port_id = None
        m = re.search(r'Neighbor Port-ID\s*:\s*(\S+)', block, re.IGNORECASE)
        if m:
            port_id = m.group(1)

        mgmt_ip = None
        m = re.search(r'Neighbor Management Address IPv4\s*:\s*([\d.]+)', block, re.IGNORECASE)
        if not m:
            m = re.search(r'Management IP\s*:\s*([\d.]+)', block, re.IGNORECASE)
        if m:
            mgmt_ip = m.group(1)

        if local_port and (system_name or mgmt_ip):
            neighbors.append({
                "local_port": local_port,
                "neighbor_hostname": system_name,
                "neighbor_ip": mgmt_ip,
                "neighbor_port": port_id,
                "protocol": "lldp",
            })
    return neighbors


def _parse(vendor: str, output: str) -> list[dict]:
    if not output or not output.strip():
        return []
    vendor = vendor.lower()
    if vendor == "cisco":
        return _parse_cisco_lldp(output)
    elif vendor == "fortigate":
        return _parse_fortigate_lldp(output)
    elif vendor == "huawei":
        return _parse_huawei_lldp(output)
    elif vendor == "aruba_cx":
        return _parse_aruba_cx_lldp(output)
    return []


# ── Ana keşif fonksiyonu ────────────────────────────────────────────────────────

async def discover_neighbors(device) -> list[dict]:
    """
    Cihaza SSH ile bağlanır, LLDP/CDP komutunu çalıştırır,
    çıktıyı ayrıştırarak komşu listesi döner.
    """
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

    loop = asyncio.get_event_loop()

    # Aruba OS Switch: iki adımlı keşif (brief → port listesi → her port için detail)
    if vendor == "aruba":
        return await _discover_aruba_neighbors(
            loop, device_type, device.ip_address, username, password,
            port, enable_secret, kex_algs, host_key_algs, cipher_algs,
        )

    lldp_command = LLDP_COMMANDS.get(vendor, "show lldp neighbors detail")

    output = await loop.run_in_executor(
        None,
        partial(
            _ssh_collect_sync,
            device_type,
            device.ip_address,
            username,
            password,
            lldp_command,
            10,
            port,
            enable_secret,
            kex_algs,
            host_key_algs,
            cipher_algs,
        ),
    )

    neighbors = _parse(vendor, output)

    # Cisco'da LLDP boşsa CDP dene
    if vendor == "cisco" and not neighbors:
        try:
            cdp_output = await loop.run_in_executor(
                None,
                partial(
                    _ssh_collect_sync,
                    device_type,
                    device.ip_address,
                    username,
                    password,
                    CDP_COMMAND,
                    10,
                    port,
                    enable_secret,
                    kex_algs,
                    host_key_algs,
                    cipher_algs,
                ),
            )
            neighbors = _parse_cisco_cdp(cdp_output)
        except Exception:
            pass

    return neighbors


async def _discover_aruba_neighbors(
    loop, device_type, host, username, password,
    port, enable_secret, kex_algs, host_key_algs, cipher_algs,
) -> list[dict]:
    """
    Aruba OS Switch için iki adımlı LLDP keşfi:
    1. 'show lldp info remote-device' → komşusu olan port numaralarını çıkar
    2. Her port için 'show lldp info remote-device {N}' → IP + hostname
    """
    # Adım 1: kısa liste
    brief = await loop.run_in_executor(
        None,
        partial(
            _ssh_collect_sync,
            device_type, host, username, password,
            "show lldp info remote-device",
            10, port, enable_secret, kex_algs, host_key_algs, cipher_algs,
        ),
    )

    port_numbers = _parse_aruba_brief_ports(brief)
    if not port_numbers:
        return []

    # Adım 2: tek oturumda tüm portların detayını al
    commands = [f"show lldp info remote-device {p}" for p in port_numbers]
    try:
        outputs = await loop.run_in_executor(
            None,
            partial(
                _ssh_multi_sync,
                device_type, host, username, password,
                commands,
                10, port, enable_secret, kex_algs, host_key_algs, cipher_algs,
            ),
        )
    except Exception:
        return []

    neighbors = []
    for p, detail_output in zip(port_numbers, outputs):
        neighbors.extend(_parse_aruba_detail(p, detail_output))

    return neighbors
