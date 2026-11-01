import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, Phone, MapPin, Menu, X, Wrench, Droplets, House, Settings2, Check, MessageSquare, HeartHandshake, ShieldCheck, LoaderCircle, ChevronDown } from 'lucide-react';
import './styles.css';

const phone = '(815) 988-0719';
const phoneLink = 'tel:+18159880719';
const services = [
  { title: 'Plumbing Repairs', description: 'A drip, a leak, or something not quite right? Let’s get your plumbing back in working order.', icon: Wrench },
  { title: 'Plumbing Installations', description: 'Thoughtful installations that bring the finishing touches of your home together.', icon: Droplets },
  { title: 'Residential Plumbing', description: 'Practical plumbing solutions for the spaces and everyday routines that make a house a home.', icon: House },
  { title: 'General Maintenance', description: 'Give your plumbing the attention it needs. Talk with us about your maintenance needs.', icon: Settings2 },
];
type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: Turnstile } }
function Brand({ light = false }: { light?: boolean }) { return <a className={`brand ${light ? 'brand-light' : ''}`} href="#home" aria-label="Birch Plumbing Inc. home"><span className="brand-icon">b<span /></span><span className="brand-name">birch<span>PLUMBING INC.</span></span></a>; }
function EstimateForm() {
  const [config, setConfig] = useState<{ siteKey: string; configured: boolean } | null>(null);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const started = useRef(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal }).then(r => { if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) throw Error(); return r.json() as Promise<{ siteKey: string; configured: boolean }>; }).then(setConfig).catch(() => { if (!controller.signal.aborted) setConfig({ siteKey: '', configured: false }); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!config?.configured || !config.siteKey) return;
    let disposed = false;
    const render = () => { if (!disposed && container.current && window.turnstile) widget.current = window.turnstile.render(container.current, { sitekey: config.siteKey, action: 'estimate', theme: 'light', size: container.current.clientWidth < 300 ? 'compact' : 'normal', callback: (t: string) => setToken(t), 'expired-callback': () => setToken(''), 'error-callback': () => { setToken(''); setMessage('Security check could not load. Please try again or call us.'); } }); };
    let script = document.querySelector<HTMLScriptElement>('#turnstile-script');
    if (window.turnstile) render();
    else { if (!script) { script = document.createElement('script'); script.id = 'turnstile-script'; script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; document.head.appendChild(script); } script.addEventListener('load', render); }
    return () => { disposed = true; script?.removeEventListener('load', render); if (widget.current && window.turnstile) window.turnstile.remove(widget.current); };
  }, [config]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config?.configured) { setStatus('error'); setMessage('Online estimates are not configured yet. Please call (815) 988-0719 to discuss your project.'); return; }
    if (!token) { setStatus('error'); setMessage('Please complete the security check before sending.'); return; }
    const form = e.currentTarget;
    setStatus('loading'); setMessage('');
    try {
      const response = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...Object.fromEntries(new FormData(form)), turnstileToken: token, startedAt: started.current }), signal: AbortSignal.timeout(20000) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Your request could not be sent. Please try again or call us.');
      setStatus('success'); setMessage('Thank you! Your estimate request has been sent. We’ll be in touch to discuss your project.'); form.reset(); started.current = Date.now();
    } catch (error) { setStatus('error'); setMessage(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'We could not confirm your request. Please call us before submitting again.'); }
    finally { setToken(''); if (widget.current) window.turnstile?.reset(widget.current); }
  }
  return <form className="estimate-form" onSubmit={submit}>
    <div className="form-heading"><span className="eyebrow">LET’S GET STARTED</span><h3>Tell us what you need.</h3><p>A little information helps us help you.</p></div>
    <div className="form-grid">
      <label>Your name <span>*</span><input name="name" placeholder="Full name" autoComplete="name" required maxLength={100} /></label>
      <label>Email address <span>*</span><input name="email" type="email" placeholder="you@example.com" autoComplete="email" required maxLength={254} /></label>
      <label>Phone number <span>*</span><input name="phone" type="tel" placeholder="(815) 555-0123" autoComplete="tel" required maxLength={30} /></label>
      <label>Service needed <span>*</span><span className="select-wrap"><select name="service" required defaultValue=""><option value="" disabled>Select a service</option>{['Plumbing Repairs', 'Plumbing Installations', 'Residential Plumbing', 'General Plumbing Maintenance'].map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={15}/></span></label>
      <label className="full">Property address <span>*</span><input name="address" placeholder="Street address, city, ZIP code" autoComplete="street-address" required maxLength={300} /></label>
      <label className="full">How can we help? <span>*</span><textarea name="description" placeholder="Tell us a little about your plumbing needs…" required minLength={10} maxLength={5000} rows={4} /></label>
    </div>
    <div className="honeypot" aria-hidden="true"><label>Leave this field blank<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div ref={container} className="turnstile" />
    {config && !config.configured && <p className="configuration-note">Online requests are being set up. In the meantime, please <a href={phoneLink}>call {phone}</a> for an estimate.</p>}
    <button className="button button-dark form-submit" type="submit" disabled={status === 'loading' || !config?.configured}>{status === 'loading' ? <><LoaderCircle className="spin" size={18}/> Sending your request…</> : <>Request a Free Estimate <ArrowUpRight size={19}/></>}</button>
    {message && <p className={`form-message ${status}`} role={status === 'error' ? 'alert' : 'status'}>{message}</p>}
    <p className="privacy-note"><ShieldCheck size={14}/> Your details are only used to respond to your inquiry.</p>
  </form>;
}
function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  useEffect(() => { const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }), { threshold: 0.08 }); document.querySelectorAll('.reveal').forEach(el => observer.observe(el)); return () => observer.disconnect(); }, []);
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="utility"><div className="container"><span><MapPin size={13}/> Proudly serving Rockford, IL & surrounding communities</span><a href={phoneLink}>Let’s talk plumbing <ArrowUpRight size={13}/></a></div></div>
    <header><div className="container nav"><Brand/><nav className={menuOpen ? 'open' : ''} aria-label="Main navigation">{[['About us','about'],['Our services','services'],['Why Birch','why-birch'],['Contact','contact']].map(([label,id]) => <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>{label}</a>)}</nav><a className="nav-phone" href={phoneLink}><Phone size={17}/>{phone}</a><a className="button nav-cta" href="#contact">Get an estimate <ArrowUpRight size={17}/></a><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>{menuOpen ? <X/> : <Menu/>}</button></div></header>
    <main id="main-content">
      <section className="hero" id="home"><img className="hero-image" src="/images/kitchen.jpg" alt="Sunlit residential kitchen with a brushed nickel faucet and white sink" fetchPriority="high"/><div className="hero-shade"/><div className="container hero-content"><span className="eyebrow hero-eyebrow"><span className="tiny-line"/> YOUR LOCAL ROCKFORD PLUMBING COMPANY</span><h1>Reliable plumbing<br/>solutions in<br/><span>Rockford, IL.</span></h1><p>From everyday repairs to new installations, we help<br className="desktop-break"/> keep your home flowing. Professional service.<br className="desktop-break"/> Thoughtful solutions. That’s the Birch approach.</p><div className="hero-actions"><a className="button button-lime" href="#contact">Request a Free Estimate <ArrowUpRight size={19}/></a><a className="button button-outline" href={phoneLink}><Phone size={17}/> Call Now</a></div><div className="hero-note"><span className="small-check"><Check size={12}/></span> Local service. Real people. Plumbing made simple.</div></div><div className="hero-caption"><span className="caption-dot"/> Built around your home. <span>And your peace of mind.</span></div></section>
      <div className="promise-strip"><div className="container"><div><MapPin/><span>Rooted in Rockford<span>Serving our local communities</span></span></div><div><Wrench/><span>Repairs & installations<span>Solutions for your everyday needs</span></span></div><div><MessageSquare/><span>People-first service<span>Clear communication, start to finish</span></span></div></div></div>
      <section className="section services-section" id="services"><div className="container"><div className="section-heading reveal"><div><span className="eyebrow">WHAT WE DO</span><h2>Good plumbing.<br/>A better everyday.</h2></div><p>From the small fixes to the fresh starts, we’re here<br className="desktop-break"/> to help with your home’s plumbing needs.</p></div><div className="services-grid">{services.map(({title, description, icon: Icon}, i) => <a href="#contact" className="service-card reveal" key={title}><div className="service-top"><span className="service-icon"><Icon size={26} strokeWidth={1.5}/></span><span className="service-number">0{i+1}</span></div><h3>{title}</h3><p>{description}</p><span className="service-link">Let’s talk <ArrowUpRight size={18}/></span></a>)}</div><p className="services-footnote">Not sure where to start? <a href={phoneLink}>Give us a call. <ArrowRight size={14}/></a> We’re happy to talk it through.</p></div></section>
      <section className="section about-section" id="about"><div className="container about-grid"><div className="about-visual reveal"><img src="/images/kitchen.jpg" alt="Beautifully finished kitchen sink and faucet in a welcoming home" loading="lazy"/><div className="image-label"><House size={24} strokeWidth={1.5}/><span>Your home.<br/><strong>Our care.</strong></span><span className="label-star">✳</span></div></div><div className="about-copy reveal"><span className="eyebrow">HELLO, WE’RE BIRCH</span><h2>Plumbing is our work.<br/>People are our focus.</h2><p>Your home should be a place of comfort. When the plumbing needs attention, you need a straightforward way forward.</p><p>Birch Plumbing Inc. provides plumbing repairs and installations in Rockford, Illinois and the surrounding communities. We focus on understanding your needs, communicating clearly, and treating your home with care.</p><p>Whether you’re fixing a problem or planning something new, let’s find the right plumbing solution for your space.</p><a className="text-link" href="#contact">Get to know your local plumber <ArrowUpRight size={19}/></a><div className="about-location"><MapPin size={19}/><span>Based in Rockford. Here for our neighbors.</span></div></div></div></section>
      <section className="section why-section" id="why-birch"><div className="container"><div className="why-heading reveal"><span className="eyebrow">THE BIRCH APPROACH</span><h2>More than pipes.<br/>It’s how we treat people.</h2><p>Good service starts with the little things. Here’s what matters to us.</p></div><div className="values-grid">{[{icon: ShieldCheck,title:'Professional by nature',text:'A respectful approach to your home, your time, and the work at hand.'},{icon: MessageSquare,title:'Clear from the start',text:'Real conversations, helpful answers, and a shared understanding of your project.'},{icon: Wrench,title:'Care in the details',text:'A focus on thoughtful solutions and quality workmanship, whatever the job.'},{icon: HeartHandshake,title:'Service that feels human',text:'We listen first. Because the right solution starts with understanding you.'}].map(({icon: Icon,title,text}) => <div className="value reveal" key={title}><Icon size={26} strokeWidth={1.5}/><h3>{title}</h3><p>{text}</p></div>)}</div></div></section>
      <section className="cta-section"><div className="container cta-content"><div><span className="eyebrow">A SMALL FIX. A FRESH START.</span><h2>Let’s get things flowing.</h2><p>Have a plumbing project in mind? We’re ready to hear about it.</p></div><a className="button button-lime" href={phoneLink}><Phone size={18}/> Give us a call <ArrowUpRight size={19}/></a><span className="cta-decoration" aria-hidden="true">b</span></div></section>
      <section className="section contact-section" id="contact"><div className="container contact-grid"><div className="contact-copy reveal"><span className="eyebrow">YOUR NEXT STEP</span><h2>Good plumbing<br/>starts with a<br/>conversation.</h2><p>Tell us what’s going on, or what you’re planning.<br className="desktop-break"/> Reach out for a free estimate and let’s talk<br className="desktop-break"/> about how we can help.</p><a className="contact-detail" href={phoneLink}><span className="contact-icon"><Phone size={21}/></span><span><small>GIVE US A CALL</small><strong>{phone}</strong></span><ArrowUpRight size={19}/></a><a className="contact-detail" href="https://www.google.com/maps/search/?api=1&query=1715+Kings+Hwy+Rockford+IL+61107" target="_blank" rel="noreferrer"><span className="contact-icon"><MapPin size={23}/></span><span><small>RIGHT HERE IN ROCKFORD</small><strong>1715 Kings Hwy</strong><span>Rockford, IL 61107</span></span><ArrowUpRight size={19}/></a><div className="service-area"><span className="area-dot"/> Serving Rockford & surrounding communities</div><div className="map-card">{mapOpen ? <iframe title="Birch Plumbing location at 1715 Kings Hwy, Rockford" src="https://www.google.com/maps?q=1715+Kings+Hwy+Rockford+IL+61107&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <button type="button" onClick={() => setMapOpen(true)}><span className="map-road road-one"/><span className="map-road road-two"/><span className="map-road road-three"/><span className="map-pin"><MapPin size={22}/></span><span className="map-button">Explore our location <ArrowUpRight size={15}/></span><span className="map-city">ROCKFORD, ILLINOIS</span></button>}</div><p className="map-note">Interactive map provided by Google. Click to load.</p></div><EstimateForm/></div></section>
    </main>
    <footer><div className="container"><div className="footer-main"><div className="footer-brand"><Brand light/><p>Thoughtful plumbing solutions.<br/>Right here in Rockford, Illinois.</p><a className="footer-phone" href={phoneLink}><Phone size={15}/>{phone}</a></div><div><h4>Explore</h4><a href="#about">About us</a><a href="#services">Our services</a><a href="#why-birch">Why Birch</a><a href="#contact">Get in touch</a></div><div><h4>Our services</h4>{services.map(s => <a key={s.title} href="#services">{s.title === 'General Maintenance' ? 'Plumbing Maintenance' : s.title}</a>)}</div><div className="footer-address"><h4>Let’s connect</h4><p>1715 Kings Hwy<br/>Rockford, IL 61107</p><a href="#contact">Request a free estimate <ArrowUpRight size={15}/></a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Birch Plumbing Inc. All rights reserved.</span><span>Local roots. Thoughtful service.</span><a href="#home">Back to top ↑</a></div></div></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
