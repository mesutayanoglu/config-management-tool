import asyncio
import io
from functools import partial

from netmiko import ConnectHandler
from scp import SCPClient

from app.services.restore_strategies.base import BaseRestoreStrategy
from app.services.ssh_collector import build_conn_params, open_ssh_client_sync


def _fortigate_restore_sync(params: dict, config_content: str) -> str:
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
            scp.putfo(buf, "restore-config.conf")
        finally:
            scp.close()
        ssh_client.close()
        ssh_client = None

        conn_params = {
            "device_type": "fortinet",
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

        # FortiGate 'execute restore config' komutundan sonra genelde kendi
        # kararıyla reboot eder — bu native davranış, biz ekstra reboot tetiklemiyoruz.
        output = conn.send_command_timing(
            "execute restore config flash restore-config.conf", read_timeout=60
        )
        lowered = output.lower()
        if "y/n" in lowered or "yes/no" in lowered or "continue" in lowered:
            output += conn.send_command_timing("y", read_timeout=60)

        try:
            conn.disconnect()
        except Exception:
            # Cihaz restore sonrası kendi reboot'unu tetiklemiş olabilir,
            # bağlantı bu noktada zaten düşmüş olabilir — hata sayılmaz.
            pass
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


class FortiGateRestoreStrategy(BaseRestoreStrategy):
    """FortiGate: SCP ile flash'a restore-config.conf yüklenir,
    'execute restore config flash' ile devreye alınır."""

    async def restore(self, device, config_content: str) -> str:
        params = build_conn_params(device)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, partial(_fortigate_restore_sync, params, config_content)
        )
