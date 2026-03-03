/**
 * VNLOC — main.js
 * Navigation, scroll-reveal, Lego tower animation, misc UX
 */
'use strict';

// ─── Nav: scroll state + mobile toggle ──────────────────────
(function initNav() {
  const nav    = document.getElementById('nav');
  const burger = document.getElementById('navBurger');
  const links  = document.getElementById('navLinks');

  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  burger?.addEventListener('click', () => {
    links.classList.toggle('open');
    burger.classList.toggle('active');
  });

  // Close menu on link click
  links?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      burger?.classList.remove('active');
    });
  });

  // Active link highlight on scroll
  const sections = document.querySelectorAll('section[id]');
  const navAnchors = links?.querySelectorAll('a[href^="#"]') ?? [];

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navAnchors.forEach(a => {
          a.classList.toggle('nav-active', a.getAttribute('href') === '#' + e.target.id);
        });
      }
    });
  }, { threshold: 0.4 });

  sections.forEach(s => io.observe(s));
})();

// ─── Scroll-reveal ──────────────────────────────────────────
(function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;

      // Stagger siblings within same parent
      const siblings = [...e.target.parentElement.querySelectorAll('.reveal:not(.visible)')];
      const idx = siblings.indexOf(e.target);

      setTimeout(() => {
        e.target.classList.add('visible');
      }, Math.min(idx * 80, 400));

      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => io.observe(el));
})();

// ─── Lego tower animation (About section) ───────────────────
(function initLegoTower() {
  const tower = document.querySelector('.lego-tower');
  if (!tower) return;

  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      tower.classList.add('animated');
      io.disconnect();
    }
  }, { threshold: 0.3 });

  io.observe(tower);
})();

// ─── Services card: stagger reveal with data-index delay ────
(function initServicesStagger() {
  const cards = document.querySelectorAll('.svc-card');
  cards.forEach(card => {
    const idx = parseInt(card.dataset.index ?? 0, 10);
    card.style.transitionDelay = `${idx * 60}ms`;
  });
})();

// ─── Contact form ────────────────────────────────────────────
(function initForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    const btn = form.querySelector('button[type=submit]');
    const action = form.getAttribute('action') ?? '';

    // If formspree not configured, use mailto fallback
    if (action.includes('your-form-id')) {
      e.preventDefault();
      const name    = form.name?.value ?? '';
      const email   = form.email?.value ?? '';
      const company = form.company?.value ?? '';
      const message = form.message?.value ?? '';

      const subject = encodeURIComponent(`VNLOC Enquiry from ${name}${company ? ' — ' + company : ''}`);
      const body    = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nCompany: ${company}\n\n${message}`);
      window.location.href = `mailto:info@vnloc.com.au?subject=${subject}&body=${body}`;
      return;
    }

    // Formspree submission
    e.preventDefault();
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const res = await fetch(action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        btn.textContent = 'Message Sent ✓';
        btn.style.background = '#00A650';
        form.reset();
      } else {
        throw new Error();
      }
    } catch {
      btn.textContent = 'Error — try email';
      btn.disabled = false;
    }
  });
})();

// ─── Smooth scroll polyfill for older Safari ─────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ─── Cursor glow effect on hero ──────────────────────────────
(function initCursorGlow() {
  const hero = document.querySelector('.hero');
  if (!hero || window.matchMedia('(hover: none)').matches) return;

  const glow = document.createElement('div');
  glow.style.cssText = [
    'position:absolute',
    'width:300px', 'height:300px',
    'border-radius:50%',
    'background:radial-gradient(circle,rgba(245,195,0,.06) 0%,transparent 70%)',
    'pointer-events:none',
    'transform:translate(-50%,-50%)',
    'transition:left .15s ease,top .15s ease',
    'z-index:1',
  ].join(';');
  hero.appendChild(glow);

  hero.addEventListener('mousemove', e => {
    const rect = hero.getBoundingClientRect();
    glow.style.left = (e.clientX - rect.left) + 'px';
    glow.style.top  = (e.clientY - rect.top)  + 'px';
  });
})();

// ─── Burger animation CSS ─────────────────────────────────────
const burgerStyle = document.createElement('style');
burgerStyle.textContent = `
  .nav-burger.active span:nth-child(1){ transform:rotate(45deg) translate(5px,5px); }
  .nav-burger.active span:nth-child(2){ opacity:0; }
  .nav-burger.active span:nth-child(3){ transform:rotate(-45deg) translate(5px,-5px); }
  .nav-links a.nav-active { color: var(--gold); }
`;
document.head.appendChild(burgerStyle);
