import { describe, it, expect, afterEach } from '@jest/globals';
import type { Transporter } from 'nodemailer';

/**
 * email.ts coverage (68% at the Phase 1 baseline — the four senders had
 * never been executed; only getTransporter's lazy init ran, and always
 * against an SMTP transport nothing sent through).
 *
 * The transporter cache now has a test seam (setTransporterForTesting,
 * same spirit as setFileService / setCalendarClientForTesting), so the
 * senders run against a fake transporter: every mail's from/to/subject and
 * the user-supplied URL landing inside the HTML body.
 */

/** A fake transporter recording every sendMail call. */
function fakeTransporter() {
  const mails: Array<{ from: string; to: string; subject: string; html: string }> = [];
  const transporter = {
    sendMail: async (opts: { from: string; to: string; subject: string; html: string }) => {
      mails.push({ from: opts.from, to: opts.to, subject: opts.subject, html: opts.html });
      return { messageId: 'ok' };
    },
  } as unknown as Transporter;
  return { transporter, mails };
}

afterEach(async () => {
  const { setTransporterForTesting } = await import('../external/email.js');
  setTransporterForTesting(null);
});

async function withFake() {
  const mod = await import('../external/email.js');
  const fake = fakeTransporter();
  mod.setTransporterForTesting(fake.transporter);
  return { mod, ...fake };
}

describe('sendPasswordResetEmail', () => {
  it('sends the reset link in subject and body from the configured address', async () => {
    const { mod, mails } = await withFake();
    const url = 'https://csld.vezlute.cz/reset-password?token=abc123';
    await mod.sendPasswordResetEmail('user@example.cz', url);

    expect(mails).toHaveLength(1);
    const mail = mails[0];
    expect(mail.to).toBe('user@example.cz');
    expect(mail.subject).toContain('Obnovení hesla');
    expect(mail.html).toContain(url);
    expect(mail.html).toContain('platný 1 hodinu');
    expect(mail.from).toBe('larpovadatabaze@gmail.com');
  });
});

describe('sendAuthorCommentNotification', () => {
  it('names the game, the commenter and links the game', async () => {
    const { mod, mails } = await withFake();
    await mod.sendAuthorCommentNotification(
      'author@example.cz',
      'Poslední doušek',
      'komentující',
      'https://csld.vezlute.cz/game/42',
    );

    const mail = mails[0];
    expect(mail.to).toBe('author@example.cz');
    expect(mail.subject).toContain('Poslední doušek');
    expect(mail.html).toContain('komentující');
    expect(mail.html).toContain('https://csld.vezlute.cz/game/42');
  });
});

describe('sendNewEventNotification', () => {
  it('names the event and links it', async () => {
    const { mod, mails } = await withFake();
    await mod.sendNewEventNotification(
      'player@example.cz',
      'Festival larpů',
      'https://csld.vezlute.cz/event/7',
    );

    const mail = mails[0];
    expect(mail.subject).toContain('Festival larpů');
    expect(mail.html).toContain('Festival larpů');
    expect(mail.html).toContain('https://csld.vezlute.cz/event/7');
  });
});

describe('sendMagicLinkEmail', () => {
  it('sends the one-time link with the 15-minute note', async () => {
    const { mod, mails } = await withFake();
    const url = 'https://csld.vezlute.cz/magic-link?token=xyz';
    await mod.sendMagicLinkEmail('someone@example.cz', url);

    const mail = mails[0];
    expect(mail.to).toBe('someone@example.cz');
    expect(mail.subject).toContain('Přihlášení');
    expect(mail.html).toContain(url);
    expect(mail.html).toContain('15 minut');
    expect(mail.html).toContain('ignorujte');
  });
});
