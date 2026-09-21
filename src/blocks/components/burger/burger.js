export function setMenuBurgersState(openButton, closeButton, isOpen) {
  openButton.classList.toggle('is-active', isOpen);
  closeButton.classList.toggle('is-active', isOpen);

  openButton.setAttribute('aria-expanded', String(isOpen));
}
