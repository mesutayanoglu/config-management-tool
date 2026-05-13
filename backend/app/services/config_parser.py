import re


def parse_model_version(vendor: str, config_text: str) -> dict:
    """Config metninden model ve versiyon bilgisini çıkarır."""
    model = None
    version = None
    vendor = vendor.lower()

    if vendor == "cisco":
        for line in config_text.splitlines()[:30]:
            line = line.strip()
            # "version 15.2" veya "version 17.3.1a"
            m = re.match(r'^version\s+(\S+)', line)
            if m:
                version = m.group(1)
            # "! Cisco IOS Software, C2900 Software"
            m = re.search(r'[Cc]isco\s+([\w-]+)\s+[Ss]oftware', line)
            if m:
                model = m.group(1)
            # "Model number: WS-C3750X-48P-S"
            m = re.search(r'[Mm]odel\s+(?:number|Number)\s*:\s*(\S+)', line)
            if m:
                model = m.group(1)

    elif vendor == "fortigate":
        # Satır örneği: #config-version=FGT60E-v6-build1803-220303:opmode=...
        m = re.search(r'#config-version=([A-Z0-9]+)-v([\d]+(?:b\w+)?)-build(\d+)', config_text)
        if m:
            model = m.group(1)
            version = f"v{m.group(2)}-build{m.group(3)}"

    elif vendor == "huawei":
        for line in config_text.splitlines()[:30]:
            line = line.strip()
            # "version V800R021C10SPC200"
            m = re.match(r'^version\s+(\S+)', line, re.IGNORECASE)
            if m:
                version = m.group(1)
            # "sysname Huawei-CE6870"  (hostname değil, model değil ama yakın)
            m = re.match(r'^[Hh]uawei\s+([\w-]+)', line)
            if m:
                model = m.group(1)

    elif vendor == "aruba":
        for line in config_text.splitlines()[:30]:
            line = line.strip()
            m = re.match(r'^version\s+(\S+)', line, re.IGNORECASE)
            if m:
                version = m.group(1)
            m = re.search(r'ArubaOS-CX\s+([\w-]+)', line, re.IGNORECASE)
            if m:
                model = m.group(1)

    return {"model": model, "version": version}
