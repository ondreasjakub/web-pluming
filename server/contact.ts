/** Default requested by the site owner. BUSINESS_EMAIL always overrides it. */
export function getBusinessEmail(env: { BUSINESS_EMAIL?: string }): string {
  return env.BUSINESS_EMAIL?.trim() || 'jakub.ondreas@gmail.com';
}

export function isValidBusinessEmail(env: { BUSINESS_EMAIL?: string }): boolean {
  return /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(getBusinessEmail(env));
}
