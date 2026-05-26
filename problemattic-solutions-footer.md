# ProbleMattic Solutions footer lockup

Reusable footer branding for DeployDeliver and other ProbleMattic Solutions properties.

**Link:** [https://problematticsolutions.com](https://problematticsolutions.com)

| Element | Style |
| --- | --- |
| Proble | White `#ffffff` |
| Mattic | Brand yellow `#facc15` |
| Solutions | Light grey `#d4d4d8` |
| Background | `#0a0a0f` |
| Hazard stripe | Diagonal black/yellow repeating gradient |

The hazard stripe sits in a `width: fit-content` wrapper with the wordmark so the line spans the full width of **ProbleMattic Solutions** and stays centered.

---

## React + Tailwind

```tsx
const HAZARD_STRIPE =
  "repeating-linear-gradient(-45deg, #0a0a0f 0, #0a0a0f 14px, #facc15 14px, #facc15 28px)";

export function ProblematticSolutionsFooter() {
  return (
    <footer className="relative border-t border-white/10 bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center">
        <a
          href="https://problematticsolutions.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-col items-center text-center no-underline"
        >
          <div className="inline-flex flex-col items-stretch w-fit gap-2">
            <div
              className="h-1.5 w-full opacity-90 group-hover:opacity-100 transition-opacity"
              style={{ background: HAZARD_STRIPE }}
              aria-hidden
            />

            <div
              className="flex items-baseline justify-center gap-x-2 whitespace-nowrap"
              style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
            >
              <span className="text-2xl sm:text-3xl tracking-tight">
                <span className="text-white">Proble</span>
                <span className="text-[#facc15]">Mattic</span>
              </span>
              <span className="text-2xl sm:text-3xl tracking-tight text-[#d4d4d8]">
                Solutions
              </span>
            </div>
          </div>
        </a>
      </div>
    </footer>
  );
}
```

**Source in this repo:** `src/app/components/ProblematticSolutionsFooter.tsx`

---

## Plain HTML + CSS

Drop into any static site, CMS, or non-React app.

### HTML

```html
<footer class="ps-footer">
  <div class="ps-footer__inner">
    <a
      class="ps-lockup"
      href="https://problematticsolutions.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div class="ps-lockup__wrap">
        <div class="ps-lockup__stripe" aria-hidden="true"></div>
        <div class="ps-lockup__text">
          <span class="ps-lockup__brand">
            <span class="ps-lockup__proble">Proble</span><span class="ps-lockup__mattic">Mattic</span>
          </span>
          <span class="ps-lockup__solutions">Solutions</span>
        </div>
      </div>
    </a>
  </div>
</footer>
```

### CSS

```css
.ps-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: #0a0a0f;
  padding: 2rem 1rem;
}

.ps-footer__inner {
  display: flex;
  justify-content: center;
}

.ps-lockup {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  text-decoration: none;
  color: inherit;
}

.ps-lockup__wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  width: fit-content;
  gap: 0.5rem;
}

.ps-lockup__stripe {
  height: 6px;
  width: 100%;
  opacity: 0.9;
  background: repeating-linear-gradient(
    -45deg,
    #0a0a0f 0,
    #0a0a0f 14px,
    #facc15 14px,
    #facc15 28px
  );
}

.ps-lockup:hover .ps-lockup__stripe {
  opacity: 1;
}

.ps-lockup__text {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-size: clamp(1.5rem, 4vw, 1.875rem);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

.ps-lockup__proble {
  color: #ffffff;
}

.ps-lockup__mattic {
  color: #facc15;
}

.ps-lockup__solutions {
  color: #d4d4d8;
}
```

### Lockup only (no footer wrapper)

Use the inner `<a>` and `.ps-lockup__*` styles if you only need the wordmark block, not a full-page footer.

---

## Copy rules

- **ProbleMattic** — camel case; `Proble` white, `Mattic` yellow.
- **Solutions** — separate word, light grey (not yellow).
- Do not show `problematticsolutions.com` as visible text unless you want it; the link target is still the URL above.
