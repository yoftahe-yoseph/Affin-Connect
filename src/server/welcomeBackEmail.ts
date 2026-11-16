import nodemailer from 'nodemailer';
import { getLocalizedNeighborhood } from '../constants/translations.ts';
import type { SupportedLanguage } from '../types/index.ts';

export interface WelcomeBackEmailPayload {
  email: string;
  displayName?: string;
  neighborhood?: string;
  language?: string;
  loginTimestamp?: string;
  appUrl?: string;
}

export interface RenderedWelcomeBackEmail {
  subject: string;
  html: string;
  text: string;
  normalizedEmail: string;
  displayName: string;
  neighborhood: string;
  localizedNeighborhood: string;
  language: SupportedLanguage;
  formattedTimestamp: string;
  appUrl: string;
}

const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmailAddress(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const clean = email.trim();
  return clean.length >= 5 && clean.length <= 254 && VALID_EMAIL_RE.test(clean);
}

export function normalizeSupportedLanguage(lang: unknown): SupportedLanguage {
  if (lang === 'am' || lang === 'om' || lang === 'sid' || lang === 'en') {
    return lang;
  }
  return 'en';
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatLoginTimestamp(rawTimestamp?: string): string {
  const date = rawTimestamp ? new Date(rawTimestamp) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(safeDate);
    return `${formatted} (Hawassa · EAT)`;
  } catch {
    return safeDate.toISOString();
  }
}

interface EmailLocaleCopy {
  subject: (name: string) => string;
  eyebrow: string;
  headline: (name: string) => string;
  securityConfirm: string;
  detailEmailLabel: string;
  detailNeighborhoodLabel: string;
  detailTimeLabel: string;
  ctaLabel: string;
  footerNote: string;
}

const EMAIL_LOCALE_COPY: Record<SupportedLanguage, EmailLocaleCopy> = {
  en: {
    subject: (name) => `Welcome back to Hawasa Gebeya, ${name}!`,
    eyebrow: 'HAWASSA SIGN-IN SECURITY CONFIRMATION',
    headline: (name) => `Welcome back to Hawasa Gebeya, ${name}!`,
    securityConfirm:
      'We noticed a new sign-in to your Hawasa Gebeya account. Verified Hawassa shops across your neighborhood are ready for you.',
    detailEmailLabel: 'Account Email',
    detailNeighborhoodLabel: 'Preferred Hawassa Neighborhood',
    detailTimeLabel: 'Sign-In Time',
    ctaLabel: 'Return to Hawasa Gebeya',
    footerNote:
      'If this was you, no further action is needed. If you did not sign in, please update your password or contact Hawasa Gebeya support.',
  },
  am: {
    subject: (name) => `ወደ ሐዋሳ ገበያ እንኳን በደህና ተመለሱ፣ ${name}!`,
    eyebrow: 'የሐዋሳ ገበያ የመግቢያ ደህንነት ማረጋገጫ',
    headline: (name) => `ወደ ሐዋሳ ገበያ እንኳን በደህና ተመለሱ፣ ${name}!`,
    securityConfirm:
      'ወደ ሐዋሳ ገበያ መለያዎ አዲስ መግባት ተመዝግቧል። በሰፈርዎ ያሉ የተረጋገጡ የሐዋሳ ሱቆች ለእርስዎ ዝግጁ ናቸው።',
    detailEmailLabel: 'የመለያ ኢሜይል',
    detailNeighborhoodLabel: 'የተመረጠ የሐዋሳ ሰፈር',
    detailTimeLabel: 'የገቡበት ሰዓት',
    ctaLabel: 'ወደ ሐዋሳ ገበያ ይመለሱ',
    footerNote:
      'ይህ እርስዎ ከሆኑ ተጨማሪ እርምጃ አያስፈልግም። እርስዎ ካልገቡ የይለፍ ቃልዎን ይቀይሩ ወይም የሐዋሳ ገበያ ድጋፍን ያግኙ።',
  },
  om: {
    subject: (name) => `Baga Gara Hawasa Gebeya Deebitan, ${name}!`,
    eyebrow: 'MIRKANEESSA NAGEENYA SEENAA HAWAASAA',
    headline: (name) => `Baga Gara Hawasa Gebeya Deebitan, ${name}!`,
    securityConfirm:
      'Eenyummeessa Hawasa Gebeya keessanitti seenuun haaraan argameera. Suuqiiwwan Hawaasaa naannoo keessanii qophiidha.',
    detailEmailLabel: 'Imeelii Eenyummeessaa',
    detailNeighborhoodLabel: 'Naannoo Hawaasaa Filatame',
    detailTimeLabel: 'Yeroo Seensaa',
    ctaLabel: 'Gara Hawasa Gebeya Deebi\'i',
    footerNote:
      'Kun isin yoo ta\'e tarkaanfiin dabalataa hin barbaachisu. Yoo isin hin seenne ta\'e jecha darbii keessan jijjiiraa.',
  },
  sid: {
    subject: (name) => `Hawasa Gebeyara Baxe Daggino, ${name}!`,
    eyebrow: 'HAWAASA GEBEYA EENNYUMMA KEERANCHIMMA',
    headline: (name) => `Hawasa Gebeyara Baxe Daggino, ${name}!`,
    securityConfirm:
      'Hawasa Gebeya akkawuntita\'nera haaro eessinoonni. Quchumaho buuxantino suuqqa qixxaaweenno.',
    detailEmailLabel: 'Imeele Akkawunte',
    detailNeighborhoodLabel: 'Dooramino Hawaasa Quchuma',
    detailTimeLabel: 'Eessino Yanna',
    ctaLabel: 'Hawasa Gebeyara Higge',
    footerNote:
      'Tini atooti ikkitiro wole hajo dihasii\'anno. Ati eessitoonte ikkiro saato qaale soorri.',
  },
};

