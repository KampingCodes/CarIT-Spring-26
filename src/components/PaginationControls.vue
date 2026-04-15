<script setup>
import { computed } from 'vue';

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
</script>

<template>
  <div class="pagination-controls" :class="{ disabled }">
    <div class="pagination-summary">
      <span class="pagination-count">Showing {{ startItem }}-{{ endItem }} of {{ total }}</span>

    </div>

    <div class="pagination-actions">
      <button class="page-button" :disabled="disabled || currentPage <= 1" @click="goToPage(1)"><<</button>
      <button class="page-button" :disabled="disabled || currentPage <= 1" @click="goToPage(currentPage - 1)"><</button>

      <div class="page-number-group">
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

      <button class="page-button" :disabled="disabled || currentPage >= totalPages" @click="goToPage(currentPage + 1)">></button>
      <button class="page-button" :disabled="disabled || currentPage >= totalPages" @click="goToPage(totalPages)">>></button>
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
}

.page-number-group {
  justify-content: center;
  flex: 0 0 auto;
  gap: 0.45rem;
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
    justify-content: flex-end;
  }
}

@media (max-width: 640px) {
  .pagination-summary,
  .pagination-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .pagination-count,
  .page-size-selector {
    width: 100%;
    justify-content: space-between;
  }

  .pagination-actions {
    gap: 0.75rem;
  }

  .page-number-group {
    justify-content: center;
  }

  .page-button {
    min-height: 2.5rem;
  }
}
</style>