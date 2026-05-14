import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_smtp_email(to_email: str, subject: str, body: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(body, "plain", "utf-8"))

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
