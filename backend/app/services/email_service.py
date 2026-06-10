import asyncio
import difflib
import html as html_module
import logging
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from zoneinfo import ZoneInfo

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_smtp_email(to_email: str, subject: str, body: str, html_body: str | None = None) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain", "utf-8"))
    if html_body:
        msg.attach(MIMEText(html_body, "html", "utf-8"))

    if settings.SMTP_PORT == 465:
        # Implicit SSL (e.g. Gmail port 465)
        with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())
    else:
        # STARTTLS (e.g. Gmail port 587, standard port 587/25)
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())


async def send_test_email(to_email: str) -> None:
    subject = "Test E-postası — Config Management Tool"
    body = (
        "Bu, Config Management Tool tarafından gönderilmiş bir test e-postasıdır.\n\n"
        "SMTP yapılandırmanız başarıyla doğrulandı."
    )
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_smtp_email, to_email, subject, body)


async def send_password_reset_email(to_email: str, reset_link: str, token: str) -> None:
    subject = "Şifre Sıfırlama Talebi"
    body = (
        f"Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:\n\n"
        f"{reset_link}\n\n"
        f"Bu bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir.\n\n"
        f"Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz."
    )

    smtp_configured = bool(settings.SMTP_HOST and settings.SMTP_FROM)

    if not smtp_configured:
        if settings.ENVIRONMENT == "development":
            # Yalnızca development modda token log'a yazılır
            logger.warning(
                "[DEV] SMTP yapılandırılmamış. Reset token: %s | Link: %s",
                token,
                reset_link,
            )
        else:
            logger.error(
                "SMTP yapılandırılmamış. Şifre sıfırlama e-postası gönderilemedi. "
                "SMTP_HOST ve SMTP_FROM ayarlarını kontrol edin."
            )
        return

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp_email, to_email, subject, body)
    except Exception as exc:
        logger.error("E-posta gönderilemedi (%s): %s", to_email, exc)


def _build_scheduler_notification_html(
    scheduler_name: str,
    run_at: str,
    rows: list[dict],
) -> tuple[str, str]:
    status_labels = {"online": "Çevrimiçi", "offline": "Çevrimdışı", "unknown": "Bilinmiyor"}
    status_colors = {
        "online": "background-color:#dcfce7;color:#166534;",
        "offline": "background-color:#fee2e2;color:#991b1b;",
        "unknown": "background-color:#f3f4f6;color:#6b7280;",
    }
    backup_ok_style = "background-color:#dcfce7;color:#166534;"
    backup_fail_style = "background-color:#fee2e2;color:#991b1b;"

    rows_html = ""
    rows_plain = ""
    for row in rows:
        status = row.get("status", "unknown")
        backup_ok = row.get("backup_ok", False)
        s_label = status_labels.get(status, status)
        s_style = status_colors.get(status, status_colors["unknown"])
        b_label = "Alındı" if backup_ok else "Alınamadı"
        b_style = backup_ok_style if backup_ok else backup_fail_style

        rows_html += f"""
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:10px 12px;color:#111827;font-weight:500;">{row['hostname']}</td>
        <td style="padding:10px 12px;color:#374151;font-family:monospace;">{row['ip_address']}</td>
        <td style="padding:10px 12px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:500;{s_style}">{s_label}</span>
        </td>
        <td style="padding:10px 12px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:500;{b_style}">{b_label}</span>
        </td>
      </tr>"""
        rows_plain += f"  {row['hostname']}  |  {row['ip_address']}  |  {s_label}  |  {b_label}\n"

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:700px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;margin-bottom:4px;">Config Management Tool</h2>
  <p style="color:#6b7280;margin-top:0;margin-bottom:24px;font-size:13px;">Zamanlayıcı Çalışma Raporu</p>
  <p style="margin-bottom:6px;"><strong>Zamanlayıcı:</strong> {scheduler_name}</p>
  <p style="margin-bottom:24px;"><strong>Çalışma Zamanı:</strong> {run_at}</p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background-color:#f9fafb;">
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Cihaz Adı</th>
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">IP Adresi</th>
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Durum</th>
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">Backup</th>
      </tr>
    </thead>
    <tbody>{rows_html}
    </tbody>
  </table>
  <p style="margin-top:24px;color:#9ca3af;font-size:12px;">Bu e-posta Config Management Tool tarafından otomatik olarak gönderilmiştir.</p>