export function buildWelcomeBackEmail(
  payload: WelcomeBackEmailPayload
): RenderedWelcomeBackEmail {
  const normalizedEmail = (payload.email ?? '').trim().toLowerCase();
  const displayName = (payload.displayName ?? '').trim().slice(0, 100) || 'Hawassa Shopper';
  const neighborhood = (payload.neighborhood ?? '').trim().slice(0, 100) || 'All Hawassa';
  const language = normalizeSupportedLanguage(payload.language);
  const localizedNeighborhood = getLocalizedNeighborhood(neighborhood, language);
  const formattedTimestamp = formatLoginTimestamp(payload.loginTimestamp);
  const rawAppUrl = (payload.appUrl ?? '').trim();
  const appUrl =
    /^https?:\/\//i.test(rawAppUrl) ? rawAppUrl : 'https://hawasagebeya.vercel.app';

  const copy = EMAIL_LOCALE_COPY[language];
  const subject = copy.subject(displayName);
  const headline = copy.headline(displayName);

  const safeName = escapeHtml(displayName);
  const safeEmail = escapeHtml(normalizedEmail);
  const safeNeighborhood = escapeHtml(localizedNeighborhood);
  const safeTime = escapeHtml(formattedTimestamp);
  const safeAppUrl = escapeHtml(appUrl);
  const safeHeadline = escapeHtml(headline);
  const safeEyebrow = escapeHtml(copy.eyebrow);
  const safeSecurity = escapeHtml(copy.securityConfirm);
  const safeFooter = escapeHtml(copy.footerNote);

  const html = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1C1917;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF8F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E7E5E4;box-shadow:0 8px 24px rgba(4,120,87,0.08);">
          <!-- Sidama Forest Emerald & Honey Gold Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#064E3B 0%,#047857 65%,#D97706 100%);padding:28px 28px 24px 28px;text-align:left;">
              <div style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:rgba(255,255,255,0.18);border:1px solid rgba(253,230,138,0.45);color:#FDE68A;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                ${safeEyebrow}
              </div>
              <h1 style="margin:12px 0 4px 0;font-size:22px;line-height:1.3;font-weight:800;color:#FFFFFF;">
                ${safeHeadline}
              </h1>
              <p style="margin:0;font-size:13px;color:#ECFDF5;opacity:0.92;">
                Hawasa Gebeya · Hawassa, Sidama
              </p>
            </td>
          </tr>
          <!-- Tibeb Accent Strip -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#047857 0%,#D97706 50%,#C2410C 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Main Body -->
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#44403C;">
                ${safeSecurity}
              </p>

              <!-- Sign-In Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FAF8F5;border:1px solid #E7E5E4;border-radius:14px;padding:16px 18px;margin-bottom:22px;">
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#78716C;width:44%;">
                    ${escapeHtml(copy.detailEmailLabel)}
                  </td>
                  <td style="padding:6px 0;font-size:12px;font-weight:700;color:#1C1917;text-align:right;">
                    ${safeEmail}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#78716C;border-top:1px solid #E7E5E4;">
                    ${escapeHtml(copy.detailNeighborhoodLabel)}
                  </td>
                  <td style="padding:6px 0;font-size:12px;font-weight:700;color:#047857;text-align:right;border-top:1px solid #E7E5E4;">
                    ${safeNeighborhood}
                  </td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;color:#78716C;border-top:1px solid #E7E5E4;">
                    ${escapeHtml(copy.detailTimeLabel)}
                  </td>
                  <td style="padding:6px 0;font-size:12px;font-weight:600;color:#D97706;text-align:right;border-top:1px solid #E7E5E4;">
                    ${safeTime}
                  </td>
                </tr>
              </table>

              <!-- Primary Emerald CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding:4px 0 8px 0;">
                    <a href="${safeAppUrl}" style="display:inline-block;padding:13px 26px;background-color:#047857;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;border-radius:12px;">
                      ${escapeHtml(copy.ctaLabel)} →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0;padding-top:16px;border-top:1px solid #E7E5E4;font-size:11px;line-height:1.55;color:#78716C;">
                Signed in as <strong style="color:#44403C;">${safeName}</strong>. ${safeFooter}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    headline,
    '',
    copy.securityConfirm,
    '',
    `${copy.detailEmailLabel}: ${normalizedEmail}`,
    `${copy.detailNeighborhoodLabel}: ${localizedNeighborhood}`,
    `${copy.detailTimeLabel}: ${formattedTimestamp}`,
    '',
    `${copy.ctaLabel}: ${appUrl}`,
    '',
    copy.footerNote,
  ].join('\n');

  return {
    subject,
    html,
    text,
    normalizedEmail,
    displayName,
    neighborhood,
    localizedNeighborhood,
    language,
    formattedTimestamp,
    appUrl,
  };
}

