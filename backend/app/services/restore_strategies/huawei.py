import asyncio
import io
from functools import partial

from netmiko import ConnectHandler
from scp import SCPClient

from app.services.restore_strategies.base import BaseRestoreStrategy
from app.services.ssh_collector import build_conn_params, open_ssh_client_sync

# Huawei restore işlemi startup-config'i değiştirir ancak cihazı OTOMATİK
# YENİDEN BAŞLATMAZ (yıkıcı/tehlikeli bir aksiyon olduğu için kapsam dışı).
HUAWEI_REBOOT_WARNING = (
    "Değişikliklerin etkili olması için cihazın manuel olarak yeniden başlatılması gerekir."
)


def _huawei_restore_sync(params: dict, config_content: str) -> str:
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
            scp.putfo(buf, "flash:/restore-config.cfg")
        finally:
            scp.close()
        ssh_client.close()
        ssh_client = None

        conn_params = {
            "device_type": "huawei",
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

        output = conn.send_command_timing(
            "startup saved-configuration restore-config.cfg", read_timeout=60
        )
        lowered = output.lower()
        if "y/n" in lowered or "yes/no" in lowered or "[y]" in lowered:
            output += conn.send_command_timing("y", read_timeout=60)

        conn.disconnect()

        # NOT: startup saved-configuration sadece bir sonraki açılışta kullanılacak
        # konfigürasyonu belirler; running-config'i etkilemesi için reboot gerekir.
        # Bu reboot BİLİNÇLİ OLARAK burada tetiklenmiyor.
        output += f"\n\n[UYARI] {HUAWEI_REBOOT_WARNING}"
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


class HuaweiRestoreStrategy(BaseRestoreStrategy):
    """Huawei: SCP ile flash:/restore-config.cfg yüklenir, 'startup saved-configuration'
    ile bir sonraki açılış konfigürasyonu olarak ayarlanır. Cihaz OTOMATİK REBOOT EDİLMEZ."""

    async def restore(self, device, config_content: str) -> str:
        params = build_conn_params(device)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, partial(_huawei_restore_sync, params, config_content)
        )
