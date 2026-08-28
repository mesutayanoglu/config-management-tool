class BaseRestoreStrategy:
    """Vendor'a özgü config restore adaptörlerinin ortak arayüzü."""

    async def restore(self, device, config_content: str) -> str:
        """Cihaza config_content'i SCP/API ile yükler, vendor'a özgü komutla etkinleştirir.
        Netmiko SADECE komut tetiklemek için kullanılır, transfer SCP/API iledir.
        Başarısızlıkta exception fırlatır. Dönüş: cihazdan alınan log çıktısı (audit için)."""
        raise NotImplementedError
