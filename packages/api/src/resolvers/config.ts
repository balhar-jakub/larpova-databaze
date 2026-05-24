export const configResolver = () => ({
  reCaptchaKey: process.env.RECAPTCHA_SITE_KEY || process.env.RE_CAPTCHA_SITE_KEY || '',
});
