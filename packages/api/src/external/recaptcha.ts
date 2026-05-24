/**
 * Google reCAPTCHA verification.
 * 
 * Mirrors the Java implementation: POST to google.com/recaptcha/api/siteverify
 * with the secret key and user's response token.
 */

export async function verifyRecaptcha(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET || process.env.RE_CAPTCHA_SECRET_KEY;
  
  // In dev/test without a configured secret, skip verification
  if (!secret) {
    console.warn('reCAPTCHA: no secret configured, skipping verification');
    return true;
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.append('remoteip', remoteIp);

    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      body: params,
    });

    const json = await resp.json() as { success: boolean; 'error-codes'?: string[] };
    
    if (!json.success) {
      console.warn('reCAPTCHA failed:', json['error-codes']);
    }
    
    return json.success === true;
  } catch (err) {
    console.error('reCAPTCHA verification error:', err);
    // Don't block registration on technical failure
    return true;
  }
}
