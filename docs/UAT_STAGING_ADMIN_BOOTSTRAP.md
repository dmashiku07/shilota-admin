# Staging Super Admin bootstrap

This is a console-only, staging-only setup action. It is not an HTTP endpoint and does not alter any mobile API.

Before running it in the approved Railway staging service, add these temporary Railway service variables:

```text
APP_ENV=staging
STAGING_ADMIN_BOOTSTRAP_ENABLED=true
STAGING_ADMIN_BOOTSTRAP_CONFIRM=CREATE_STAGING_SUPER_ADMIN
STAGING_ADMIN_BOOTSTRAP_EMAIL=<generated UAT admin email>
STAGING_ADMIN_BOOTSTRAP_PASSWORD=<generated 16+ character UAT password>
STAGING_ADMIN_BOOTSTRAP_NAME=Staging Super Admin
```

Generate the email and password outside the repository. Store the password only in the approved password manager or other controlled UAT channel; do not paste it into source control, logs, or tickets.

Open a Railway shell for the approved staging service and run:

```text
npm run bootstrap:staging-super-admin
```

The command prints only `created` or `already_exists`; it never prints the email or password. It refuses to run unless `APP_ENV=staging`, the explicit enable flag, and the exact confirmation value are present. It also refuses to change an existing non-Super-Admin account.

Immediately after a successful run, remove these temporary Railway variables:

```text
STAGING_ADMIN_BOOTSTRAP_ENABLED
STAGING_ADMIN_BOOTSTRAP_CONFIRM
STAGING_ADMIN_BOOTSTRAP_EMAIL
STAGING_ADMIN_BOOTSTRAP_PASSWORD
STAGING_ADMIN_BOOTSTRAP_NAME
```

Keep `APP_ENV=staging` only while this Railway service remains the approved staging target.