</body>
</html>"""

    plain = (
        f"Config Management Tool — Zamanlayıcı Çalışma Raporu\n\n"
        f"Zamanlayıcı: {scheduler_name}\n"
        f"Çalışma Zamanı: {run_at}\n\n"
        f"{'Cihaz Adı':<24} {'IP Adresi':<18} {'Durum':<14} Backup\n"
        f"{'-'*70}\n"
        f"{rows_plain}"
    )
    return plain, html


def _build_config_change_html(
    hostname: str,
    ip: str,
    old_content: str,
    new_content: str,
    run_at: str,
) -> tuple[str, str, int, int]:
    old_lines = old_content.splitlines()
    new_lines = new_content.splitlines()

    sm = difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False)
    opcodes = sm.get_opcodes()

    added_count = sum(j2 - j1 for op, i1, i2, j1, j2 in opcodes if op in ('insert', 'replace'))
    removed_count = sum(i2 - i1 for op, i1, i2, j1, j2 in opcodes if op in ('delete', 'replace'))

    CONTEXT = 3
    MAX_ROWS = 400

    # Build display item list
    items = []
    total_ops = len(opcodes)

    for op_idx, (op, i1, i2, j1, j2) in enumerate(opcodes):
        if op == 'equal':
            size = i2 - i1
            if size <= CONTEXT * 2 + 1:
                for k in range(size):
                    items.append(('row', i1+k+1, old_lines[i1+k], 'equal', j1+k+1, new_lines[j1+k], 'equal'))
            else:
                is_first = op_idx == 0
                is_last = op_idx == total_ops - 1
                show_head = 0 if is_first else CONTEXT
                show_tail = 0 if is_last else CONTEXT
                skipped = size - show_head - show_tail
                for k in range(show_head):
                    items.append(('row', i1+k+1, old_lines[i1+k], 'equal', j1+k+1, new_lines[j1+k], 'equal'))
                if skipped > 0:
                    items.append(('sep', skipped))
                for k in range(size - show_tail, size):
                    items.append(('row', i1+k+1, old_lines[i1+k], 'equal', j1+k+1, new_lines[j1+k], 'equal'))
        elif op == 'replace':
            lc = old_lines[i1:i2]
            rc = new_lines[j1:j2]
            for k in range(max(len(lc), len(rc))):
                ln = i1+k+1 if k < len(lc) else None
                lt = lc[k] if k < len(lc) else None
                rn = j1+k+1 if k < len(rc) else None
                rt = rc[k] if k < len(rc) else None
                items.append(('row', ln, lt, 'removed' if lt is not None else 'empty',
                              rn, rt, 'added' if rt is not None else 'empty'))
        elif op == 'delete':
            for k in range(i2 - i1):
                items.append(('row', i1+k+1, old_lines[i1+k], 'removed', None, None, 'empty'))
        elif op == 'insert':
            for k in range(j2 - j1):
                items.append(('row', None, None, 'empty', j1+k+1, new_lines[j1+k], 'added'))

    # Render rows
    body_rows = ''
    row_count = 0
    truncated = False

    NW = 'width:42px;min-width:42px;max-width:42px'  # number cell width hint

    for item in items:
        if row_count >= MAX_ROWS:
            truncated = True
            break
        if item[0] == 'sep':
            body_rows += (
                f'<tr>'
                f'<td colspan="4" style="padding:5px 16px;background-color:#f8fafc;color:#94a3b8;'
                f'font-family:monospace;font-size:11px;text-align:center;letter-spacing:.05em;'
                f'border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">'
                f'&#xB7;&#xB7;&#xB7;&nbsp;&nbsp;{item[1]} satır atlandı&nbsp;&nbsp;&#xB7;&#xB7;&#xB7;'
                f'</td></tr>'
            )
            row_count += 1
            continue

        _, lnum, ltext, ltype, rnum, rtext, rtype = item

        if ltype == 'removed':
            ln_bg = 'background-color:#fca5a5;'; lc_bg = 'background-color:#fef2f2;'; lc_fg = 'color:#b91c1c;'
        elif ltype == 'empty':
            ln_bg = 'background-color:#f1f5f9;'; lc_bg = 'background-color:#f1f5f9;'; lc_fg = ''
        else:
            ln_bg = 'background-color:#f8fafc;'; lc_bg = 'background-color:#ffffff;'; lc_fg = 'color:#1e293b;'

        if rtype == 'added':
            rn_bg = 'background-color:#86efac;'; rc_bg = 'background-color:#f0fdf4;'; rc_fg = 'color:#15803d;'
        elif rtype == 'empty':
            rn_bg = 'background-color:#f1f5f9;'; rc_bg = 'background-color:#f1f5f9;'; rc_fg = ''
        else:
            rn_bg = 'background-color:#f8fafc;'; rc_bg = 'background-color:#ffffff;'; rc_fg = 'color:#1e293b;'

        lnum_s = str(lnum) if lnum is not None else ''
        rnum_s = str(rnum) if rnum is not None else ''
        lesc = html_module.escape(ltext) if ltext is not None else ''
        resc = html_module.escape(rtext) if rtext is not None else ''

        num_td = (f'{NW};padding:2px 6px;font-family:"Courier New",monospace;font-size:11px;'
                  f'text-align:right;vertical-align:top;user-select:none;')
        txt_td = (f'padding:2px 10px;font-family:"Courier New",monospace;font-size:12px;'
                  f'white-space:pre-wrap;word-break:break-all;vertical-align:top;line-height:1.5;')

        body_rows += (
            f'<tr style="border-bottom:1px solid #f1f5f9;">'
            f'<td style="{num_td}{ln_bg}border-right:1px solid #e2e8f0;">{lnum_s}</td>'
            f'<td style="{txt_td}{lc_bg}{lc_fg}border-right:3px solid #cbd5e1;">{lesc}</td>'
            f'<td style="{num_td}{rn_bg}border-right:1px solid #e2e8f0;">{rnum_s}</td>'
            f'<td style="{txt_td}{rc_bg}{rc_fg}">{resc}</td>'
            f'</tr>'
        )
        row_count += 1

    truncated_note = (
        f'<p style="margin:8px 0 0;color:#f59e0b;font-size:12px;">'
        f'Diff çok uzun, ilk {MAX_ROWS} satır gösterildi.</p>'
    ) if truncated else ''

    h_hostname = html_module.escape(hostname)
    h_ip = html_module.escape(ip)

    # Header row with colgroup to lock column widths
    header_row = (
        f'<colgroup>'
        f'<col style="width:42px"><col><col style="width:42px"><col>'
        f'</colgroup>'
        f'<tr>'
        f'<th colspan="2" style="padding:8px 12px;background-color:#fff1f2;color:#be123c;'
        f'font-family:Arial,sans-serif;font-size:11px;font-weight:700;text-align:left;'
        f'border-right:3px solid #cbd5e1;border-bottom:2px solid #e2e8f0;letter-spacing:.04em;">ESKİ</th>'
        f'<th colspan="2" style="padding:8px 12px;background-color:#f0fdf4;color:#15803d;'
        f'font-family:Arial,sans-serif;font-size:11px;font-weight:700;text-align:left;'
        f'border-bottom:2px solid #e2e8f0;letter-spacing:.04em;">YENİ</th>'
        f'</tr>'
    )

    body_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#1e293b;max-width:960px;margin:0 auto;padding:28px 24px;">

  <!-- Header -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="border-left:4px solid #1d4ed8;padding:4px 0 4px 14px;">
        <div style="font-size:17px;font-weight:700;color:#1d4ed8;margin-bottom:2px;">Config Management Tool</div>
        <div style="font-size:12px;color:#64748b;">Konfigürasyon Değişiklik Bildirimi</div>
      </td>
    </tr>
  </table>

  <!-- Meta -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px;">
    <tr><td style="padding:2px 0;color:#64748b;width:90px;">Cihaz</td><td style="padding:2px 0;font-weight:600;color:#0f172a;">{h_hostname}</td></tr>
    <tr><td style="padding:2px 0;color:#64748b;">IP Adresi</td><td style="padding:2px 0;font-weight:600;color:#0f172a;">{h_ip}</td></tr>
    <tr><td style="padding:2px 0;color:#64748b;">Tarih</td><td style="padding:2px 0;font-weight:600;color:#0f172a;">{run_at}</td></tr>
  </table>

  <!-- Change summary -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr>
      <td style="background-color:#fefce8;border:1px solid #fde047;border-radius:6px;padding:10px 16px;">
        <span style="color:#92400e;font-size:13px;font-weight:600;">
          <span style="color:#16a34a;">+{added_count} satır eklendi</span>
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <span style="color:#dc2626;">-{removed_count} satır silindi</span>
        </span>
      </td>
    </tr>
  </table>

  <!-- Diff table -->
  <table style="width:100%;table-layout:fixed;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    {header_row}
    {body_rows}
  </table>
  {truncated_note}

  <p style="margin-top:28px;color:#94a3b8;font-size:11px;border-top:1px solid #f1f5f9;padding-top:16px;">
    Bu e-posta Config Management Tool tarafından otomatik olarak gönderilmiştir.
  </p>
</body></html>"""

    plain = (
        f"Config Management Tool — Konfigürasyon Değişiklik Bildirimi\n\n"
        f"Cihaz: {hostname}\nIP Adresi: {ip}\nTarih: {run_at}\n\n"
        f"+{added_count} satır eklendi, -{removed_count} satır silindi\n"
    )

    return plain, body_html, added_count, removed_count


