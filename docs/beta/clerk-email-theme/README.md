# Savortome Clerk email theme

`new-device-sign-in.html` is the reviewed production body for Clerk's `new_device_sign_in` email. It keeps Clerk's security variables and session-revocation link while applying Savortome's timber, parchment, and brass visual system with email-safe tables and inline styles.

The template intentionally contains no tracking pixels, remote decorative art, health or food data, or account information beyond the security fields Clerk already supplies.

Target:

- Clerk application: Savortome
- Instance: production
- Template: `email/new_device_sign_in`
- Subject: `New device signed in to your {{app.name}} account`

Applied to the production Clerk instance on 21 September 2026 after an explicit CLI dry run and a provider-rendered preview. Clerk reports the template enabled, custom, delivered by Clerk, and not flagged as suspicious. The provider-returned body SHA-256 matches this file: `629afdbfbb15a9a333af39f51c27e4bdef07bf118c91bcc5a41a19f6008e49cf`.

The provider preview expanded all required security values and kept the session-revocation links. No test email was sent. Email-client visual acceptance is still separate from Clerk's successful preview rendering.
