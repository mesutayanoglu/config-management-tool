import asyncio
from functools import partial

from netmiko import ConnectHandler
from app.services.github_service import github_service as github
from app.services.config_parser import parse_model_version

# Aruba: aruba_osswitch = fiziksel Aruba/HPE switch'ler
#        aruba_os       = ArubaOS wireless controller
#        aruba_oscx     = Aruba CX (yeni nesil)
VENDOR_DEVICE_TYPE = {
    "cisco":     "cisco_ios",
    "fortigate": "fortinet",
    "huawei":    "huawei",
    "aruba":     "aruba_osswitch",
    "aruba_cx":  "aruba_oscx",
}


def _ssh_collect_sync(device_type: str, host: str, username: str, password: str,
                      command: str, timeout: int) -> str:
    params = {
        "device_type": device_type,
        "host": host,
        "username": username,
        "password": password,
        "timeout": timeout,
        "conn_timeout": timeout,
        "global_delay_factor": 2,
    }
    with ConnectHandler(**params) as conn:
        output = conn.send_command(command, read_timeout=60)
    return output


async def collect_config(device) -> dict:
    device_type = VENDOR_DEVICE_TYPE.get(device.vendor.lower(), "cisco_ios")

    loop = asyncio.get_event_loop()
    output = await loop.run_in_executor(
        None,
        partial(
            _ssh_collect_sync,
            device_type,
            device.ip_address,
            device.ssh_username,
            device.ssh_password,
            device.config_command or "show running-config",
            30,
        ),
    )

    if not output or not output.strip():
        raise RuntimeError(
            f"SSH bağlantısı kuruldu ancak komut çıktısı boş geldi. "
            f"Cihaz tipi '{device_type}' doğru mu? "
            f"Komut: '{device.config_command}'"
        )

    github_path = await github.commit_config(
        device.device_uid, device.hostname, device.ip_address, device.vendor, output
    )
    parsed = parse_model_version(device.vendor, output)

    return {"github_path": github_path, **parsed}
