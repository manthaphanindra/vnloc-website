# VNLOC — We Unlock Value

> Industrial AI & Analytics · Perth, Western Australia

Live site: **[www.vnloc.com](https://www.vnloc.com)**

---

## About

VNLOC delivers advanced analytics, Industrial AI, and digital technologies for the mining and industrial sector. Founded by a seasoned mining engineer and a data science leader, we believe true value lies at the intersection of domain expertise and digital innovation.

**2% of every contract** is directed toward nominated charities and community development initiatives.

---

## Services

| # | Service |
|---|---------|
| 01 | Advanced Analytics |
| 02 | AI Solutions |
| 03 | GenAI & Agents |
| 04 | Orebody Analytics |
| 05 | Spatial Intelligence |
| 06 | Operational Analytics |
| 07 | Data Science Consulting |
| 08 | Custom Dashboarding |
| 09 | Computer Vision |

---

## Tech Stack

- **Three.js r160** — scroll-driven 3D mine photo flyover (no bundler, CDN importmap)
- **Vanilla JS** — nav, scroll-reveal, mobile menu, contact form
- **CSS** — dark theme, glassmorphism cards, responsive
- **GitHub Pages** — static hosting, root of `main` branch

---

## Local Development

No build step required. Serve directly with Python:

```bash
/opt/homebrew/bin/python3 -m http.server 3000
```

Then open `http://localhost:3000`

> After editing `js/scene.js`, increment `?v=N` on the script tag in `index.html` to bust the browser cache.

---

## Deployment

Pushes to `main` are automatically deployed via GitHub Pages.

```bash
git add .
git commit -m "your message"
git push origin main
```

---

## Contact

- **Email:** vnloc@outlook.com
- **Location:** Perth, Western Australia
