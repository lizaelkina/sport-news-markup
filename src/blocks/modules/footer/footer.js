const form = document.querySelector('.js-form');
const title = document.querySelector('.js-title');
const status = document.querySelector('.js-title-status');
const submit = form?.querySelector('[type="submit"]');
const defaultTitle = form?.querySelector('[data-title="default"]')?.textContent;
const successTitle = form?.querySelector('[data-title="success"]')?.textContent;
const SUCCESS_DURATION = 2000;
let busy = false;

function wait(duration) {
  return new Promise(resolve => window.setTimeout(resolve, duration));
}

function setState(state) {
  title.dataset.state = state;
  status.textContent = state === 'success' ? successTitle : defaultTitle;
}

async function changeState(state) {
  title.dataset.state = state === 'success' ? 'to-success' : 'to-default';
  const nextTitle = form.querySelector(`[data-title="${state}"]`);
  await Promise.all(nextTitle.getAnimations().map(animation => animation.finished));
  setState(state);
}

async function sendRequest(event) {
  event.preventDefault();
  if (busy) return;

  busy = true;
  submit.disabled = true;
  form.reset();

  await changeState('success');
  await wait(SUCCESS_DURATION);
  await changeState('default');

  submit.disabled = false;
  busy = false;
}

if (form && title && status && submit && defaultTitle && successTitle) {
  title.dataset.state = 'default';
  form.addEventListener('submit', sendRequest);
}
