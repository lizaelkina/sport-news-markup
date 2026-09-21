document.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-unused-vars,no-undef
  const swiper = new Swiper('.js-swiper-slider',
    {
      direction: 'horizontal',
      slidesPerView: 1,
      grabCursor: true,

      autoplay: {
        delay: 5000,
      },

      navigation: {
        nextEl: '.js-slider-next',
        prevEl: '.js-slider-prev',
      },

      pagination: {
        el: '.swiper-pagination',
        clickable: true,
        renderBullet: function (index, className) {
          return '<span class="' + className + '">' + (index + 1) + '</span>';
        },
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
