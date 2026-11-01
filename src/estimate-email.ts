export type EstimateFields = Record<'name' | 'email' | 'phone' | 'service' | 'address' | 'description', string>;

// A fallback draft is not a submission: the visitor must send it in their email app.
export function buildEstimateEmail(recipient: string, fields: EstimateFields): string {
  if (!/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(recipient)) throw new Error('Invalid contact email.');
  const subject = `Birch Plumbing estimate request: ${fields.service.replace(/[\r\n]/g, ' ')}`;
  const body = `Hello Birch Plumbing,\n\nI would like to request a free estimate.\n\nName: ${fields.name}\nEmail: ${fields.email}\nPhone: ${fields.phone}\nService: ${fields.service}\nProperty address: ${fields.address}\n\nHow can you help?\n${fields.description}\n`;
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
