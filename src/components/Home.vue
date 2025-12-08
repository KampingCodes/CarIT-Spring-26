<script setup>
import mainPhoto from "../assets/images/Car.svg";
import { themeColor } from "../items";

import { RouterLink } from 'vue-router';

const homeHeading = "Fix Your Car with Ai";
const buttonTry = "Try it Out";
</script>

<template>
  <div class="untree_co-home" id="home-section">
    <div class="container">
      <div class="row align-items-start">
        <div class="col-12">
          <div class="dots"></div>
          <div class="row align-items-center">
            <div
              class="col-lg-7 ml-auto order-lg-2"
              data-aos="fade-right"
              data-aos-delay="400"
            >
              <img :src="mainPhoto" alt="Image" class="img-fluid" />
            </div>
            <div class="col-lg-5">
              <h1 class="heading" data-aos="fade-up" data-aos-delay="0">
                {{ homeHeading }}
              </h1>
              <div class="excerpt" data-aos="fade-up" data-aos-delay="100">
                <p>
                  Working on a vehicle yourself can be intimidating and confusing without some level of guidance.
                  Whether you're a trained professional, hobbyist, or just someone trying not to give $1000s to a repair shop,
                  Our Ai-powered diagnostic tool can help you identify and fix issues with your vehicle quickly and easily.
                </p>
              </div>
              <p data-aos="fade-up" data-aos-delay="0">
                <RouterLink
                  to="/service1"
                  class="btn btn-primary"
                  style="margin-right: 5px"
                  :style="[
                    { background: themeColor },
                    { borderColor: themeColor },
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
.pricing:hover {
  color: #fff !important;
}
</style>