async def send_config_change_notification(
    hostname: str,
    ip: str,
    old_content: str,
    new_content: str,
) -> None:
    if not settings.CHANGE_NOTIFY_ENABLED:
        return
    if not settings.CHANGE_NOTIFY_EMAILS:
        return
    if not settings.SMTP_HOST or not settings.SMTP_FROM:
        logger.warning("[ChangeNotify] SMTP yapılandırılmamış, bildirim gönderilemedi.")
        return

    emails = [e.strip() for e in settings.CHANGE_NOTIFY_EMAILS.split(',') if e.strip()]
    if not emails:
        return

    run_at = datetime.now(ZoneInfo("Europe/Istanbul")).strftime("%d.%m.%Y %H:%M")
    plain, body_html, added, removed = _build_config_change_html(
        hostname, ip, old_content, new_content, run_at
    )
    subject = f"Konfigürasyon Değişikliği — {hostname} (+{added} / -{removed})"

    loop = asyncio.get_event_loop()
    for email in emails:
        try:
            await loop.run_in_executor(None, _send_smtp_email, email, subject, plain, body_html)
        except Exception as exc:
            logger.error("[ChangeNotify] Bildirim gönderilemedi (%s): %s", email, exc)


async def send_configlet_notification(
    to_email: str,
    configlet_name: str,
    run_at: str,
    results: list[dict],
) -> None:
    smtp_configured = bool(settings.SMTP_HOST and settings.SMTP_FROM)
    if not smtp_configured:
        logger.warning("[Configlet] SMTP yapılandırılmamış, bildirim maili gönderilemedi.")
        return

    ok_count = sum(1 for r in results if r.get("status") == "success")
    fail_count = sum(1 for r in results if r.get("status") != "success")

    rows_html = ""
    rows_plain = ""
    for r in results:
        status = r.get("status", "failed")
        hostname = r.get("hostname", "")
        ip = r.get("ip_address", "")
        output = (r.get("output") or "").strip()
        output_snippet = output[:200] + ("..." if len(output) > 200 else "") if output else ""
        error = r.get("error") or ""

        if status == "success":
            s_style = "background-color:#dcfce7;color:#166534;"
            s_label = "Başarılı"
        else:
            s_style = "background-color:#fee2e2;color:#991b1b;"
            s_label = "Başarısız"

        detail = html_module.escape(output_snippet or error)
        rows_html += f"""
      <tr style="border-bottom:1px solid #f3f4f6;vertical-align:top;">
        <td style="padding:10px 12px;color:#111827;font-weight:500;">{html_module.escape(hostname)}</td>
        <td style="padding:10px 12px;color:#374151;font-family:monospace;">{html_module.escape(ip)}</td>
        <td style="padding:10px 12px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:500;{s_style}">{s_label}</span>
        </td>
        <td style="padding:10px 12px;font-family:monospace;font-size:11px;color:#374151;word-break:break-all;">{detail}</td>
      </tr>"""
        rows_plain += f"  {hostname:<24} {ip:<18} {s_label:<12} {(output_snippet or error)[:80]}\n"

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;font-size:14px;color:#333;max-width:860px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;margin-bottom:4px;">Config Management Tool</h2>
  <p style="color:#6b7280;margin-top:0;margin-bottom:24px;font-size:13px;">Komut Şablonu Çalışma Raporu</p>
  <p style="margin-bottom:6px;"><strong>Şablon:</strong> {html_module.escape(configlet_name)}</p>
  <p style="margin-bottom:16px;"><strong>Çalışma Zamanı:</strong> {run_at}</p>
  <p style="margin-bottom:16px;">
    <span style="background-color:#dcfce7;color:#166534;padding:3px 10px;border-radius:9999px;font-size:13px;font-weight:600;margin-right:8px;">✓ {ok_count} başarılı</span>
    <span style="background-color:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:9999px;font-size:13px;font-weight:600;">✗ {fail_count} başarısız</span>
  </p>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background-color:#f9fafb;">
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Cihaz Adı</th>
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">IP Adresi</th>
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Durum</th>
        <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#6b7280;font-size:11px;text-transform:uppercase;">Çıktı</th>
      </tr>
    </thead>
    <tbody>{rows_html}
    </tbody>
  </table>
  <p style="margin-top:24px;color:#9ca3af;font-size:12px;">Bu e-posta Config Management Tool tarafından otomatik olarak gönderilmiştir.</p>
