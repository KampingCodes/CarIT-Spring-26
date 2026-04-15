<script setup>
import { RouterLink } from 'vue-router';
import { themeColor } from '../items';

const steps = [
  {
    num: '01',
    title: 'Select Your Vehicle',
    desc: 'Choose your year, make, model, and trim. CARit instantly checks for any active NHTSA safety recalls on your vehicle.',
    route: '/VehicleInfo',
    color: 'color-1',
  },
  {
    num: '02',
    title: 'Describe the Problem',
    desc: 'Type out what you\'re experiencing — strange noises, warning lights, or performance issues. The more detail, the better.',
    route: null,
    color: 'color-2',
  },
  {
    num: '03',
    title: 'Answer AI Questions',
    desc: 'Our AI asks targeted follow-up questions to narrow down the root cause, just like a trained mechanic would.',
    route: null,
    color: 'color-3',
  },
  {
    num: '04',
    title: 'Get Your Diagnostic Flowchart',
    desc: 'Receive an interactive, step-by-step decision tree tailored to your vehicle and symptoms. Follow it to diagnose and fix the issue yourself.',
    route: null,
    color: 'color-4',
  },
];

const features = [
  {
    title: 'AI-Powered Diagnostics',
    desc: 'Google Gemini AI analyzes your symptoms and vehicle data to produce accurate, context-aware diagnostic guidance.',
    color: 'color-1',
    icon: 'brain',
  },
  {
    title: 'NHTSA Recall Check',
    desc: 'Automatically cross-references your vehicle against the official NHTSA database and flags any open safety recalls.',
    color: 'color-2',
    icon: 'shield',
  },
  {
    title: 'Interactive Flowcharts',
    desc: 'Tap any node in the flowchart to get detailed descriptions, repair tips, and additional context right in the sidebar.',
    color: 'color-3',
    icon: 'flowchart',
  },
  {
    title: 'My Garage',
    desc: 'Save all your vehicles in one place. Switch between them instantly when starting a new diagnostic session.',
    color: 'color-4',
    icon: 'garage',
  },
  {
    title: 'Saved Flowcharts',
    desc: 'Every diagnosis you run can be saved and revisited. Pick up where you left off or share results with your mechanic.',
    color: 'color-1',
    icon: 'save',
  },
  {
    title: 'Easy Sign-In',
    desc: 'Sign in with Google — no passwords to remember. Your garage and flowcharts are always synced and ready.',
    color: 'color-2',
    icon: 'login',
  },
];
</script>

