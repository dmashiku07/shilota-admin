# Staging email activation

Driver approval creates a four-digit email activation code. The driver must verify it before their account becomes active. Codes expire after 10 minutes, allow three verification attempts, and may be resent only by the pending authenticated driver, up to three times. No resend occurs automatically.

Configure these variables only in the Railway staging service. Do not place their values in Git:

- `SMTP_HOST` — Mailtrap Email Sandbox host
- `SMTP_PORT` — Mailtrap Email Sandbox SMTP port
- `SMTP_USERNAME` — Mailtrap Email Sandbox username
- `SMTP_PASSWORD` — Mailtrap Email Sandbox password
- `SMTP_FROM` — sender address accepted by the sandbox
- `SMTP_SECURE` — `true` only when the selected SMTP port requires TLS from connection start; otherwise `false`

When these variables are absent, driver approval remains pending and the API reports that SMTP is not configured. It does not expose an activation code or fall back to the legacy database SMTP fields.
