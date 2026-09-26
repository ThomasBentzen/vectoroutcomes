# Vector Outcomes

Marketing site for Vector Outcomes, Salesforce and Agentforce consulting by Thomas Bentzen.

Static site with no build step. Open `index.html` in a browser to preview.

## Structure

```
index.html                  The whole page (HTML and CSS)
assets/js/interactions.js   Instrument parallax, vector arrow draw-in, smooth scrolling
assets/img/                 Images
.nojekyll                   Tells GitHub Pages to serve files as-is
```

## Tuning the interactions

Speeds, easing and offsets live in the `CONFIG` object at the top of
`assets/js/interactions.js`. All effects respect `prefers-reduced-motion`.

## Publishing with GitHub Pages

1. Repository Settings, then Pages.
2. Source: Deploy from a branch. Branch: `main`, folder: `/ (root)`.
3. Optional custom domain: enter `vectoroutcomes.com` under Custom domain,
   then point the domain's DNS at GitHub Pages as described in GitHub's docs.

## Open placeholders

- `[Client name, pending approval]` in the case study
- `[EMAIL]` in the contact section
- `CVR [NUMBER]` in the footer
- "Book an intro call" buttons still point to `#contact`