<template>
  <!-- ── Hero ── -->
  <div class="features-hero">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-8 text-center" data-aos="fade-up" data-aos-delay="0">
          <div class="features-badge" :style="{ color: themeColor }">How It Works</div>
          <h1 class="features-hero-title">Stop Guessing.<br>Start Fixing.</h1>
          <p class="features-hero-sub">
            CARit combines AI-powered diagnostics with real-world repair guidance —
            so whether you're a seasoned mechanic or a first-time wrench-turner,
            you'll know exactly what to do next.
          </p>
          <RouterLink to="/VehicleInfo" class="btn btn-primary" :style="{ background: themeColor, borderColor: themeColor, color: '#fff' }">
            Try It Now
          </RouterLink>
        </div>
      </div>
    </div>
  </div>

  <!-- ── How It Works Steps ── -->
  <div class="untree_co-section steps-section">
    <div class="container">
      <div class="row mb-5">
        <div class="col-12 text-center" data-aos="fade-up" data-aos-delay="0">
          <h2 class="heading">The Process</h2>
          <p>Four steps from symptom to solution</p>
        </div>
      </div>

      <div class="steps-track">
        <div
          v-for="(step, i) in steps"
          :key="step.num"
          class="step-card"
          :data-aos="'fade-up'"
          :data-aos-delay="i * 100"
        >
          <div class="step-num" :style="{ color: themeColor, borderColor: themeColor }">{{ step.num }}</div>
          <div class="step-connector" v-if="i < steps.length - 1" :style="{ background: themeColor }"></div>
          <h4 class="step-title">{{ step.title }}</h4>
          <p class="step-desc">{{ step.desc }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Capabilities ── -->
  <div class="untree_co-section capabilities-section">
    <div class="container">
      <div class="row mb-5">
        <div class="col-12 text-center" data-aos="fade-up" data-aos-delay="0">
          <h2 class="heading">What CARit Can Do</h2>
          <p>Everything you need to diagnose, track, and fix your vehicles</p>
        </div>
      </div>

      <div class="row">
        <div
          v-for="(feat, i) in features"
          :key="feat.title"
          class="col-lg-4 col-md-6 mb-4"
          :data-aos="'fade-up'"
          :data-aos-delay="(i % 3) * 100"
        >
          <div class="feat-card">
            <div class="feat-icon-wrap" :class="feat.color">
              <!-- Brain / AI icon -->
              <svg v-if="feat.icon === 'brain'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.5 2a2.5 2.5 0 0 1 5 0"/>
                <path d="M9.5 2C7 2 5 4 5 6.5c0 1-.3 1.9-.8 2.6A3.5 3.5 0 0 0 5 15c0 .9.2 1.7.6 2.4A3 3 0 0 0 8 21h8a3 3 0 0 0 2.4-1.6c.4-.7.6-1.5.6-2.4a3.5 3.5 0 0 0-.8-6.9c-.5-.7-.8-1.6-.8-2.6C17.5 4 15.5 2 13 2"/>
                <line x1="12" y1="9" x2="12" y2="14"/>
                <line x1="9.5" y1="11.5" x2="14.5" y2="11.5"/>
              </svg>
              <!-- Shield / Recall icon -->
              <svg v-else-if="feat.icon === 'shield'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
              <!-- Flowchart icon -->
              <svg v-else-if="feat.icon === 'flowchart'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="6" height="4" rx="1"/>
                <rect x="15" y="3" width="6" height="4" rx="1"/>
                <rect x="9" y="17" width="6" height="4" rx="1"/>
                <line x1="6" y1="7" x2="6" y2="12"/>
                <line x1="18" y1="7" x2="18" y2="12"/>
                <line x1="6" y1="12" x2="18" y2="12"/>
                <line x1="12" y1="12" x2="12" y2="17"/>
              </svg>
              <!-- Garage / Car icon -->
              <svg v-else-if="feat.icon === 'garage'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
                <circle cx="7.5" cy="17.5" r="2.5"/>
                <circle cx="17.5" cy="17.5" r="2.5"/>
              </svg>
              <!-- Save icon -->
              <svg v-else-if="feat.icon === 'save'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              <!-- Login icon -->
              <svg v-else-if="feat.icon === 'login'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10 17 15 12 10 7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </div>
            <h4 class="feat-title">{{ feat.title }}</h4>
            <p class="feat-desc">{{ feat.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── CTA ── -->
  <div class="features-cta-section">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-lg-7 text-center" data-aos="fade-up" data-aos-delay="0">
          <h2 class="features-cta-title">Ready to diagnose your car?</h2>
          <p class="features-cta-sub">
            It takes less than a minute to get started. Select your vehicle and let the AI do the heavy lifting.
          </p>
          <RouterLink
            to="/VehicleInfo"
            class="btn btn-primary"
            :style="{ background: themeColor, borderColor: themeColor, color: '#fff' }"
          >
            Start Diagnosis
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Hero ── */
.features-hero {
  background: var(--color-bg-subtle);
  padding: 100px 0 80px;
  border-bottom: 1px solid var(--color-border);
}

.features-badge {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 16px;
}

.features-hero-title {
  font-size: clamp(2rem, 5vw, 3.2rem);
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1.15;
  margin-bottom: 20px;
}

.features-hero-sub {
  font-size: 1.05rem;
  color: var(--color-text-muted);
  max-width: 560px;
  margin: 0 auto 32px;
}

/* ── Steps ── */
.steps-section {
  background: var(--color-bg);
}

.steps-track {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
  position: relative;
}

.step-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 32px 24px;
  position: relative;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.step-card:hover {
  box-shadow: 0 8px 28px var(--color-card-shadow);
  transform: translateY(-3px);
}

.step-num {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  border: 2px solid;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  font-variant-numeric: tabular-nums;
}

.step-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}

.step-desc {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.6;
}

/* Arrow connector between steps (hidden on small screens) */
.step-connector {
  display: none;
}

@media (min-width: 992px) {
  .steps-track {
    grid-template-columns: repeat(4, 1fr);
  }

  .step-connector {
    display: block;
    position: absolute;
    top: 60px;
    right: -14px;
    width: 24px;
    height: 2px;
    opacity: 0.35;
    z-index: 1;
  }
}

/* ── Feature Cards ── */
.capabilities-section {
  background: var(--color-bg-subtle);
}

.feat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 28px 24px;
  height: 100%;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.feat-card:hover {
  box-shadow: 0 8px 28px var(--color-card-shadow);
  transform: translateY(-3px);
}

.feat-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}

/* Reuse the existing color-N palette from the framework */
.feat-icon-wrap.color-1 { background: rgba(64, 123, 255, 0.12); color: #407BFF; }
.feat-icon-wrap.color-2 { background: rgba(255, 87, 119, 0.12); color: #ff5777; }
.feat-icon-wrap.color-3 { background: rgba(255, 173, 51, 0.12); color: #ffad33; }
.feat-icon-wrap.color-4 { background: rgba(52, 199, 89,  0.12); color: #34c759; }

.feat-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}

.feat-desc {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.6;
}

/* ── CTA ── */
.features-cta-section {
  background: var(--color-bg);
  padding: 80px 0 100px;
  border-top: 1px solid var(--color-border);
}

.features-cta-title {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 800;
  color: var(--color-text-primary);
  margin-bottom: 16px;
}

.features-cta-sub {
  font-size: 1rem;
  color: var(--color-text-muted);
  max-width: 480px;
  margin: 0 auto 28px;
}
</style>
