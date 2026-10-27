# Confirmed sender-domain failure

Read-only checks against Resend using the locally configured credential succeeded. Resend reports the configured sender domain `propbank.shop` as **failed**, with all three required sending DNS records failed. Public DNS lookups also returned `ENOTFOUND` for these record names. The domain itself resolves, so this is not an absent domain.

Both new-property notifications and owner/tenant invitations use this sender. This confirms a shared sender-configuration blocker; no email-send request was made to reproduce a specific provider rejection or inspect a recipient's inbox.

## DNS records returned by this Resend account

Add the following records in the authoritative DNS zone for `propbank.shop`. Do not replace unrelated existing website or inbound-email records.

| Type | Host/name | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvqwl1TUcx1zc1cXHMlxPVfoAKqaSPKRtwphn4o6Y2zJ2v2G1qeO051aiIejq7ScfVGip2wPSz4Aj0Rgi3HM2z7s3muXmb34b1hX72huxpaQLgSHc/3yKlTb5p+auBKiwoIe7k/aCGFmnx+TVFbIsmf5+dSB4zHoqxR9aO+S8QfwIDAQAB` | — |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

The DKIM value is a public DNS verification key, not an API credential. Check the current Resend domain screen before applying records in case the domain configuration has changed.

The authoritative nameservers returned by public DNS are `ns67.domaincontrol.com` and `ns68.domaincontrol.com`. Apply changes at the DNS service serving those nameservers, not an unrelated Cloudflare zone.

After DNS propagation, re-run domain verification in Resend until its sending status is verified. Then perform one separately authorized controlled email test. Existing eligible failed/pending outbox deliveries can be reviewed through the administrator delivery UI; do not blindly recreate properties or replay historical events. Expired, rejected, linked, suppressed or otherwise obsolete invitations remain subject to their existing safeguards.

No source code, credentials, DNS configuration, Firebase records or Resend configuration was changed for this diagnosis. No real email was sent.

Reference: [Resend domain-verification guidance](https://resend.com/changelog/domain-verification-events).
