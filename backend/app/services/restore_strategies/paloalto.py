import asyncio
from functools import partial

from app.services.restore_strategies.base import BaseRestoreStrategy
from app.services.paloalto_api import (
    _get_api_key_sync,
    commit_sync,
    import_config_sync,
    load_config_sync,
)


class PaloAltoRestoreStrategy(BaseRestoreStrategy):
    """Palo Alto: SSH/Netmiko KULLANILMAZ, tamamen PAN-OS XML API üzerinden çalışır
    (API key al → import → load → commit)."""

    async def restore(self, device, config_content: str) -> str:
        if device.credential_profile:
            p = device.credential_profile
            username = p.username
            password = p.password
        else:
            username = device.ssh_username
            password = device.ssh_password

        host = device.ip_address
        port = 443
        timeout = 30
        filename = "restore-config.xml"

        loop = asyncio.get_event_loop()

        api_key = await loop.run_in_executor(
            None, partial(_get_api_key_sync, host, username, password, port, timeout)
        )
        await loop.run_in_executor(
            None,
            partial(import_config_sync, host, api_key, filename, config_content, port, timeout),
        )
        await loop.run_in_executor(
            None, partial(load_config_sync, host, api_key, filename, port, timeout)
        )
        commit_result = await loop.run_in_executor(
            None, partial(commit_sync, host, api_key, port, timeout)
        )
        return f"Palo Alto restore tamamlandı. Commit sonucu: {commit_result}"
