/**
 * VNLOC — main.js
 * Nav, mobile menu, card reveals, form handler
 */
'use strict';

// ─── Nav solid on scroll ─────────────────────────────────────
(function () {
  const nav = document.getElementById('nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.classList.toggle('solid', window.scrollY > 20);
  }, { passive: true });
})();

// ─── Mobile burger ───────────────────────────────────────────
(function () {
  const burger = document.getElementById('burger');
  const links  = document.getElementById('navlinks');
  if (!burger || !links) return;

  burger.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
    const spans = burger.querySelectorAll('span');
    if (open) {
      spans[0].style.transform = 'rotate(45deg) translate(5px,5px)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px,-5px)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });

  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      burger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    });
  });
})();

// ─── Nav link clicks — instant jump (no scroll animation) ────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    // Use scrollTo without behavior for universal instant jump
    // (avoids CSS scroll-behavior and scrollIntoView quirks on mobile Safari)
    const top = el.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo(0, top);
  });
});

// ─── Story card scroll reveal ─────────────────────────────────
(function () {
  const cards = document.querySelectorAll('.card');
  if (!cards.length) return;

  // Add initial hidden state via style
  const style = document.createElement('style');
  style.textContent = `
    .card { opacity: 0; transform: translateY(32px); transition: opacity .75s ease, transform .75s ease; }
    .card.v  { opacity: 1; transform: none; }
  `;
  document.head.appendChild(style);

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('v');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(c => io.observe(c));
})();

// ─── Services & values card stagger ──────────────────────────
(function () {
  const style = document.createElement('style');
  style.textContent = `
    .svc-g-card, .val-card { opacity: 0; transform: translateY(20px);
      transition: opacity .5s ease, transform .5s ease; }
    .svc-g-card.v, .val-card.v { opacity: 1; transform: none; }
  `;
  document.head.appendChild(style);

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const siblings = [...e.target.parentElement.children];
      const idx = siblings.indexOf(e.target);
      setTimeout(() => e.target.classList.add('v'), idx * 60);
      io.unobserve(e.target);
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.svc-g-card, .val-card').forEach(el => io.observe(el));
})();

// ─── Impact flow animation ────────────────────────────────────
(function () {
  const flow = document.querySelector('.impact-flow');
  if (!flow) return;
  const style = document.createElement('style');
  style.textContent = `
    .if-node, .if-arrow { opacity: 0; transform: translateX(-16px);
      transition: opacity .6s ease, transform .6s ease; }
    .impact-flow.v .if-node, .impact-flow.v .if-arrow {
      opacity: 1; transform: none; }
    .impact-flow.v .if-node:nth-child(1) { transition-delay: 0s; }
    .impact-flow.v .if-arrow:nth-child(2) { transition-delay: .15s; }
    .impact-flow.v .if-node:nth-child(3) { transition-delay: .3s; }
    .impact-flow.v .if-arrow:nth-child(4) { transition-delay: .45s; }
    .impact-flow.v .if-node:nth-child(5) { transition-delay: .6s; }
  `;
  document.head.appendChild(style);

  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { flow.classList.add('v'); io.disconnect(); }
  }, { threshold: 0.3 });
  io.observe(flow);
})();

// ─── Contact form ─────────────────────────────────────────────
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const action = form.getAttribute('action') || '';

    // Fallback to mailto if formspree not configured
    if (action.includes('your-form-id')) {
      const name    = form.name?.value    || '';
      const email   = form.email?.value   || '';
      const company = form.company?.value || '';
      const msg     = form.message?.value || '';
      const sub = encodeURIComponent(`VNLOC Enquiry — ${name}${company ? ' / ' + company : ''}`);
      const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nCompany: ${company}\n\n${msg}`);
      window.location.href = `mailto:vnloc@outlook.com?subject=${sub}&body=${body}`;
      return;
    }

    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const res  = await fetch(action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        btn.textContent = 'Message Sent ✓';
        btn.style.background = '#00A650';
        form.reset();
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch {
      btn.textContent = 'Error — try email';
      btn.style.background = '';
      btn.disabled = false;
    }
  });
})();
