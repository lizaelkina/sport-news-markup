document.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-unused-vars,no-undef
  const swiper = new Swiper('.js-swiper-articles',
    {
      direction: 'horizontal',
      slidesPerView: 3,
      grabCursor: true,
      spaceBetween: 30,

      breakpoints: {
        320: {
          slidesPerView: 1.2,
          spaceBetween: 16,
        },
        480: {
          slidesPerView: 1.5,
          spaceBetween: 16,
        },
        640: {
          slidesPerView: 2.2,
          spaceBetween: 16,
        },
        768: {
          slidesPerView: 2.5,
          spaceBetween: 24,
        },
        1025: {
          slidesPerView: 2.5,
          spaceBetween: 30,
        },
        1200: {
          slidesPerView: 3,
          spaceBetween: 30,
        },
      },

      navigation: {
        nextEl: '.js-articles-next',
        prevEl: '.js-articles-prev',
      },

      keyboard: {
        enabled: true,
        onlyInViewport: false,
      },

      a11y: {
        prevSlideMessage: 'Previous slide',
        nextSlideMessage: 'Next slide',
      },
    });
});