export async function dispatchWelcomeBackEmail(
  rendered: RenderedWelcomeBackEmail
): Promise<{
  sent: true;
  mode: 'simulated_or_smtp';
  channel: 'resend' | 'smtp' | 'preview_log';
}> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const fromAddress =
        process.env.RESEND_FROM_EMAIL?.trim() ||
        'Hawasa Gebeya <onboarding@resend.dev>';
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [rendered.normalizedEmail],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        }),
      });
      if (response.ok) {
        console.info(
          `[Hawasa Gebeya Mail · Resend] Sent welcome-back email to ${rendered.normalizedEmail} (${rendered.localizedNeighborhood})`
        );
        return { sent: true, mode: 'simulated_or_smtp', channel: 'resend' };
      }
      const errBody = await response.text().catch(() => '');
      console.warn(
        `[Hawasa Gebeya Mail · Resend] HTTP ${response.status}; falling back to server log: ${errBody}`
      );
    } catch (err) {
      console.warn('[Hawasa Gebeya Mail · Resend] Dispatch failed; falling back:', err);
    }
  }

  const smtpHost = process.env.SMTP_HOST?.trim();
  if (smtpHost) {
    try {
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASS?.trim();
      const fromAddress =
        process.env.SMTP_FROM?.trim() || 'Hawasa Gebeya <no-reply@hawasagebeya.et>';

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        ...(smtpUser && smtpPass ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
      });

      await transporter.sendMail({
        from: fromAddress,
        to: rendered.normalizedEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      console.info(
        `[Hawasa Gebeya Mail · SMTP] Sent welcome-back email to ${rendered.normalizedEmail} (${rendered.localizedNeighborhood})`
      );
      return { sent: true, mode: 'simulated_or_smtp', channel: 'smtp' };
    } catch (err) {
      console.warn('[Hawasa Gebeya Mail · SMTP] Dispatch failed; falling back:', err);
    }
  }

  console.info(
    [
      '------------------------------------------------------------',
      '[Hawasa Gebeya Mail · Simulated Preview Dispatch]',
      `To:           ${rendered.normalizedEmail}`,
      `Name:         ${rendered.displayName}`,
      `Neighborhood: ${rendered.localizedNeighborhood} (${rendered.neighborhood})`,
      `Language:     ${rendered.language}`,
      `Timestamp:    ${rendered.formattedTimestamp}`,
      `Subject:      ${rendered.subject}`,
      `App URL:      ${rendered.appUrl}`,
      '------------------------------------------------------------',
    ].join('\n')
  );

  return { sent: true, mode: 'simulated_or_smtp', channel: 'preview_log' };
}
