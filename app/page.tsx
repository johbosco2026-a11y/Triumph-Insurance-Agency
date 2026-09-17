import Link from 'next/link';

const solutions = [
  ['⌂', 'Home & property', 'Protect your home, contents, and the people who make it yours.'],
  ['▱', 'Motor insurance', 'Confident cover for your car, matatu, or commercial vehicle.'],
  ['✚', 'Health insurance', 'Thoughtful medical cover for you and your family.'],
];

export default function HomePage() {
  return <>
    <header className="site-header"><div className="container nav"><Link className="brand" href="/"><b className="brand-mark">T</b><span>TRIUMPH<br /><small>INSURANCE AGENCY</small></span></Link><nav className="nav-links"><Link href="/insurance">Insurance</Link><Link href="/claims">Claims</Link><Link href="/faqs">FAQs</Link><Link href="/contact">Contact</Link></nav><div className="nav-actions"><Link className="btn btn-outline" href="/login">Sign in</Link><Link className="btn btn-gold" href="/get-a-quote">Get a quote</Link></div></div></header>
    <main><section className="hero"><div className="container hero-content"><p className="eyebrow">Protection, made personal</p><h1>Cover what matters.<br /><em>Live with confidence.</em></h1><p>Insurance should feel clear, not complicated. We help you find the right protection for your life, your family, and your ambitions.</p><div className="hero-buttons"><Link className="btn btn-gold" href="/get-a-quote">Start with a quote</Link><Link className="btn btn-hero-secondary" href="/insurance">Explore insurance</Link></div><div className="trust-row"><span><strong>15+</strong>years of guidance</span><span><strong>4.9/5</strong>client experience</span><span><strong>24/7</strong>claims support</span></div></div></section><section className="section"><div className="container"><div className="section-head"><p className="eyebrow">Find your cover</p><h2>Protection for every part of life.</h2><p className="section-intro">From your first car to your growing business, our advisors help you make confident decisions.</p></div><div className="grid grid-3">{solutions.map(([icon, title, copy]) => <article className="card" key={title}><div className="card-icon">{icon}</div><h3>{title}</h3><p>{copy}</p><Link className="card-link" href="/insurance">Learn more →</Link></article>)}</div></div></section></main>
    <footer className="footer"><div className="container"><p>© {new Date().getFullYear()} Triumph Insurance Agency. Clear advice. Dependable protection.</p></div></footer>
  </>;
}
