"""Email delivery for password recovery. No passwords or codes enter logs."""
import asyncio
import os
import smtplib
import ssl
from email.message import EmailMessage


def configured():
    return bool(os.getenv('SMTP_HOST') and os.getenv('SMTP_FROM'))


def _send_code(email, code):
    message = EmailMessage()
    message['From'] = os.environ['SMTP_FROM']
    message['To'] = email
    message['Subject'] = 'Reset your AuraInfra.ai password'
    message.set_content(
        f'Your AuraInfra.ai password reset code is: {code}\n\n'
        'Enter this code with your email address in the app. It expires in 10 minutes '
        'and can be used once. Never share it with anyone, including support.\n\n'
        'If you did not request this reset, ignore this email. Your password has not changed.\n'
        'Jash Vish Infratech Private Limited\n'
    )
    host = os.environ['SMTP_HOST']
    use_ssl = os.getenv('SMTP_SSL', 'false').lower() == 'true'
    port = int(os.getenv('SMTP_PORT', '465' if use_ssl else '587'))
    context = ssl.create_default_context()
    if use_ssl:
        connection = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
    else:
        connection = smtplib.SMTP(host, port, timeout=15)
    with connection as smtp:
        if not use_ssl:
            smtp.starttls(context=context)
        if os.getenv('SMTP_USERNAME'):
            smtp.login(os.environ['SMTP_USERNAME'], os.environ['SMTP_PASSWORD'])
        smtp.send_message(message)


async def send_reset_code(email, code):
    await asyncio.to_thread(_send_code, email, code)
