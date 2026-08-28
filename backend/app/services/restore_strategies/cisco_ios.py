import asyncio
import io
from functools import partial

from netmiko import ConnectHandler
from scp import SCPClient

from app.services.restore_strategies.base import BaseRestoreStrategy
from app.services.ssh_collector import build_conn_params, open_ssh_client_sync


def _cisco_restore_sync(params: dict, config_content: str) -> str:
    ssh_client = None
    conn = None
    try:
        ssh_client = open_ssh_client_sync(
            params["host"], params["port"], params["username"], params["password"],
            30, params["kex_algs"], params["host_key_algs"], params["cipher_algs"],
        )

        scp = SCPClient(ssh_client.get_transport())
        try:
            buf = io.BytesIO(config_content.encode("utf-8"))
            scp.putfo(buf, "flash:restore-config.txt")
        finally:
            scp.close()

        conn_params = {
            "device_type": "cisco_ios",
            "host": params["host"],
            "username": params["username"],
            "password": params["password"],
            "port": params["port"],
            "timeout": 30,
            "conn_timeout": 30,
            "global_delay_factor": 2,
        }
        if params.get("enable_secret"):
            conn_params["secret"] = params["enable_secret"]
        conn = ConnectHandler(**conn_params)

        # Cisco: enable_secret verilmese bile user exec modunda kalınırsa
        # privileged exec moduna geç (configure replace bunu gerektirir)
        if not conn.check_enable_mode():
            conn.enable()

        output = conn.send_command_timing(
            "configure replace flash:restore-config.txt force", read_timeout=60
        )
        lowered = output.lower()
        if "confirm" in lowered or "[y/n]" in lowered or "[yes/no]" in lowered:
            output += conn.send_command_timing("\n", read_timeout=60)

        conn.disconnect()
        ssh_client.close()
        return output

    except Exception:
        if conn:
            try:
                conn.disconnect()
            except Exception:
                pass
        if ssh_client:
            try:
                ssh_client.close()
            except Exception:
                pass
        raise


class CiscoIosRestoreStrategy(BaseRestoreStrategy):
    """Cisco IOS-XE: SCP ile flash:restore-config.txt yüklenir,
    ardından 'configure replace' ile running-config üzerine uygulanır."""

    async def restore(self, device, config_content: str) -> str:
        params = build_conn_params(device)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, partial(_cisco_restore_sync, params, config_content)
        )
