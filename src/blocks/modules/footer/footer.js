const form = document.querySelector('.js-form');
const title = document.querySelector('.js-title');
const message = document.querySelector('.js-message');

function reactToRequest() {
  title.classList.add('js-title-invisible');
  message.classList.add('js-message-visible');
  setTimeout(() => {
    title.classList.remove('js-title-invisible');
    message.classList.remove('js-message-visible');
  }, 2000);
}

function sendRequest(event) {
  event.preventDefault();
  form.reset();
  reactToRequest();
}

form.addEventListener('submit', sendRequest);