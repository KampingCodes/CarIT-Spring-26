<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, required: true },
  disabled: { type: Boolean, default: false },
  pageSizeOptions: {
    type: Array,
    default: () => [10, 25, 50, 100]
  }
});

const emit = defineEmits(['update:page', 'update:pageSize']);
const isCompactPagination = ref(false);
let compactPaginationMediaQuery;

const totalPages = computed(() => Math.max(1, Math.ceil((props.total || 0) / props.pageSize)));
const currentPage = computed(() => Math.min(Math.max(props.page, 1), totalPages.value));
const startItem = computed(() => (props.total === 0 ? 0 : (currentPage.value - 1) * props.pageSize + 1));
const endItem = computed(() => Math.min(currentPage.value * props.pageSize, props.total));

const visiblePages = computed(() => {
  const pages = [];
  const totalPageCount = totalPages.value;
  const start = Math.max(1, currentPage.value - 2);
  const end = Math.min(totalPageCount, currentPage.value + 2);

  if (start > 1) {
    pages.push(1);
    if (start > 2) {
      pages.push('left-ellipsis');
    }
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPageCount) {
    if (end < totalPageCount - 1) {
      pages.push('right-ellipsis');
    }
    pages.push(totalPageCount);
  }

  return pages;
});

function goToPage(page) {
  const nextPage = Math.min(Math.max(Number(page) || 1, 1), totalPages.value);
  if (nextPage !== props.page) {
    emit('update:page', nextPage);
  }
}

function updatePageSize(event) {
  emit('update:pageSize', Number(event.target.value));
}

function syncCompactPagination(event) {
  isCompactPagination.value = Boolean(event?.matches);
}

onMounted(() => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }

  compactPaginationMediaQuery = window.matchMedia('(max-width: 767px)');
  syncCompactPagination(compactPaginationMediaQuery);
  compactPaginationMediaQuery.addEventListener('change', syncCompactPagination);
});

onBeforeUnmount(() => {
  compactPaginationMediaQuery?.removeEventListener('change', syncCompactPagination);
});
</script>

