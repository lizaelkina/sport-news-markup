import {setMenuBurgersState} from '../../components/burger/burger';

(() => {
  const menuDialog = document.querySelector('.js-menu');
  const openButton = document.querySelector('.js-menu-open');

  if (!menuDialog || !openButton) return;

  const closeButton = menuDialog.querySelector('.js-menu-close');
  const menuItems = Array.from(menuDialog.querySelectorAll('.js-menu-link'));

  if (!closeButton) return;

  const ACTIVE_CLASS = 'is-active';

  let closeOperationId = 0;

  const menuItemByHash = new Map();

  menuItems.forEach((menuItem) => {
    const link = menuItem.querySelector('a[href^="#"]');

    if (link?.hash) {
      menuItemByHash.set(link.hash, menuItem);
    }
  });

  const linkedSections = Array.from(menuItemByHash.keys())
    .map(hash => document.getElementById(hash.slice(1)))
    .filter(Boolean);

  function getCurrentSectionId() {
    if (!linkedSections.length) return null;

    const scrollY = window.scrollY;
    const positions = linkedSections
      .map((section) => {
        const rect = section.getBoundingClientRect();

        return {
          id: section.id,
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
        };
      })
      .sort((a, b) => a.top - b.top);

    const isPageBottom = Math.ceil(window.innerHeight + scrollY) >=
      document.documentElement.scrollHeight - 2;

    if (isPageBottom) {
      return positions.at(-1).id;
    }

    const checkpoint = scrollY + window.innerHeight * 0.3;
    const sectionAtCheckpoint = positions.find(
      section => checkpoint >= section.top && checkpoint < section.bottom
    );

    if (sectionAtCheckpoint) {
      return sectionAtCheckpoint.id;
    }

    let currentId = positions[0].id;

    for (const section of positions) {
      if (checkpoint >= section.top) {
        currentId = section.id;
      }
    }

    return currentId;
  }

  function setActiveMenuItem(activeItem) {
    menuItems.forEach((menuItem) => {
      const isActive = menuItem === activeItem;
      const link = menuItem.querySelector('a[href^="#"]');

      menuItem.classList.toggle(ACTIVE_CLASS, isActive);

      if (isActive) {
        link?.setAttribute('aria-current', 'location');
      } else {
        link?.removeAttribute('aria-current');
      }
    });
  }

  function syncActiveMenuItem() {
    const currentSectionId = getCurrentSectionId();
    const activeItem = currentSectionId
      ? menuItemByHash.get(`#${currentSectionId}`) ?? null
      : null;

    setActiveMenuItem(activeItem);
  }

  function openMenu() {
    closeOperationId += 1;
    menuDialog.classList.remove('is-closing');

    if (!menuDialog.open) {
      menuDialog.showModal();
    }

    setMenuBurgersState(openButton, closeButton, true);
    syncActiveMenuItem();
  }

  async function closeMenu() {
    if (!menuDialog.open || menuDialog.classList.contains('is-closing')) return;

    const operationId = ++closeOperationId;

    setMenuBurgersState(openButton, closeButton, false);
    menuDialog.classList.add('is-closing');

    await new Promise(resolve => window.requestAnimationFrame(resolve));

    if (operationId !== closeOperationId) return;

    await Promise.allSettled(
      menuDialog.getAnimations().map(animation => animation.finished)
    );

    if (operationId !== closeOperationId) return;

    if (menuDialog.open) {
      menuDialog.close();
    }

    menuDialog.classList.remove('is-closing');
  }

  function closeOnBackdropClick({currentTarget, target}) {
    if (target === currentTarget) {
      closeMenu();
    }
  }

  menuItems.forEach((menuItem) => {
    menuItem.addEventListener('click', () => {
      setActiveMenuItem(menuItem);
      closeMenu();
    });
  });

  openButton.addEventListener('click', openMenu);
  closeButton.addEventListener('click', closeMenu);
  menuDialog.addEventListener('click', closeOnBackdropClick);

  menuDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMenu();
  });
})();
