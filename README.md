# Vector Outcomes

Marketing site for Vector Outcomes, Salesforce and Agentforce consulting by Thomas Bentzen.

Static site with no build step. Open `index.html` in a browser to preview.

## Structure

```
index.html                  The whole page (HTML and CSS), including the lead form dialog
assets/js/interactions.js   Parallax, scroll reveal, compass and arrow draw-in, smooth scrolling
assets/js/forms.js          Lead forms: Blueprint waitlist and intro call share one form
assets/img/                 Images
CNAME                       Custom domain for GitHub Pages
.nojekyll                   Tells GitHub Pages to serve files as-is
```

## Tuning the interactions

Speeds, easing and offsets live in the `CONFIG` object at the top of
`assets/js/interactions.js`. All effects respect `prefers-reduced-motion`.

## Lead forms (Formspree)

The circular "Join the waitlist" badge and every "Book an intro call" button
open the same form in a dialog. Submissions are sent in the background with
`fetch` to Formspree, so the page never redirects. Each submission carries a
`form_type` field ("Strategic Blueprint waitlist" or "Intro call request") and
its own email subject, so you can tell them apart in your inbox.

### One-time setup

1. Sign up at [formspree.io](https://formspree.io) with `info@vectoroutcomes.com`
   and confirm the address.
2. Create a new form. Formspree gives it an endpoint like
   `https://formspree.io/f/abcdwxyz`.
3. In `index.html`, replace `YOUR_FORM_ID` in the lead form's `action`
   attribute with that ID.
4. Optional: in the Formspree form settings, restrict submissions to
   `vectoroutcomes.com`.

Until step 3 is done, submitting shows a polite message asking visitors to
email `info@vectoroutcomes.com` instead.

### Extending

- **New flow** (another trigger with its own copy): add an entry to `FLOWS` in
  `assets/js/forms.js` and give the trigger `data-open-form="<key>"`.
- **New field**: add a `.field` block inside `.lead-form` in `index.html`.
  Required fields need `required` and a `data-error` message and are then
  validated automatically.

## Publishing with GitHub Pages

1. Repository Settings, then Pages.
2. Source: Deploy from a branch. Branch: `main`, folder: `/ (root)`.
3. Custom domain: `vectoroutcomes.com` (set in `CNAME`), with the domain's DNS
   pointed at GitHub Pages as described in GitHub's docs.

## Open placeholders

- Formspree form ID in `index.html` (`YOUR_FORM_ID`, see above)
- CVR number in the footer (a `TODO` comment in `index.html` holds the markup)
