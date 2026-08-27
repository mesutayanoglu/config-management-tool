import asyncio
import io
from functools import partial

from netmiko import ConnectHandler
from scp import SCPClient

from app.services.restore_strategies.base import BaseRestoreStrategy
from app.services.ssh_collector import build_conn_params, open_ssh_client_sync


def _aruba_cx_restore_sync(params: dict, config_content: str) -> str:
    conn = None
    ssh_client = None
    outputs = []
    try:
        conn_params = {
            "device_type": "aruba_oscx",
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

        # GitHub yedeğine ek olarak cihaz üstünde de bir checkpoint bırak
        outputs.append(conn.send_command("checkpoint create pre_restore", read_timeout=60))

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
        ssh_client.close()
        ssh_client = None

        copy_out = conn.send_command_timing(
            "copy flash:restore-config.txt running-config", read_timeout=60
        )
        lowered = copy_out.lower()
        if "confirm" in lowered or "[y/n]" in lowered or "[yes/no]" in lowered:
            copy_out += conn.send_command_timing("y", read_timeout=60)
        outputs.append(copy_out)

        conn.disconnect()
        return "\n".join(outputs)

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


class ArubaCxRestoreStrategy(BaseRestoreStrategy):
    """Aruba CX: önce cihaz üstünde 'checkpoint create pre_restore' alınır,
    ardından SCP ile flash:restore-config.txt yüklenip running-config'e kopyalanır."""

    async def restore(self, device, config_content: str) -> str:
        params = build_conn_params(device)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, partial(_aruba_cx_restore_sync, params, config_content)
        )
