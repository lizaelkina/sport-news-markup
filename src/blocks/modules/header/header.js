const isDesktop = window.matchMedia('(min-width: 1025px)');

const header = document.querySelector('.js-header');
const anchors = header.querySelectorAll('.js-header-anchor');
const sections = document.querySelectorAll('.js-section');

let observer = null;

const handleAnchorClick = (event) => {
  anchors.forEach(el => el.classList.remove('js-header-anchor-active'));
  event.currentTarget.classList.add('js-header-anchor-active');
};

function handleScreenChange(event) {
  if (event.matches) {
    anchors.forEach(anchor => {
      anchor.addEventListener('click', handleAnchorClick);
    });

    const options = {
      root: null,
      rootMargin: '-92px 0px -60px 0px',
      threshold: 0.5
    };

    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');

          anchors.forEach(anchor => {
            const link = anchor.querySelector('a');
            if (link && link.getAttribute('href') === `#${id}`) {
              anchor.classList.add('js-header-anchor-active');
            } else {
              anchor.classList.remove('js-header-anchor-active');
            }
          });
        }
      });
    }, options);

    sections.forEach(section => observer.observe(section));

  } else {
    anchors.forEach(anchor => {
      anchor.removeEventListener('click', handleAnchorClick);
    });

    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
}

isDesktop.addEventListener('change', handleScreenChange);

handleScreenChange(isDesktop);