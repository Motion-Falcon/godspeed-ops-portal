/**
 * Shared email layout and style system.
 *
 * Every email template wraps its body content with `wrapInLayout()` to get a
 * consistent branded envelope: portal name header, title, body, and footer.
 *
 * All styles are inlined for maximum email-client compatibility
 * (Gmail, Outlook, Apple Mail, Yahoo, etc.).
 */

import Handlebars from "handlebars";

// ── Handlebars helpers (registered once, globally) ──────────────────────

let helpersRegistered = false;

export function ensureHelpers(): void {
  if (helpersRegistered) return;
  helpersRegistered = true;

  Handlebars.registerHelper("currency", (value: unknown) => {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (!Number.isFinite(n)) return "$0.00";
    return "$" + n.toFixed(2);
  });

  Handlebars.registerHelper("eq", function (this: unknown, a: unknown, b: unknown) {
    return a === b;
  });

  Handlebars.registerHelper("gt", function (this: unknown, a: unknown, b: unknown) {
    return Number(a) > Number(b);
  });
}

// ── Accent colour palette ───────────────────────────────────────────────

export const ACCENT_GREEN = "#16a34a"; // success / verified
export const ACCENT_RED   = "#dc2626"; // negative / removal
export const ACCENT_BLUE  = "#2563eb"; // neutral / informational

// ── Accent-aware button helpers ─────────────────────────────────────────

export function accentBtn(color: string): string {
  return `display:inline-block;background:${color};color:#ffffff !important;text-decoration:none !important;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.2px;`;
}

export function accentBtnOutline(color: string): string {
  return `display:inline-block;background:#ffffff;color:${color} !important;text-decoration:none !important;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;border:1px solid ${color};`;
}

// ── Reusable inline style constants ─────────────────────────────────────

export const S = {
  p: "margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;",
  pLast: "margin:0;font-size:15px;color:#333333;line-height:1.6;",
  muted: "font-size:13px;color:#6e6e6e;line-height:1.5;",
  strong: "font-weight:600;color:#1a1a1a;",

  /** Primary CTA button — default black (use accentBtn() for coloured) */
  btn: "display:inline-block;background:#000000;color:#ffffff !important;text-decoration:none !important;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;letter-spacing:0.2px;",
  /** Secondary button — outline */
  btnOutline: "display:inline-block;background:#ffffff;color:#000000 !important;text-decoration:none !important;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:600;border:1px solid #d4d4d4;",
  btnWrap: "text-align:center;margin:28px 0;",

  /** Info / highlight box */
  infoBox: "background:#fafafa;border:1px solid #e5e5e5;border-radius:6px;padding:16px 20px;margin:20px 0;",
  /** Aside / notice strip */
  notice: "background:#fafafa;border-left:3px solid #d4d4d4;padding:14px 18px;margin:20px 0;border-radius:0 6px 6px 0;font-size:14px;color:#333333;line-height:1.5;",

  /** Data table */
  table: "width:100%;border-collapse:collapse;margin:16px 0;",
  tdLabel: "padding:10px 12px 10px 0;font-size:14px;color:#6e6e6e;font-weight:500;vertical-align:top;border-bottom:1px solid #f0f0f0;width:160px;",
  tdValue: "padding:10px 0;font-size:14px;color:#1a1a1a;font-weight:500;vertical-align:top;border-bottom:1px solid #f0f0f0;",

  /** Columnar table */
  th: "padding:10px 12px;font-size:12px;color:#6e6e6e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e5e5;text-align:left;",
  thRight: "padding:10px 12px;font-size:12px;color:#6e6e6e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #e5e5e5;text-align:right;",
  td: "padding:10px 12px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;",
  tdRight: "padding:10px 12px;font-size:14px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;text-align:right;",

  /** Summary totals */
  totalLabel: "padding:12px 12px 12px 0;font-size:15px;color:#1a1a1a;font-weight:600;border-top:2px solid #1a1a1a;",
  totalValue: "padding:12px 0;font-size:15px;color:#1a1a1a;font-weight:600;border-top:2px solid #1a1a1a;text-align:right;",

  /** Misc */
  hr: "border:none;border-top:1px solid #f0f0f0;margin:24px 0;",
  h3: "margin:24px 0 12px;font-size:15px;font-weight:600;color:#1a1a1a;letter-spacing:-0.2px;",
  badge: "display:inline-block;background:#f0f0f0;color:#1a1a1a;font-size:12px;font-weight:600;padding:4px 10px;border-radius:4px;letter-spacing:0.3px;",
  badgeUpdate: "display:inline-block;background:#fef3c7;color:#92400e;font-size:12px;font-weight:600;padding:4px 10px;border-radius:4px;letter-spacing:0.3px;",
};

// ── Layout wrapper ──────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function wrapInLayout(
  title: string,
  bodyHtml: string,
  portalName: string,
  accentColor: string = ACCENT_BLUE
): string {
  const safeTitle = esc(title);
  const safeName = esc(portalName);
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;line-height:1.6;-webkit-font-smoothing:antialiased;">

<div style="max-width:700px;margin:0 auto;padding:40px 20px;">
<div style="background:#ffffff;border-radius:8px;border:1px solid #e5e5e5;overflow:hidden;border-top:4px solid ${accentColor};">

<!-- Header -->
<div style="padding:28px 32px 0;">
  <p style="margin:0 0 20px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#999999;">${safeName}</p>
  <h1 style="margin:0;font-size:22px;font-weight:600;color:#000000;letter-spacing:-0.3px;">${safeTitle}</h1>
</div>
<div style="padding:0 32px;"><hr style="border:none;border-top:2px solid ${accentColor};margin:20px 0 0;"></div>

<!-- Body -->
<div style="padding:24px 32px 32px;">
${bodyHtml}
</div>

<!-- Footer -->
<div style="padding:20px 32px;border-top:1px solid #f0f0f0;">
  <p style="margin:0;font-size:12px;color:#999999;line-height:1.5;">This is an automated message from ${safeName}. If you believe this was sent in error, please contact our support team.</p>
  <p style="margin:8px 0 0;font-size:12px;color:#cccccc;">&copy; ${year} ${safeName}</p>
</div>

</div>
</div>

</body>
</html>`;
}

// ── Text helpers ────────────────────────────────────────────────────────

export function textFooter(portalName: string): string {
  return `---\nThis is an automated message from ${portalName}. If you believe this was sent in error, please contact our support team.`;
}

export function getPortalName(): string {
  return process.env.PORTAL_NAME || "Ops Portal";
}
