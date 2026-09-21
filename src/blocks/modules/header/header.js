(() => {
  const header = document.querySelector('.js-header');

  if (!header) return;

  const desktopMediaQuery = window.matchMedia('(min-width: 1025px)');
  const navItems = Array.from(header.querySelectorAll('.js-header-link'));
  const navItemBySection = new Map();
  const visibleSections = new Set();

  const ACTIVE_CLASS = 'is-active';

  let sectionObserver = null;

  navItems.forEach((navItem) => {
    const link = navItem.querySelector('a[href^="#"]');
    const section = link?.hash
      ? document.getElementById(link.hash.slice(1))
      : null;

    if (section) {
      navItemBySection.set(section, navItem);
    }
  });

  const observedSections = Array.from(navItemBySection.keys());

  function setActiveNavItem(activeItem) {
    navItems.forEach((navItem) => {
      const isActive = navItem === activeItem;
      const link = navItem.querySelector('a[href^="#"]');

      navItem.classList.toggle(ACTIVE_CLASS, isActive);

      if (isActive) {
        link?.setAttribute('aria-current', 'location');
      } else {
        link?.removeAttribute('aria-current');
      }
    });
  }

  function getSectionCenter(section) {
    const rect = section.getBoundingClientRect();
    return rect.top + rect.height / 2;
  }

  function getClosestVisibleSection() {
    if (!visibleSections.size) return null;

    const viewportCenter = window.innerHeight / 2;
    let closestSection = null;
    let shortestDistance = Infinity;

    for (const section of visibleSections) {
      const distance = Math.abs(getSectionCenter(section) - viewportCenter);

      if (distance < shortestDistance) {
        closestSection = section;
        shortestDistance = distance;
      }
    }

    return closestSection;
  }

  function getActiveSection() {
    const isPageBottom = Math.ceil(window.innerHeight + window.scrollY) >=
      document.documentElement.scrollHeight - 2;

    if (isPageBottom) {
      return observedSections.at(-1) ?? null;
    }

    return getClosestVisibleSection();
  }

  function syncActiveNavItem() {
    const activeSection = getActiveSection();

    if (activeSection) {
      setActiveNavItem(navItemBySection.get(activeSection));
    }
  }

  function handleNavItemClick(event) {
    setActiveNavItem(event.currentTarget);
  }

  function enableScrollSpy() {
    navItems.forEach((navItem) => {
      navItem.addEventListener('click', handleNavItemClick);
    });

    sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSections.add(entry.target);
        } else {
          visibleSections.delete(entry.target);
        }
      });

      syncActiveNavItem();
    }, {
      root: null,
      rootMargin: '-45% 0px -45% 0px',
      threshold: 0,
    });

    observedSections.forEach(section => sectionObserver.observe(section));
  }

  function disableScrollSpy() {
    navItems.forEach((navItem) => {
      navItem.removeEventListener('click', handleNavItemClick);
    });

    sectionObserver?.disconnect();
    sectionObserver = null;
    visibleSections.clear();
  }

  function updateScrollSpyState({matches}) {
    if (matches) {
      enableScrollSpy();
    } else {
      disableScrollSpy();
    }
  }

  const initialActiveItem = navItems.find(item => item.classList.contains(ACTIVE_CLASS))
    ?? navItems[0]
    ?? null;

  setActiveNavItem(initialActiveItem);
  desktopMediaQuery.addEventListener('change', updateScrollSpyState);
  updateScrollSpyState(desktopMediaQuery);
})();
