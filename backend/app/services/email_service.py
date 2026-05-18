import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

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
