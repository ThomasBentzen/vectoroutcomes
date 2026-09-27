/**
 * Vector Outcomes · Lead forms
 * ------------------------------------------------------------------
 * One dialog and one form serve every lead flow. The field set,
 * validation and submission are shared; a flow only changes the copy,
 * the consent wording, the email subject and the confirmation.
 *
 *   Open a flow     any element with data-open-form="<flow key>"
 *   Add a flow      add an entry to FLOWS and a trigger in the HTML
 *   Add a field     add a .field block inside .lead-form in index.html.
 *                   Required inputs need `required` and a data-error
 *                   message; they are validated automatically.
 *   Destination     the form's action attribute (a Formspree endpoint)
 *
 * Submissions are sent in the background with fetch, so the page never
 * redirects. Formspree answers JSON when asked with Accept: application/json.
 */
(function () {
  'use strict';

  const FLOWS = {
    waitlist: {
      eyebrow: 'Strategic Blueprint',
      title: 'Join the Blueprint waitlist',
      intro: 'Be first to receive the Strategic Blueprint when it is released. One email when it is ready, then occasional insights. No noise.',
      consent: 'I agree to receive the Strategic Blueprint and ongoing insights from Vector Outcomes.',
      submit: 'Join the waitlist',
      formType: 'Strategic Blueprint waitlist',
      subject: 'New Strategic Blueprint waitlist sign-up',
      successTitle: 'You’re on the list.',
      successText: 'The blueprint will be delivered to your inbox as soon as it’s ready.'
    },
    intro: {
      eyebrow: 'Intro call',
      title: 'Book an intro call',
      intro: 'Thirty minutes on where you are and where you want to go. Share a few details and we will propose a time.',
      consent: 'I agree to be contacted by Vector Outcomes about an intro call and to receive ongoing insights.',
      submit: 'Request an intro call',
      formType: 'Intro call request',
      subject: 'New intro call request',
      successTitle: 'Thank you.',
      successText: 'We’ll follow up shortly to schedule your intro call.'
    }
  };

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const REQUEST_TIMEOUT = 15000; // ms before a hanging request counts as failed
  const FALLBACK_EMAIL = 'info@vectoroutcomes.com';

  const dialog = document.getElementById('lead-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return; // Very old browsers keep the direct contact details

  const form = dialog.querySelector('.lead-form');
  const view = dialog.querySelector('.form-view');
  const success = dialog.querySelector('.form-success');
  const status = form.querySelector('.form-status');
  const submitButton = form.querySelector('.form-submit');
  const consent = form.querySelector('[name="consent"]');
  const live = dialog.querySelector('[data-live]');
  const heading = dialog.querySelector('#lead-title');
  const fields = () => Array.from(form.querySelectorAll('input[required], select[required]'));

  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion.matches ? 0 : ms));
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  let currentFlow = null;
  let lastTrigger = null;
  let sending = false;

  /* ---------------- Opening and closing ---------------- */

  function applyFlow(key) {
    const flow = FLOWS[key];
    currentFlow = key;
    dialog.querySelectorAll('[data-context]').forEach((el) => { el.textContent = flow[el.dataset.context]; });
    form.elements.form_type.value = flow.formType;
    form.elements._subject.value = flow.subject;
  }

  async function open(key, trigger) {
    if (!FLOWS[key]) return;
    if (dialog.open) return;
    if (!success.hidden) reset(); // A finished flow starts fresh
    applyFlow(key);
    lastTrigger = trigger || document.activeElement;

    dialog.showModal();
    document.documentElement.classList.add('dialog-open');
    heading.focus({ preventScroll: true });
    await nextFrame();
    dialog.classList.add('is-open');
  }

  async function close() {
    if (!dialog.open) return;
    dialog.classList.remove('is-open');
    await wait(300);
    dialog.close();
    document.documentElement.classList.remove('dialog-open');
    if (!success.hidden) reset();
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus({ preventScroll: true });
  }

  function reset() {
    form.reset();
    fields().forEach((el) => setError(el, ''));
    hideStatus();
    updateSubmitState();
    view.hidden = false;
    view.classList.remove('is-leaving');
    success.hidden = true;
    live.textContent = '';
  }

  /* ---------------- Validation ---------------- */

  function setError(el, message) {
    const error = document.getElementById(el.getAttribute('aria-describedby'));
    if (error) error.textContent = message;
    if (message) el.setAttribute('aria-invalid', 'true');
    else el.removeAttribute('aria-invalid');
  }

  function validate(el) {
    const value = el.value.trim();
    let message = '';
    if (!value) message = el.dataset.error || 'This field is required.';
    else if (el.type === 'email' && !EMAIL_PATTERN.test(value)) message = el.dataset.errorFormat || 'Please enter a valid email address.';
    setError(el, message);
    return !message;
  }

  function updateSubmitState() {
    submitButton.disabled = !consent.checked || sending;
  }

  /* ---------------- Submission ---------------- */

  function showStatus(html) {
    status.innerHTML = html;
    status.hidden = false;
  }

  function hideStatus() {
    status.hidden = true;
    status.textContent = '';
  }

  function setSending(on) {
    sending = on;
    submitButton.setAttribute('aria-busy', on ? 'true' : 'false');
    submitButton.textContent = on ? 'Sending…' : FLOWS[currentFlow].submit;
    updateSubmitState();
  }

  async function send() {
    const endpoint = form.getAttribute('action') || '';
    if (/YOUR_FORM_ID/.test(endpoint)) throw new Error('Form endpoint is not configured yet');

    const controller = 'AbortController' in window ? new AbortController() : null;
    const timer = controller && setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
        signal: controller ? controller.signal : undefined
      });
      if (response.ok) return;
      let data = null;
      try { data = await response.json(); } catch (e) { /* Non JSON error body */ }
      const error = new Error('Submission rejected');
      error.fieldErrors = data && Array.isArray(data.errors) ? data.errors : [];
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (sending || !consent.checked) return;

    const invalid = fields().filter((el) => !validate(el));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }

    hideStatus();
    setSending(true);
    try {
      await send();
      await showSuccess();
    } catch (error) {
      // Map any field level errors from Formspree onto our inline messages
      let mapped = false;
      (error.fieldErrors || []).forEach((item) => {
        const el = item.field && form.elements[item.field];
        if (el && el.setAttribute) { setError(el, item.message); mapped = true; }
      });
      showStatus(mapped
        ? 'Please check the highlighted fields and try again.'
        : `We couldn’t send your details just now. Please try again in a moment, or email <a href="mailto:${FALLBACK_EMAIL}">${FALLBACK_EMAIL}</a>.`);
      if (window.console) console.warn('[Vector Outcomes forms]', error.message);
    } finally {
      setSending(false);
    }
  }

  async function showSuccess() {
    const flow = FLOWS[currentFlow];
    success.querySelector('[data-success="title"]').textContent = flow.successTitle;
    success.querySelector('[data-success="text"]').textContent = flow.successText;

    view.classList.add('is-leaving');
    await wait(350);
    view.hidden = true;
    success.classList.add('is-entering');
    success.hidden = false;
    await nextFrame();
    success.classList.remove('is-entering');
    success.focus({ preventScroll: true });
    live.textContent = `${flow.successTitle} ${flow.successText}`;
  }

  /* ---------------- Wiring ---------------- */

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-open-form]');
    if (trigger) {
      event.preventDefault();
      open(trigger.dataset.openForm, trigger);
      return;
    }
    if (event.target.closest('[data-close-form]')) close();
  });

  // Click on the dimmed area outside the panel closes, as does Escape
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });

  consent.addEventListener('change', updateSubmitState);
  form.addEventListener('submit', onSubmit);

  fields().forEach((el) => {
    // Validate once the visitor leaves a field they have touched, then live while they correct it
    el.addEventListener('blur', () => { if (el.value.trim() || el.hasAttribute('aria-invalid')) validate(el); });
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => { if (el.hasAttribute('aria-invalid')) validate(el); });
  });

  updateSubmitState();

  // Expose for later extensions, e.g. opening a flow from another script
  window.VectorOutcomesForms = { FLOWS, open, close };
})();
