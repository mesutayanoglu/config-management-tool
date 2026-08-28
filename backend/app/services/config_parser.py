import re


def _is_cisco_version_header(line: str) -> bool:
    """'Switch Ports Model ... SW Version' başlık satırını backtracking riski
    olmadan tespit eder (lineer, ardışık substring araması).

    Not: eski `header_re = re.compile(r"switch.*ports.*model.*sw\\s*version", ...)`
    yerine kullanılır. Zincirlenmiş `.*` grupları güvenilmeyen (cihazdan gelen,
    MITM/kompromize cihaz tarafından manipüle edilebilecek) girdilerde
    katastrofik backtracking'e (ReDoS, CWE-1333) yol açabiliyordu.
    """
    lowered = line.lower()
    idx = 0
    for keyword in ("switch", "ports", "model", "sw", "version"):
        pos = lowered.find(keyword, idx)
        if pos == -1:
            return False
        idx = pos + len(keyword)
    return True


def _parse_cisco_version_table(output: str) -> tuple:
    """`show version` çıktısındaki stack/switch tablosunu parse eder.

    Örnek format:
             Switch Ports Model                     SW Version            SW Image
             ------ ----- -----                     ----------            --------
        *    1 12    WS-C3560CX-8XPD-S         15.2(4)E2             C3560CX-UNIVERSALK9-M

    Birden fazla switch (stack) varsa `*` ile işaretli aktif/master switch
    tercih edilir; `*` yoksa ilk veri satırı kullanılır.
    Dönüş: (model, sw_version) — bulunamazsa (None, None).
    """
    if not output:
        return None, None

    lines = output.splitlines()
    header_idx = None
    for i, line in enumerate(lines):
        if _is_cisco_version_header(line):
            header_idx = i
            break

    if header_idx is None:
        return None, None

    row_re = re.compile(r'^\*?\s*\d+\s+\d+\s+(\S+)\s+(\S+)\s+(\S+)')
    starred_match = None
    first_match = None

    for line in lines[header_idx + 1:]:
        stripped = line.strip()
        if not stripped:
            # Veri bloğu bittiyse dur, aksi halde boş satırı atla
            if first_match is not None:
                break
            continue
        # Ayraç satırı ("------ ----- -----") ise atla
        if re.match(r'^[-\s]+$', stripped):
            continue
        m = row_re.match(line)
        if not m:
            # Veri satırları bittiyse döngüden çık
            if first_match is not None:
                break
            continue
        model, sw_version = m.group(1), m.group(2)
        if first_match is None:
            first_match = (model, sw_version)
        if stripped.startswith("*") and starred_match is None:
            starred_match = (model, sw_version)

    result = starred_match or first_match
    if result:
        return result
    return None, None


def parse_model_version(vendor: str, config_text: str, version_output: str | None = None) -> dict:
    """Config metninden model ve versiyon bilgisini çıkarır."""
    model = None
    version = None
    vendor = vendor.lower()

    if vendor == "cisco":
        # 1) `show version` çıktısındaki stack/switch tablosu (en güvenilir kaynak)
        if version_output:
            table_model, table_version = _parse_cisco_version_table(version_output)
            if table_model:
                model = table_model
            if table_version:
                version = table_version

            # 2) Tablo yoksa/eksikse "Cisco IOS Software, ..., Version X, RELEASE SOFTWARE" satırı
            if not version:
                m = re.search(
                    r'Cisco\s+IOS\s+Software.*?Version\s+([^\s,]+)',
                    version_output, re.IGNORECASE
                )
                if m:
                    version = m.group(1)

            # 3) Model hâlâ boşsa "Model number: WS-C3750X-48P-S" satırı
            if not model:
                m = re.search(
                    r'[Mm]odel\s+(?:number|Number)\s*:\s*(\S+)', version_output
                )
                if m:
                    model = m.group(1)

        # 4) Son çare: running-config tabanlı eski mantık, sadece eksik alanları doldur
        for line in config_text.splitlines()[:30]:
            line = line.strip()
            if not version:
                # "version 15.2" veya "version 17.3.1a"
                m = re.match(r'^version\s+(\S+)', line)
                if m:
                    version = m.group(1)
            if not model:
                # "! Cisco IOS Software, C2900 Software"
                m = re.search(r'[Cc]isco\s+([\w-]+)\s+[Ss]oftware', line)
                if m:
                    model = m.group(1)
            if not model:
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

    elif vendor == "paloalto":
        # "show config running" set-format çıktısında model/versiyon bilgisi yok;
        # cihaz bilgisi ancak "show system info" ile alınabilir (ayrı komut, henüz toplanmıyor).
        pass

    return {"model": model, "version": version}
