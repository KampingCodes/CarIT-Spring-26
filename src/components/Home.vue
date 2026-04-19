<script setup>
import { onBeforeUnmount, onMounted } from 'vue';
import mainPhoto from "../assets/images/Car.svg";
import { themeColor } from "../items";

import { RouterLink } from 'vue-router';

const homeHeading = "Fix Your Car with Ai";
const buttonTry = "Start";
const mobileSummary = "It fixes your car what else do you need to know.";

let previousBodyOverflow = '';
let previousHtmlOverflow = '';

onMounted(() => {
  previousBodyOverflow = document.body.style.overflowY;
  previousHtmlOverflow = document.documentElement.style.overflowY;
  document.body.style.overflowY = 'hidden';
  document.documentElement.style.overflowY = 'hidden';
});

onBeforeUnmount(() => {
  document.body.style.overflowY = previousBodyOverflow;
  document.documentElement.style.overflowY = previousHtmlOverflow;
});
</script>

<template>
  <div class="untree_co-home home-shell" id="home-section">
    <div class="container">
      <div class="row align-items-center home-row">
        <div class="col-12">
          <div class="dots"></div>
          <div class="row align-items-center home-content-row">
            <div
              class="col-lg-7 ml-auto order-lg-2 home-image-column"
              data-aos="fade-right"
              data-aos-delay="400"
            >
              <img :src="mainPhoto" alt="Image" class="img-fluid home-image" />
            </div>
            <div class="col-lg-5 home-copy-column">
              <h1 class="heading" data-aos="fade-up" data-aos-delay="0">
                {{ homeHeading }}
              </h1>
              <div class="excerpt" data-aos="fade-up" data-aos-delay="100">
                <p class="desktop-excerpt">
                  Working on a vehicle yourself can be intimidating and confusing without some level of guidance.
                  Whether you're a trained professional, hobbyist, or just someone trying not to give $1000s to a repair shop,
                  Our Ai-powered diagnostic tool can help you identify and fix issues with your vehicle quickly and easily.
                </p>
                <p class="mobile-excerpt">{{ mobileSummary }}</p>
              </div>
              <p data-aos="fade-up" data-aos-delay="0">
                <RouterLink
                  to="/VehicleInfo"
                  class="btn btn-primary home-cta"
                  style="margin-right: 5px"
                  :style="[
                    { background: themeColor },
                    { borderColor: themeColor },
                    { color: '#ffffff' },
                  ]"
                >
                  {{ buttonTry }}
                </RouterLink>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-shell {
  height: 100svh;
  max-height: 100svh;
  overflow: hidden;
}

.home-shell > .container,
.home-row,
.home-row > .col-12,
.home-content-row {
  height: 100%;
}

.home-row > .col-12 {
  display: flex;
  align-items: center;
}

.home-content-row {
  position: relative;
}

.home-copy-column,
.home-image-column {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.home-copy-column {
  gap: 0.75rem;
}

.home-image-column {
  align-items: center;
}

.home-image {
  width: 100%;
  max-height: min(60vh, 720px);
  object-fit: contain;
}

.heading {
  margin-bottom: 0.75rem;
  font-size: clamp(2.6rem, 5vw, 4.9rem);
  line-height: 0.95;
}

.excerpt {
  margin-bottom: 0.75rem;
}

.excerpt p {
  margin-bottom: 0;
  font-size: clamp(0.92rem, 1.45vw, 1.08rem);
  line-height: 1.55;
}

.mobile-excerpt {
  display: none;
}

.home-cta {
  white-space: nowrap;
}

@media (max-width: 991.98px) {
  .home-shell {
    padding-top: 5.35rem;
  }

  .home-row > .col-12 {
    align-items: flex-start;
  }

  .home-content-row {
    align-content: flex-start;
    justify-content: flex-start;
    text-align: center;
    gap: 0.7rem;
  }

  .home-copy-column {
    order: 2;
    max-width: 460px;
    margin: 0 auto;
    align-items: center;
    gap: 0.4rem;
  }

  .home-image-column {
    order: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.1rem;
  }

  .home-image {
    width: min(86vw, 320px);
    max-height: 33vh;
    margin: 0 auto;
  }

  .heading {
    font-size: clamp(2.4rem, 8.9vw, 3.6rem);
    margin-bottom: 0.25rem;
  }

  .excerpt {
    display: block;
    margin-bottom: 0.25rem;
    max-width: 28rem;
  }

  .desktop-excerpt {
    display: none;
  }

  .mobile-excerpt {
    display: block;
  }

  .excerpt p {
    font-size: clamp(1.04rem, 3.05vw, 1.12rem);
    line-height: 1.42;
  }

  .home-cta {
    min-width: 11.5rem;
    padding: 0.68rem 2.25rem;
    border-radius: 999px;
  }
}

@media (max-width: 575.98px) {
  .home-shell {
    padding-top: 4.85rem;
  }

  .home-content-row {
    gap: 0.55rem;
  }

  .home-copy-column {
    max-width: 340px;
    gap: 0.3rem;
  }

  .home-image-column {
    margin-bottom: 0.1rem;
  }

  .home-image {
    width: min(80vw, 265px);
    max-height: 27vh;
  }

  .heading {
    font-size: clamp(2.5rem, 9.4vw, 3.25rem);
  }

  .excerpt p {
    font-size: 0.98rem;
    line-height: 1.42;
  }

  .home-cta {
    min-width: 10.75rem;
    padding: 0.62rem 2.1rem;
    font-size: 0.84rem;
  }

}

@media (max-width: 399.98px), (max-width: 575.98px) and (max-height: 740px) {
  .home-shell {
    padding-top: 4.45rem;
  }

  .home-content-row {
    gap: 0.35rem;
  }

  .home-copy-column {
    max-width: 300px;
    gap: 0.15rem;
  }

  .home-image-column {
    margin-bottom: 0;
  }

  .home-image {
    width: min(68vw, 215px);
    max-height: 22vh;
  }

  .heading {
    font-size: clamp(2rem, 8.1vw, 2.7rem);
    margin-bottom: 0.35rem;
    line-height: 1;
  }

  .excerpt {
    margin-bottom: 0.2rem;
  }

  .excerpt p {
    font-size: 0.84rem;
    line-height: 1.3;
  }

  .home-cta {
    min-width: 10rem;
    padding: 0.58rem 1.9rem;
    font-size: 0.79rem;
  }
}

@media (max-width: 575.98px) and (max-height: 680px) {
  .home-shell {
    padding-top: 4.2rem;
  }

  .home-content-row {
    gap: 0.2rem;
  }

  .home-image {
    width: min(62vw, 190px);
    max-height: 19vh;
  }

  .heading {
    font-size: clamp(1.8rem, 7.5vw, 2.35rem);
  }

  .excerpt p {
    font-size: 0.78rem;
    line-height: 1.24;
  }

  .home-cta {
    min-width: 9.5rem;
    padding: 0.54rem 1.7rem;
    font-size: 0.75rem;
  }
}

.pricing:hover {
  color: #fff !important;
}
</style>