import asyncio


async def ping_device(ip_address: str, port: int = 22, timeout: float = 3.0) -> bool:
    """TCP bağlantısı ile cihazın erişilebilirliğini kontrol eder (SSH port 22)."""
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(ip_address, port),
            timeout=timeout,
        )
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False
