<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Search or type...' },
  disabled: { type: Boolean, default: false },
  numberOnly: { type: Boolean, default: false },
  maxLength: { type: Number, default: null },
  capitalize: { type: Boolean, default: false },
  validator: { type: Function, default: null },
  invalidMessage: { type: String, default: 'Invalid' },
});

const emit = defineEmits(['update:modelValue']);

const search = ref(String(props.modelValue ?? ''));
const isOpen = ref(false);
const highlightIndex = ref(-1);
const inputRef = ref(null);
const listRef = ref(null);
const isInternalUpdate = ref(false);
const touched = ref(false);

const isInvalid = computed(() => {
  if (!touched.value || search.value.length === 0) return false;
  if (props.validator) {
    return !props.validator(search.value);
  }
  if (props.numberOnly && props.maxLength) {
    return search.value.length < props.maxLength;
  }
  return false;
});

// Sync external value changes into the search box (but avoid loops)
watch(() => props.modelValue, (val) => {
  if (!isInternalUpdate.value) {
    search.value = String(val ?? '');
  }
  isInternalUpdate.value = false;
});

const filtered = computed(() => {
  const q = String(search.value).toLowerCase().trim();
  if (!q) return props.options.map(String);
  return props.options.map(String).filter(opt => opt.toLowerCase().includes(q));
});

const showDropdown = computed(() => isOpen.value && filtered.value.length > 0);

function onInput(e) {
  let newValue = e.target.value;

  if (props.numberOnly) {
    newValue = newValue.replace(/\D/g, '');
    if (props.maxLength !== null) {
      newValue = newValue.slice(0, props.maxLength);
    }
    // Force-sync DOM so stripped characters don't appear
    e.target.value = newValue;
  } else if (props.capitalize) {
    newValue = newValue.replace(/\b\w/g, c => c.toUpperCase());
    e.target.value = newValue;
  }

  search.value = newValue;
  isInternalUpdate.value = true;
  emit('update:modelValue', newValue);
  if (!isOpen.value) {
    isOpen.value = true;
  }
  highlightIndex.value = -1;
}

function selectOption(opt) {
  search.value = opt;
  isInternalUpdate.value = true;
  emit('update:modelValue', opt);
  isOpen.value = false;
  highlightIndex.value = -1;
  touched.value = false;
}

function onFocus() {
  touched.value = false;
  isOpen.value = true;
  highlightIndex.value = -1;
}

function onBlur() {
  touched.value = true;
  // Delay so click on option registers before close
  setTimeout(() => { 
    isOpen.value = false;
    highlightIndex.value = -1;
    // Snap to exact DB string on case-insensitive match (e.g. "Cr-v" → "CR-V", "Se" → "SE")
    if (props.capitalize && search.value) {
      const match = props.options.find(opt => String(opt).toLowerCase() === search.value.toLowerCase());
      if (match) {
        search.value = String(match);
        isInternalUpdate.value = true;
        emit('update:modelValue', String(match));
      }
    }
  }, 200);
}

function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!isOpen.value) {
      isOpen.value = true;
    }
    highlightIndex.value = Math.min(highlightIndex.value + 1, filtered.value.length - 1);
    scrollToHighlighted();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightIndex.value = Math.max(highlightIndex.value - 1, -1);
    scrollToHighlighted();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (isOpen.value && highlightIndex.value >= 0 && filtered.value[highlightIndex.value]) {
      selectOption(filtered.value[highlightIndex.value]);
    }
  } else if (e.key === 'Escape') {
    isOpen.value = false;
    highlightIndex.value = -1;
  }
}

function scrollToHighlighted() {
  nextTick(() => {
    const list = listRef.value;
    if (!list || highlightIndex.value < 0) return;
    const item = list.children[highlightIndex.value];
    if (item) item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}
</script>

<template>
  <div class="searchable-select">
    <input
      ref="inputRef"
      :value="search"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeydown"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="['form-control', { 'ss-invalid': isInvalid }]"
      autocomplete="off"
    />
    <small v-if="isInvalid && invalidMessage" class="ss-invalid-msg">{{ invalidMessage }}</small>
    <ul v-if="showDropdown" ref="listRef" class="ss-dropdown">
      <li
        v-for="(opt, i) in filtered"
        :key="opt"
        :class="{ 'ss-highlighted': i === highlightIndex }"
        @mousedown.prevent="selectOption(opt)"
      >
        {{ opt }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.searchable-select {
  position: relative;
}
.ss-dropdown {
  position: absolute;
  z-index: 1060;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ced4da;
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  list-style: none;
  margin: 0;
  padding: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.ss-dropdown li {
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-size: 0.95rem;
}
.ss-dropdown li:hover,
.ss-dropdown li.ss-highlighted {
  background: #007bff;
  color: #fff;
}
.ss-invalid {
  border-color: #dc3545 !important;
  box-shadow: none !important;
}
.ss-invalid-msg {
  position: absolute;
  top: 100%;
  right: 6px;
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: #dc3545;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1059;
}
</style>
