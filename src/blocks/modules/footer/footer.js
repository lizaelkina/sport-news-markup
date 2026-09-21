(() => {
  const footer = document.querySelector('.js-footer');

  if (!footer) return;

  const newsletterForm = footer.querySelector('.js-newsletter-form');
  const titleContainer = footer.querySelector('.js-newsletter-title');
  const liveStatus = footer.querySelector('.js-newsletter-status');
  const submitButton = footer.querySelector('.js-newsletter-submit');
  const defaultTitleText = titleContainer
    ?.querySelector('[data-title="default"]')
    ?.textContent;
  const successTitleText = titleContainer
    ?.querySelector('[data-title="success"]')
    ?.textContent;

  if (
    !newsletterForm ||
    !titleContainer ||
    !liveStatus ||
    !submitButton ||
    !defaultTitleText ||
    !successTitleText
  ) {
    return;
  }

  const SUCCESS_MESSAGE_DURATION_MS = 2000;

  let isTransitioning = false;

  function delay(duration) {
    return new Promise(resolve => window.setTimeout(resolve, duration));
  }

  function applyTitleState(state) {
    titleContainer.dataset.state = state;
    liveStatus.textContent = state === 'success'
      ? successTitleText
      : defaultTitleText;
  }

  async function transitionTitleTo(state) {
    titleContainer.dataset.state = state === 'success'
      ? 'to-success'
      : 'to-default';

    const nextTitle = titleContainer.querySelector(`[data-title="${state}"]`);

    if (nextTitle) {
      await Promise.allSettled(
        nextTitle.getAnimations().map(animation => animation.finished)
      );
    }

    applyTitleState(state);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isTransitioning) return;

    isTransitioning = true;
    submitButton.disabled = true;

    try {
      newsletterForm.reset();
      await transitionTitleTo('success');
      await delay(SUCCESS_MESSAGE_DURATION_MS);
      await transitionTitleTo('default');
    } finally {
      submitButton.disabled = false;
      isTransitioning = false;
    }
  }

  applyTitleState('default');
  newsletterForm.addEventListener('submit', handleSubmit);
})();
