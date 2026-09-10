// Classify browser interstitials, not the paper's scientific content.
// Reuse normal Chromium execution and its existing session; never treat a
// CAPTCHA or subscription denial as a successful browser verification.
export function browserAccessState(html, url, {hasVisiblePassword,hasVisibleChallenge}={}) {
  const text=String(html||'');
  // Publisher article pages often contain an inactive sign-in modal. When the
  // renderer can inspect visibility, only a visible password field is an auth
  // gate. HTML-only callers keep the conservative legacy fallback.
  const passwordGate=typeof hasVisiblePassword==='boolean'
    ? hasVisiblePassword
    : /<input\b[^>]*type\s*=\s*["']?password/i.test(text);
  // Publisher denial pages are not solvable browser challenges. Do not reload
  // them as if a CAPTCHA had succeeded or mistake them for article content.
  if(/\bCPE00001\b/i.test(text)&&/There was a problem providing the content you requested/i.test(text))return 'blocked';
  if(!hasVisibleChallenge&&(/<h1[^>]*>\s*(?:Sorry,?\s+you have been blocked|Your (?:IP|access) (?:has been|is) blocked)\s*</i.test(text)||/<title[^>]*>\s*(?:Access Denied|Request Rejected)\s*<\/title>/i.test(text)))return 'blocked';
  if(passwordGate||/\/(?:login|signin|authenticate|idp\/profile)(?:[/?#]|$)/i.test(new URL(url).pathname)||/(?:name|id)\s*=\s*["']SAMLRequest/i.test(text))return 'login';
  if(/<title[^>]*>\s*(?:verify (?:that )?you are human|security check|access denied|human verification)/i.test(text))return 'interactive';
  if(/<title[^>]*>\s*(?:just a moment|checking your browser|security verification|please wait)/i.test(text)||/id\s*=\s*["'](?:challenge-form|cf-challenge-running|challenge-running)/i.test(text)||/window\._cf_chl_opt\s*=/.test(text))return 'challenge';
  const pageUrl=new URL(url);
  if(pageUrl.hostname.toLowerCase()==='challenges.cloudflare.com'||/^\/cdn-cgi\/(?:challenge-platform\/|l\/chk_captcha(?:[/?#]|$))/i.test(pageUrl.pathname))return 'challenge';
  // A hidden sign-in / registration form can also contain an inactive CAPTCHA.
  // Only its visible renderer observation should gate an otherwise normal page;
  // explicit challenge documents above remain blocked even before widgets render.
  const challengeWidget=typeof hasVisibleChallenge==='boolean'
    ? hasVisibleChallenge
    : /<(?:iframe|div)\b[^>]*(?:challenges\.cloudflare\.com|hcaptcha\.com|recaptcha\/api|class\s*=\s*["'][^"']*(?:g-recaptcha|h-captcha|cf-turnstile))/i.test(text);
  if(challengeWidget)return 'interactive';
  return 'page';
}
