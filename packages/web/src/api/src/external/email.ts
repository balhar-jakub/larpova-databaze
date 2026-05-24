import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.MAIL_HOST || 'localhost';
  const port = parseInt(process.env.MAIL_PORT || '2525', 10);
  const user = process.env.MAIL_USERNAME || '';
  const pass = process.env.MAIL_PASSWORD || '';

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  });

  return transporter;
}

const FROM = process.env.MAIL_FROM || 'larpovadatabaze@gmail.com';

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: FROM,
    to,
    subject: 'Obnovení hesla - Larpová databáze',
    html: `
      <p>Dobrý den,</p>
      <p>pro obnovení hesla klikněte na následující odkaz:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Odkaz je platný 1 hodinu.</p>
    `,
  });
}

/**
 * Notify game authors when someone comments on their game.
 */
export async function sendAuthorCommentNotification(
  to: string,
  gameName: string,
  commenterName: string,
  gameUrl: string,
): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: FROM,
    to,
    subject: `Nový komentář u hry "${gameName}"`,
    html: `
      <p>Dobrý den,</p>
      <p>uživatel <strong>${commenterName}</strong> přidal komentář ke hře "${gameName}".</p>
      <p><a href="${gameUrl}">Zobrazit hru</a></p>
    `,
  });
}

/**
 * Notify users about a new event intersecting their wanted games.
 * (Placeholder — implement after event-games relationship is clear)
 */
export async function sendNewEventNotification(
  to: string,
  eventName: string,
  eventUrl: string,
): Promise<void> {
  const t = getTransporter();
  await t.sendMail({
    from: FROM,
    to,
    subject: `Nová událost: ${eventName}`,
    html: `
      <p>Dobrý den,</p>
      <p>byla přidána nová larpová událost <strong>${eventName}</strong>.</p>
      <p><a href="${eventUrl}">Zobrazit událost</a></p>
    `,
  });
}