<template>
  <div class="pagination-controls" :class="{ disabled }">
    <div class="pagination-summary">
      <span class="pagination-count">Showing {{ startItem }}-{{ endItem }} of {{ total }}</span>
      <label class="page-size-selector">
        <span>Rows:</span>
        <select :value="pageSize" :disabled="disabled" @change="updatePageSize">
          <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
        </select>
      </label>
    </div>

    <div class="pagination-actions">
      <div class="page-nav-group">
        <button class="page-button page-nav-button" aria-label="Go to first page" :disabled="disabled || currentPage <= 1" @click="goToPage(1)">«</button>
        <button class="page-button page-nav-button" aria-label="Go to previous page" :disabled="disabled || currentPage <= 1" @click="goToPage(currentPage - 1)">‹</button>
      </div>

      <div v-if="isCompactPagination" class="page-status" aria-live="polite">
        Page {{ currentPage }} of {{ totalPages }}
      </div>
      <div v-else class="page-number-group" aria-label="Pagination pages">
        <template v-for="item in visiblePages" :key="item">
          <span v-if="typeof item !== 'number'" class="page-ellipsis">…</span>
          <button
            v-else
            class="page-button page-number"
            :class="{ active: item === currentPage }"
            :disabled="disabled"
            @click="goToPage(item)"
          >
            {{ item }}
          </button>
        </template>
      </div>

      <div class="page-nav-group">
        <button class="page-button page-nav-button" aria-label="Go to next page" :disabled="disabled || currentPage >= totalPages" @click="goToPage(currentPage + 1)">›</button>
        <button class="page-button page-nav-button" aria-label="Go to last page" :disabled="disabled || currentPage >= totalPages" @click="goToPage(totalPages)">»</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #edf2fb;
  border-top-color: var(--color-border-subtle, #edf2fb);
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.pagination-controls.disabled {
  opacity: 0.7;
}

.pagination-summary,
.pagination-actions,
.page-nav-group,
.page-number-group,
.page-size-selector {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  min-width: 0;
}

.pagination-summary {
  color: var(--color-text-secondary, #5b6475);
  font-size: 0.95rem;
  row-gap: 0.5rem;
  flex: 1 1 18rem;
}

.pagination-count {
  display: inline-flex;
  align-items: center;
}

.page-size-selector {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  white-space: nowrap;
  margin: 0;
  max-width: 100%;
}

.page-size-selector span {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.pagination-actions {
  justify-content: flex-end;
  flex: 0 0 auto;
  gap: 0.45rem;
  max-width: 100%;
  min-width: 0;
}

.page-nav-group {
  gap: 0.45rem;
  flex-wrap: nowrap;
}

.page-number-group {
  justify-content: center;
  flex: 0 0 auto;
  gap: 0.45rem;
  max-width: 100%;
  min-width: 0;
}

.page-status {
  color: var(--color-text-secondary, #5b6475);
  font-size: 0.92rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  min-width: 0;
}

.page-button,
.page-size-selector select {
  border: 1px solid var(--color-border, #d5dce8);
  background: var(--color-surface, #fff);
  color: var(--color-text-primary, #274472);
  border-radius: 999px;
  padding: 0.45rem 0.85rem;
  font-weight: 600;
}

.page-button {
  min-width: 2.75rem;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.page-nav-button {
  font-size: 1rem;
  line-height: 1;
}

.page-number {
  min-width: 2.5rem;
}

.page-button:hover:not(:disabled),
.page-size-selector select:hover:not(:disabled) {
  background: var(--color-surface-raised, #f0f2f6);
}

.page-button:focus-visible,
.page-size-selector select:focus-visible {
  outline: 2px solid var(--color-brand, #407bff);
  outline-offset: 2px;
}

.page-button.active {
  background: var(--color-brand, #407bff);
  color: #fff;
  border-color: var(--color-brand, #407bff);
}

.page-button:disabled {
  opacity: 0.55;
}

.page-ellipsis {
  color: var(--color-text-muted, #7c8aa5);
  font-weight: 700;
}

@media (max-width: 991px) {
  .pagination-controls {
    align-items: stretch;
  }

  .pagination-summary,
  .pagination-actions {
    width: 100%;
    justify-content: space-between;
    align-items: center;
  }

  .page-number-group {
    justify-content: center;
    flex-wrap: wrap;
  }
}

@media (max-width: 767px) {
  .pagination-controls {
    gap: 0.85rem;
  }

  .pagination-summary {
    width: 100%;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  .pagination-count,
  .page-size-selector {
    width: auto;
    justify-content: flex-start;
  }

  .pagination-actions {
    width: 100%;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }

  .page-number-group {
    width: auto;
    justify-content: center;
    flex-wrap: wrap;
  }

  .page-button {
    min-height: 2.35rem;
    min-width: 2.35rem;
    padding: 0.4rem 0.7rem;
  }

  .page-number-group {
    gap: 0.35rem;
  }

  .page-size-selector select {
    min-width: 3.75rem;
  }
}

@media (max-width: 480px) {
  .pagination-controls {
    margin-top: 1rem;
    padding-top: 0.85rem;
  }

  .pagination-summary {
    font-size: 0.9rem;
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: nowrap;
    gap: 0.75rem;
  }

  .pagination-count,
  .page-size-selector {
    width: auto;
    justify-content: flex-start;
  }

  .pagination-count {
    flex: 1 1 auto;
    min-width: 0;
  }

  .page-size-selector {
    flex: 0 0 auto;
  }

  .pagination-actions {
    justify-content: space-between;
    gap: 0.4rem;
  }

  .page-nav-group {
    gap: 0.35rem;
  }

  .page-status {
    flex: 1 1 auto;
    text-align: center;
    font-size: 0.88rem;
    white-space: nowrap;
  }

  .page-nav-button {
    min-width: 2.1rem;
    padding: 0.38rem 0.55rem;
  }
}
</style>