</body>
</html>"""

    plain = (
        f"Config Management Tool — Komut Şablonu Çalışma Raporu\n\n"
        f"Şablon: {configlet_name}\n"
        f"Çalışma Zamanı: {run_at}\n"
        f"Sonuç: {ok_count} başarılı / {fail_count} başarısız\n\n"
        f"{'Cihaz Adı':<24} {'IP Adresi':<18} {'Durum':<12} Çıktı\n"
        f"{'-'*80}\n"
        f"{rows_plain}"
    )

    subject = f"Komut Şablonu Raporu — {configlet_name} ({ok_count}✓ / {fail_count}✗)"
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp_email, to_email, subject, plain, html_body)
    except Exception as exc:
        logger.error("[Configlet] Bildirim maili gönderilemedi (%s): %s", to_email, exc)


async def send_scheduler_notification(
    to_email: str,
    scheduler_name: str,
    run_at: str,
    rows: list[dict],
) -> None:
    smtp_configured = bool(settings.SMTP_HOST and settings.SMTP_FROM)
    if not smtp_configured:
        logger.warning("[Scheduler] SMTP yapılandırılmamış, bildirim maili gönderilemedi.")
        return

    subject = f"Zamanlayıcı Raporu — {scheduler_name}"
    plain, html = _build_scheduler_notification_html(scheduler_name, run_at, rows)
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_smtp_email, to_email, subject, plain, html)
    except Exception as exc:
        logger.error("[Scheduler] Bildirim maili gönderilemedi (%s): %s", to_email, exc)
