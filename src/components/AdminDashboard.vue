<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import ConfirmDialog from './ConfirmDialog.vue';
import PaginationControls from './PaginationControls.vue';
import { authState } from '../auth.js';
import { useThemeStore } from '../stores/theme';
import {
  deleteAdminFlowchart,
  deleteAdminUser,
  deleteAdminVehicle,
  getAdminAccounts,
  getAdminAuditLogs,
  getAdminFlowcharts,
  getAdminUsers,
  getAdminVehicles,
  grantAdminAccess,
  restoreAdminAuditRecord,
  revokeAdminAccess,
  updateAdminUser,
  updateAdminVehicle
} from '../apis.js';

const themeStore = useThemeStore();
const confirmDialog = ref(null);
const activeTab = ref('admins');
const alert = reactive({ type: '', message: '' });
const loading = reactive({
  admins: false,
  users: false,
  vehicles: false,
  flowcharts: false,
  audit: false,
  save: false
});

const admins = reactive({ items: [], total: 0, page: 1, pageSize: 10, search: '' });
const users = reactive({ items: [], total: 0, page: 1, pageSize: 12, search: '' });
const vehicles = reactive({ items: [], total: 0, page: 1, pageSize: 12, search: '' });
const flowcharts = reactive({ items: [], total: 0, page: 1, pageSize: 12, search: '' });
const auditLogs = reactive({ items: [], total: 0, page: 1, pageSize: 10, search: '' });

const grantForm = reactive({ targetUserId: '', accessLevel: 'admin' });
const editing = reactive({ section: '', key: '', draft: null });
const selectedVehicleIds = ref([]);
const selectedFlowchartKeys = ref([]);
const SEARCH_DEBOUNCE_MS = 350;

let adminSearchTimeout = null;
let userSearchTimeout = null;
let vehicleSearchTimeout = null;
let flowchartSearchTimeout = null;
let auditSearchTimeout = null;

const isSuperAdmin = computed(() => authState.adminAccessLevel === 'superadmin');

const summaryCards = computed(() => {
  const cards = [
    { label: 'Users', value: users.total },
    { label: 'Vehicles', value: vehicles.total },
    { label: 'Flowcharts', value: flowcharts.total }
  ];

  if (isSuperAdmin.value) {
    cards.unshift({ label: 'Admin Accounts', value: admins.total });
  }

  return cards;
});

function showAlert(type, message) {
  alert.type = type;
  alert.message = message;
}

function clearAlert() {
  alert.type = '';
  alert.message = '';
}

function isEditing(section, key) {
  return editing.section === section && editing.key === key;
}

function resetEditing() {
  editing.section = '';
  editing.key = '';
  editing.draft = null;
}

function userDisplay(record) {
  return record.username || record.email || record.userId;
}

async function loadAdmins() {
  loading.admins = true;
  try {
    const response = await getAdminAccounts({ search: admins.search, page: admins.page, pageSize: admins.pageSize });
    admins.items = response.items || [];
    admins.total = response.total || 0;
    await normalizePageIfEmpty(admins, loadAdmins);
  } finally {
    loading.admins = false;
  }
}

async function loadUsers() {
  loading.users = true;
  try {
    const response = await getAdminUsers({ search: users.search, page: users.page, pageSize: users.pageSize });
    users.items = response.items || [];
    users.total = response.total || 0;
    await normalizePageIfEmpty(users, loadUsers);
  } finally {
    loading.users = false;
  }
}

async function loadVehicles() {
  loading.vehicles = true;
  try {
    const response = await getAdminVehicles({ search: vehicles.search, page: vehicles.page, pageSize: vehicles.pageSize });
    vehicles.items = response.items || [];
    vehicles.total = response.total || 0;
    selectedVehicleIds.value = [];
    await normalizePageIfEmpty(vehicles, loadVehicles);
  } finally {
    loading.vehicles = false;
  }
}

async function loadFlowcharts() {
  loading.flowcharts = true;
  try {
    const response = await getAdminFlowcharts({ search: flowcharts.search, page: flowcharts.page, pageSize: flowcharts.pageSize });
    flowcharts.items = response.items || [];
    flowcharts.total = response.total || 0;
    selectedFlowchartKeys.value = [];
    await normalizePageIfEmpty(flowcharts, loadFlowcharts);
  } finally {
    loading.flowcharts = false;
  }
}

async function loadAuditLogs() {
  loading.audit = true;
  try {
    const response = await getAdminAuditLogs({ search: auditLogs.search, page: auditLogs.page, pageSize: auditLogs.pageSize });
    auditLogs.items = response.items || [];
    auditLogs.total = response.total || 0;
    await normalizePageIfEmpty(auditLogs, loadAuditLogs);
  } finally {
    loading.audit = false;
  }
}

async function loadDashboardData() {
  if (!authState.isAuthenticated || !authState.isAdmin) {
    return;
  }

  clearAlert();
  try {
    const tasks = [loadUsers(), loadVehicles(), loadFlowcharts(), loadAuditLogs()];
    if (isSuperAdmin.value) {
      tasks.unshift(loadAdmins());
    } else {
      admins.items = [];
      admins.total = 0;
      if (activeTab.value === 'admins') {
        activeTab.value = 'users';
      }
    }
    await Promise.all(tasks);
  } catch (err) {
    showAlert('danger', err?.message || 'Unable to load the admin dashboard.');
  }
}

function prepareGrantFromUser(user) {
  if (!isSuperAdmin.value) {
    showAlert('danger', 'Only superadmins can manage admin access.');
    return;
  }
  grantForm.targetUserId = user.userId;
  grantForm.accessLevel = 'admin';
  activeTab.value = 'admins';
}

function updatePage(state, loader, page) {
  state.page = page;
  loader();
}

function updatePageSize(state, loader, pageSize) {
  state.pageSize = pageSize;
  state.page = 1;
  loader();
}

async function normalizePageIfEmpty(state, loader) {
  if (state.items.length === 0 && state.total > 0 && state.page > 1) {
    state.page -= 1;
    await loader();
  }
}

function debounceSearch(state, loader, timeoutRefName) {
  if (state.page !== 1) {
    state.page = 1;
  }

  clearTimeoutByName(timeoutRefName);
  setTimeoutByName(timeoutRefName, setTimeout(() => {
    loader();
  }, SEARCH_DEBOUNCE_MS));
}

function clearTimeoutByName(name) {
  const timeoutId = getTimeoutByName(name);
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
}

function setTimeoutByName(name, timeoutId) {
  if (name === 'admins') adminSearchTimeout = timeoutId;
  if (name === 'users') userSearchTimeout = timeoutId;
  if (name === 'vehicles') vehicleSearchTimeout = timeoutId;
  if (name === 'flowcharts') flowchartSearchTimeout = timeoutId;
  if (name === 'audit') auditSearchTimeout = timeoutId;
}

function getTimeoutByName(name) {
  if (name === 'admins') return adminSearchTimeout;
  if (name === 'users') return userSearchTimeout;
  if (name === 'vehicles') return vehicleSearchTimeout;
  if (name === 'flowcharts') return flowchartSearchTimeout;
  if (name === 'audit') return auditSearchTimeout;
  return null;
}

async function submitGrant() {
  if (!isSuperAdmin.value) {
    showAlert('danger', 'Only superadmins can grant admin access.');
    return;
  }
  if (!grantForm.targetUserId) {
    showAlert('danger', 'Select or enter a valid user id before granting admin access.');
    return;
  }

  loading.save = true;
  try {
    await grantAdminAccess(grantForm.targetUserId, grantForm.accessLevel);
    showAlert('success', 'Admin access granted successfully.');
    grantForm.targetUserId = '';
    grantForm.accessLevel = 'admin';
    await Promise.all([loadAdmins(), loadUsers(), loadAuditLogs()]);
  } catch (err) {
    showAlert('danger', err?.message || 'Unable to grant admin access.');
  } finally {
    loading.save = false;
  }
}

async function revokeAdmin(userId) {
  if (!isSuperAdmin.value) {
    showAlert('danger', 'Only superadmins can revoke admin access.');
    return;
  }
  const confirmed = await confirmDialog.value.show(
    'Revoke admin access for this account? The user loses elevated privileges on their next request.',
    { title: 'Revoke Admin Access', confirmLabel: 'Revoke Access' }
  );

  if (!confirmed) {
    return;
  }

  loading.save = true;
  try {
    await revokeAdminAccess(userId);
    showAlert('success', 'Admin access revoked successfully.');
    await Promise.all([loadAdmins(), loadUsers(), loadAuditLogs()]);
  } catch (err) {
    showAlert('danger', err?.message || 'Unable to revoke admin access.');
  } finally {
    loading.save = false;
  }
}

function startEditUser(user) {
  editing.section = 'users';
  editing.key = user.userId;
  editing.draft = {
    name: user.username || ''
  };
}

function startEditVehicle(vehicle) {
  editing.section = 'vehicles';
  editing.key = vehicle.carId;
  editing.draft = {
    year: String(vehicle.year || ''),
    make: vehicle.make || '',
    model: vehicle.model || '',
    trim: vehicle.trim || ''
  };
}

async function saveEdit(section, record) {
  loading.save = true;
  try {
    if (section === 'users') {
      await updateAdminUser(record.userId, editing.draft);
      await Promise.all([loadUsers(), loadAuditLogs()]);
    }

    if (section === 'vehicles') {
      await updateAdminVehicle(record.carId, {
        year: editing.draft.year,
        make: editing.draft.make,
        model: editing.draft.model,
        trim: editing.draft.trim
      });
      await Promise.all([loadVehicles(), loadAuditLogs()]);
    }

    showAlert('success', 'Record updated successfully.');
    resetEditing();
  } catch (err) {
    showAlert('danger', err?.message || 'Unable to save your changes.');
  } finally {
    loading.save = false;
  }
}

async function deleteRecord(section, record) {
  const config = {
    users: {
      title: 'Delete User Record',
      message: `Delete the stored application data for ${userDisplay(record)}? This does not remove the Auth0 identity.`,
      action: () => deleteAdminUser(record.userId),
      reload: () => Promise.all([loadUsers(), loadAdmins(), loadAuditLogs()])
    },
    vehicles: {
      title: 'Delete Vehicle Record',
      message: `Delete ${record.year} ${record.make} ${record.model} from the vehicle database?`,
      action: () => deleteAdminVehicle(record.carId),
      reload: () => Promise.all([loadVehicles(), loadAuditLogs()])
    },
    flowcharts: {
      title: 'Delete Flowchart Record',
      message: `Delete this saved flowchart for ${record.ownerName || record.ownerUserId}?`,
      action: () => deleteAdminFlowchart(record.ownerUserId, record.flowchartId),
      reload: () => Promise.all([loadFlowcharts(), loadAuditLogs()])
    }
  }[section];

  const confirmed = await confirmDialog.value.show(config.message, {
    title: config.title,
    confirmLabel: 'Delete Record'
  });
  if (!confirmed) {
    return;
  }

  loading.save = true;
  try {
    await config.action();
    await config.reload();
    showAlert('success', 'Record deleted successfully.');
    resetEditing();
  } catch (err) {
    showAlert('danger', err?.message || 'Unable to delete the selected record.');
  } finally {
    loading.save = false;
  }
}

function canRestoreAuditEntry(entry) {
  return entry?.action === 'record.delete'
    && !entry?.restoredAt
    && Boolean(entry?.metadata)
    && (isSuperAdmin.value
      ? ['user', 'vehicle', 'flowchart'].includes(entry?.targetType)
      : ['vehicle', 'flowchart'].includes(entry?.targetType));
}

async function reloadAfterAuditRestore(targetType) {
  const tasks = [loadAuditLogs()];

  if (targetType === 'user') {
    tasks.push(loadUsers(), loadAdmins());
  }

  if (targetType === 'vehicle') {
    tasks.push(loadVehicles());
  }

  if (targetType === 'flowchart') {
    tasks.push(loadFlowcharts());
  }

  await Promise.all(tasks);
}

async function restoreAuditEntry(entry) {
  if (!canRestoreAuditEntry(entry)) {
    return;
  }

  const confirmed = await confirmDialog.value.show(
    `Restore the deleted ${entry.targetType} record for ${entry.targetLabel || entry.targetId}?`,
    { title: 'Restore Deleted Data', confirmLabel: 'Restore Record' }
  );

  if (!confirmed) {
    return;
  }

  loading.save = true;
  try {
    await restoreAdminAuditRecord(entry._id);
    await reloadAfterAuditRestore(entry.targetType);
    showAlert('success', 'Deleted record restored successfully.');
  } catch (err) {
    showAlert('danger', err?.message || 'Unable to restore the deleted record.');
  } finally {
    loading.save = false;
  }
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function vehicleLabel(vehicle = {}) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ');
}

function getFlowchartSelectionKey(record) {
  return `${record.ownerUserId}:${record.flowchartId}`;
}

function isVehicleSelected(carId) {
  return selectedVehicleIds.value.includes(carId);
}

function isFlowchartSelected(record) {
  return selectedFlowchartKeys.value.includes(getFlowchartSelectionKey(record));
}

function toggleVehicleSelection(carId) {
  if (isVehicleSelected(carId)) {
    selectedVehicleIds.value = selectedVehicleIds.value.filter((selectedId) => selectedId !== carId);
    return;
  }

  selectedVehicleIds.value = [...selectedVehicleIds.value, carId];
}

function toggleFlowchartSelection(record) {
  const key = getFlowchartSelectionKey(record);
  if (selectedFlowchartKeys.value.includes(key)) {
    selectedFlowchartKeys.value = selectedFlowchartKeys.value.filter((selectedKey) => selectedKey !== key);
    return;
  }

  selectedFlowchartKeys.value = [...selectedFlowchartKeys.value, key];
}

function toggleAllVehiclesOnPage() {
  const pageIds = vehicles.items.map((vehicle) => vehicle.carId);
  const allSelected = pageIds.length > 0 && pageIds.every((carId) => selectedVehicleIds.value.includes(carId));
  selectedVehicleIds.value = allSelected ? [] : pageIds;
}

function toggleAllFlowchartsOnPage() {
  const pageKeys = flowcharts.items.map(getFlowchartSelectionKey);
  const allSelected = pageKeys.length > 0 && pageKeys.every((key) => selectedFlowchartKeys.value.includes(key));
  selectedFlowchartKeys.value = allSelected ? [] : pageKeys;
}

function areAllVehiclesOnPageSelected() {
  return vehicles.items.length > 0 && vehicles.items.every((vehicle) => selectedVehicleIds.value.includes(vehicle.carId));
}

function areAllFlowchartsOnPageSelected() {
  return flowcharts.items.length > 0 && flowcharts.items.every((record) => selectedFlowchartKeys.value.includes(getFlowchartSelectionKey(record)));
}

async function bulkDeleteSelected(section) {
  const config = {
    vehicles: {
      count: selectedVehicleIds.value.length,
      title: 'Delete Selected Vehicles',
      message: `Delete ${selectedVehicleIds.value.length} selected vehicle record${selectedVehicleIds.value.length === 1 ? '' : 's'}?`,
      action: () => Promise.all(selectedVehicleIds.value.map((carId) => deleteAdminVehicle(carId))),
      clear: () => {
        selectedVehicleIds.value = [];
      },
      reload: () => Promise.all([loadVehicles(), loadAuditLogs()])
    },
    flowcharts: {
      count: selectedFlowchartKeys.value.length,
      title: 'Delete Selected Flowcharts',
      message: `Delete ${selectedFlowchartKeys.value.length} selected flowchart${selectedFlowchartKeys.value.length === 1 ? '' : 's'}?`,
      action: () => Promise.all(
        flowcharts.items
          .filter((record) => selectedFlowchartKeys.value.includes(getFlowchartSelectionKey(record)))
          .map((record) => deleteAdminFlowchart(record.ownerUserId, record.flowchartId))
      ),
      clear: () => {
        selectedFlowchartKeys.value = [];
      },
      reload: () => Promise.all([loadFlowcharts(), loadAuditLogs()])
    }
  }[section];

  if (!config || config.count === 0) {
    return;
  }

  const confirmed = await confirmDialog.value.show(config.message, {
    title: config.title,
    confirmLabel: 'Delete Selected'
  });

  if (!confirmed) {
    return;
  }

  loading.save = true;
  try {
    await config.action();
    config.clear();
    await config.reload();
    showAlert('success', 'Selected records deleted successfully.');
  } catch (err) {
    showAlert('danger', err?.message || 'Unable to delete the selected records.');
  } finally {
    loading.save = false;
  }
}

onMounted(loadDashboardData);

watch(() => admins.search, () => {
  debounceSearch(admins, loadAdmins, 'admins');
});

watch(() => users.search, () => {
  debounceSearch(users, loadUsers, 'users');
});

watch(() => vehicles.search, () => {
  debounceSearch(vehicles, loadVehicles, 'vehicles');
});

watch(() => flowcharts.search, () => {
  debounceSearch(flowcharts, loadFlowcharts, 'flowcharts');
});

watch(() => auditLogs.search, () => {
  debounceSearch(auditLogs, loadAuditLogs, 'audit');
});

watch(() => [authState.isAuthenticated, authState.isAdmin], ([isAuthenticated, isAdmin]) => {
  if (isAuthenticated && isAdmin) {
    loadDashboardData();
  }
});

watch(() => authState.adminAccessLevel, () => {
  if (!isSuperAdmin.value && activeTab.value === 'admins') {
    activeTab.value = 'users';
  }
});
</script>

<template>
  <div class="admin-dashboard-page untree_co-section" :class="{ 'dark-mode': themeStore.isDark }">
    <ConfirmDialog ref="confirmDialog" />

    <div class="container">
      <div v-if="!authState.isAdmin" class="admin-empty-state">
        <h1>Admin Dashboard</h1>
        <p>Administrator access is required to manage accounts and database records.</p>
      </div>

      <div v-else>
        <section class="admin-hero">
          <div>
            <h1>Admin Dashboard</h1>
            <p class="hero-copy">Manage access and update production data.</p>
          </div>
          <div class="hero-badge">{{ authState.adminAccessLevel }}</div>
        </section>

        <div v-if="alert.message" class="alert" :class="alert.type === 'danger' ? 'alert-danger' : 'alert-success'">
          {{ alert.message }}
        </div>

        <section class="summary-grid">
          <article v-for="card in summaryCards" :key="card.label" class="summary-card">
            <span class="summary-label">{{ card.label }}</span>
            <strong class="summary-value">{{ card.value }}</strong>
            <span class="summary-detail">{{ card.detail }}</span>
          </article>
        </section>

        <section class="admin-tabs">
          <button v-if="isSuperAdmin" class="tab-button" :class="{ active: activeTab === 'admins' }" @click="activeTab = 'admins'">Admin Accounts</button>
          <button class="tab-button" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">Users</button>
          <button class="tab-button" :class="{ active: activeTab === 'vehicles' }" @click="activeTab = 'vehicles'">Vehicles</button>
          <button class="tab-button" :class="{ active: activeTab === 'flowcharts' }" @click="activeTab = 'flowcharts'">Flowcharts</button>
          <button class="tab-button" :class="{ active: activeTab === 'audit' }" @click="activeTab = 'audit'">Audit Log</button>
        </section>

        <section v-if="activeTab === 'admins' && isSuperAdmin" class="panel-grid">
          <div class="admin-panel form-panel">
            <div class="panel-header">
              <div>
                <h2>Grant Admin Access</h2>
                <p>Promote an existing application user through the backend allowlist.</p>
              </div>
            </div>
            <div class="form-grid two-column">
              <label>
                <span>User ID</span>
                <input v-model="grantForm.targetUserId" class="form-control" placeholder="auth0|..." />
              </label>
              <label>
                <span>Access Level</span>
                <select v-model="grantForm.accessLevel" class="form-control">
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </label>
            </div>
            <button class="btn btn-primary" :disabled="loading.save" @click="submitGrant">
              {{ loading.save ? 'Saving...' : 'Grant Access' }}
            </button>
          </div>

          <div class="admin-panel table-panel">
            <div class="panel-header split-header">
              <div>
                <h2>Active Admin Accounts</h2>
                <p>Current allowlist members and their effective access level.</p>
              </div>
              <div class="search-row">
                <input v-model="admins.search" class="form-control" placeholder="Search by user, email, or access level" />
              </div>
            </div>
            <div v-if="loading.admins" class="panel-loading">Loading admin accounts...</div>
            <div v-else-if="admins.items.length > 0" class="records-shell">
              <div class="record-grid compact-grid admin-grid">
                <article v-for="admin in admins.items" :key="admin.userId" class="record-card compact-card admin-record-card">
                  <div class="admin-card-header">
                    <div class="admin-card-identity">
                      <h3 :title="admin.username || admin.userId">{{ admin.username || admin.userId }}</h3>
                      <p :title="admin.email">{{ admin.email || 'No email on file' }}</p>
                    </div>
                    <span class="pill admin-card-pill">{{ admin.accessLevel }}</span>
                  </div>
                  <div class="admin-card-meta">
                    <div class="record-detail-item">
                      <span class="record-detail-label">Granted</span>
                      <strong>{{ formatDate(admin.grantedAt) }}</strong>
                    </div>
                    <span v-if="admin.isBootstrap" class="record-secondary-meta admin-card-protection">Protected</span>
                  </div>
                  <div class="admin-card-footer">
                    <div class="record-detail-item admin-card-userid">
                      <span class="record-detail-label">User ID</span>
                      <strong :title="admin.userId">{{ admin.userId }}</strong>
                    </div>
                    <button class="btn btn-outline-danger btn-sm admin-card-button" :disabled="admin.isBootstrap || loading.save" @click="revokeAdmin(admin.userId)">
                      Revoke
                    </button>
                  </div>
                </article>
              </div>
              <PaginationControls
                :page="admins.page"
                :page-size="admins.pageSize"
                :total="admins.total"
                :disabled="loading.admins || loading.save"
                @update:page="updatePage(admins, loadAdmins, $event)"
                @update:page-size="updatePageSize(admins, loadAdmins, $event)"
              />
            </div>
            <div v-else class="panel-empty-state">No admin accounts match your current search.</div>
          </div>
        </section>

        <section v-if="activeTab === 'users'" class="admin-panel table-panel users-panel">
          <div class="panel-header split-header">
            <div>
              <h2>User Records</h2>
            </div>
            <div class="search-row">
              <input v-model="users.search" class="form-control" placeholder="Search" />
            </div>
          </div>
          <div v-if="loading.users" class="panel-loading">Loading users...</div>
          <div v-else-if="users.items.length > 0" class="records-shell">
            <div class="record-grid compact-grid users-grid">
              <article v-for="user in users.items" :key="user.userId" class="record-card compact-card user-record-card">
                <div class="user-card-header">
                  <div class="user-card-identity">
                    <h3 :title="userDisplay(user)">{{ userDisplay(user) }}</h3>
                    <p class="user-card-email" :title="user.email">{{ user.email }}</p>
                  </div>
                  <div class="record-meta user-card-meta">
                    <span class="pill user-card-pill" :class="user.isAdmin ? 'pill-admin' : ''">{{ user.isAdmin ? user.accessLevel : 'user' }}</span>
                  </div>
                </div>

                <div v-if="isEditing('users', user.userId)" class="editor-card compact-editor-card">
                  <div class="form-grid">
                    <label>
                      <span>Name</span>
                      <input v-model="editing.draft.name" class="form-control" />
                    </label>
                  </div>
                  <div class="editor-actions compact-actions-row user-card-edit-actions">
                    <button class="btn btn-primary btn-sm" :disabled="loading.save" @click="saveEdit('users', user)">Save</button>
                    <button class="btn btn-secondary btn-sm" @click="resetEditing">Cancel</button>
                  </div>
                </div>

                <div v-else class="user-card-footer">
                  <button v-if="isSuperAdmin" class="btn btn-outline-primary btn-sm user-card-grant-button" @click="prepareGrantFromUser(user)" :disabled="user.isAdmin">
                    {{ user.isAdmin ? 'Admin Access' : 'Grant Admin' }}
                  </button>
                  <div class="record-actions compact-actions-row user-card-icon-actions">
                    <button class="btn btn-outline-primary btn-sm compact-icon-button subtle-icon-button" title="Edit user" aria-label="Edit user" @click="startEditUser(user)">
                      <i class="pi pi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm compact-icon-button subtle-icon-button danger" title="Delete user" aria-label="Delete user" @click="deleteRecord('users', user)">
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                </div>
              </article>
            </div>
            <PaginationControls
              :page="users.page"
              :page-size="users.pageSize"
              :total="users.total"
              :disabled="loading.users || loading.save"
              @update:page="updatePage(users, loadUsers, $event)"
              @update:page-size="updatePageSize(users, loadUsers, $event)"
            />
          </div>
          <div v-else class="panel-empty-state">No user accounts match your current search.</div>
        </section>

        <section v-if="activeTab === 'vehicles'" class="admin-panel table-panel vehicles-panel">
          <div class="panel-header split-header">
            <div>
              <h2>Vehicle Records</h2>
              <p>Edit make/model/year/trim data and remove entries safely.</p>
            </div>
            <div class="search-row">
              <input v-model="vehicles.search" class="form-control" placeholder="Search by year, make, model, or trim" />
            </div>
          </div>
          <div v-if="loading.vehicles" class="panel-loading">Loading vehicles...</div>
          <div v-else-if="vehicles.items.length > 0" class="records-shell">
            <div class="bulk-toolbar">
              <label class="selection-toggle">
                <input type="checkbox" :checked="areAllVehiclesOnPageSelected()" @change="toggleAllVehiclesOnPage" />
                <span>Select page</span>
              </label>
              <div class="bulk-toolbar-actions">
                <span>{{ selectedVehicleIds.length }} selected</span>
                <button class="btn btn-outline-danger btn-sm" :disabled="selectedVehicleIds.length === 0 || loading.save" @click="bulkDeleteSelected('vehicles')">
                  Delete Selected
                </button>
              </div>
            </div>

            <div class="record-grid compact-grid vehicles-grid">
              <article v-for="vehicle in vehicles.items" :key="vehicle.carId" class="record-card compact-card selectable-card vehicle-record-card" :class="{ selected: isVehicleSelected(vehicle.carId) }">
                <div class="record-selection-row">
                  <label class="selection-toggle">
                    <input type="checkbox" :checked="isVehicleSelected(vehicle.carId)" @change="toggleVehicleSelection(vehicle.carId)" />
                  </label>
                  <span class="record-secondary-meta vehicle-card-usage">{{ vehicle.garageUsageCount }} garages</span>
                </div>

                <div class="record-summary compact-summary vehicle-card-header">
                  <div class="vehicle-card-identity">
                    <h3>{{ vehicle.year }} {{ vehicle.make }} {{ vehicle.model }}</h3>
                    <p class="vehicle-card-trim">{{ vehicle.trim || 'No trim specified' }}</p>
                  </div>
                </div>

                <div v-if="isEditing('vehicles', vehicle.carId)" class="editor-card compact-editor-card">
                  <div class="form-grid two-column">
                    <label><span>Year</span><input v-model="editing.draft.year" class="form-control" /></label>
                    <label><span>Make</span><input v-model="editing.draft.make" class="form-control" /></label>
                    <label><span>Model</span><input v-model="editing.draft.model" class="form-control" /></label>
                    <label><span>Trim</span><input v-model="editing.draft.trim" class="form-control" /></label>
                  </div>
                  <div class="editor-actions compact-actions-row vehicle-card-edit-actions">
                    <button class="btn btn-primary btn-sm" :disabled="loading.save" @click="saveEdit('vehicles', vehicle)">Save</button>
                    <button class="btn btn-secondary btn-sm" @click="resetEditing">Cancel</button>
                  </div>
                </div>

                <div v-else class="vehicle-card-footer">
                  <div class="record-actions compact-actions-row vehicle-card-icon-actions">
                  <button class="btn btn-outline-primary btn-sm compact-icon-button subtle-icon-button" title="Edit vehicle" aria-label="Edit vehicle" @click="startEditVehicle(vehicle)">
                    <i class="pi pi-pencil"></i>
                  </button>
                  <button class="btn btn-outline-danger btn-sm compact-icon-button subtle-icon-button danger" title="Delete vehicle" aria-label="Delete vehicle" @click="deleteRecord('vehicles', vehicle)">
                    <i class="pi pi-trash"></i>
                  </button>
                  </div>
                </div>
              </article>
            </div>
            <PaginationControls
              :page="vehicles.page"
              :page-size="vehicles.pageSize"
              :total="vehicles.total"
              :disabled="loading.vehicles || loading.save"
              @update:page="updatePage(vehicles, loadVehicles, $event)"
              @update:page-size="updatePageSize(vehicles, loadVehicles, $event)"
            />
          </div>
          <div v-else class="panel-empty-state">No vehicle records match your current search.</div>
        </section>

        <section v-if="activeTab === 'flowcharts'" class="admin-panel table-panel flowcharts-panel">
          <div class="panel-header split-header">
            <div>
              <h2>Flowchart Records</h2>
              <p>Review recently saved flowcharts and remove flowcharts when needed.</p>
            </div>
            <div class="search-row">
              <input v-model="flowcharts.search" class="form-control" placeholder="Search by owner, vehicle, issue, or flowchart id" />
            </div>
          </div>
          <div v-if="loading.flowcharts" class="panel-loading">Loading flowcharts...</div>
          <div v-else-if="flowcharts.items.length > 0" class="records-shell">
            <div class="bulk-toolbar">
              <label class="selection-toggle">
                <input type="checkbox" :checked="areAllFlowchartsOnPageSelected()" @change="toggleAllFlowchartsOnPage" />
                <span>Select page</span>
              </label>
              <div class="bulk-toolbar-actions">
                <span>{{ selectedFlowchartKeys.length }} selected</span>
                <button class="btn btn-outline-danger btn-sm" :disabled="selectedFlowchartKeys.length === 0 || loading.save" @click="bulkDeleteSelected('flowcharts')">
                  Delete Selected
                </button>
              </div>
            </div>

            <div class="record-grid compact-grid flowcharts-grid">
              <article v-for="record in flowcharts.items" :key="`${record.ownerUserId}:${record.flowchartId}`" class="record-card compact-card selectable-card flowchart-record-card" :class="{ selected: isFlowchartSelected(record) }">
                <div class="record-selection-row">
                  <label class="selection-toggle">
                    <input type="checkbox" :checked="isFlowchartSelected(record)" @change="toggleFlowchartSelection(record)" />
                  </label>
                </div>

                <div class="record-summary flowchart-card-header">
                  <div class="flowchart-card-identity">
                    <h3>{{ vehicleLabel(record.vehicle) || record.flowchartId }}</h3>
                    <p>{{ record.ownerName || record.ownerUserId }} · {{ record.issues }}</p>
                  </div>
                  <div class="record-meta flowchart-card-meta">
                    <span>{{ record.responses?.length || 0 }} responses</span>
                    <span>{{ formatDate(record.updatedAt) }}</span>
                  </div>
                </div>

                <div class="record-actions compact-actions-row flowchart-card-actions">
                  <button class="btn btn-outline-danger btn-sm compact-icon-button subtle-icon-button danger" title="Delete flowchart" aria-label="Delete flowchart" @click="deleteRecord('flowcharts', record)">
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </article>
            </div>
            <PaginationControls
              :page="flowcharts.page"
              :page-size="flowcharts.pageSize"
              :total="flowcharts.total"
              :disabled="loading.flowcharts || loading.save"
              @update:page="updatePage(flowcharts, loadFlowcharts, $event)"
              @update:page-size="updatePageSize(flowcharts, loadFlowcharts, $event)"
            />
          </div>
          <div v-else class="panel-empty-state">No flowchart records match your current search.</div>
        </section>

        <section v-if="activeTab === 'audit'" class="admin-panel table-panel">
          <div class="panel-header split-header">
            <div>
              <h2>Audit Log</h2>
              <p>Immutable activity history for grants, revokes, edits, and deletions.</p>
            </div>
            <div class="search-row">
              <input v-model="auditLogs.search" class="form-control" placeholder="Search by actor, action, target, or restored by" />
            </div>
          </div>
          <div v-if="loading.audit" class="panel-loading">Loading audit history...</div>
          <div v-else-if="auditLogs.items.length > 0" class="audit-list compact-grid audit-grid">
            <article v-for="entry in auditLogs.items" :key="entry._id" class="audit-card compact-card">
              <div class="audit-header">
                <strong>{{ entry.action }}</strong>
                <span>{{ formatDate(entry.createdAt) }}</span>
              </div>
              <div class="audit-body">
                <p><strong>Actor:</strong> {{ entry.actorUserId }}</p>
                <p><strong>Target:</strong> {{ entry.targetType }} · {{ entry.targetLabel || entry.targetId }}</p>
                <p v-if="entry.restoredAt" class="audit-status">
                  Restored {{ formatDate(entry.restoredAt) }} by {{ entry.restoredBy || 'an admin' }}
                </p>
              </div>
              <div v-if="canRestoreAuditEntry(entry)" class="audit-actions">
                <button class="btn btn-outline-primary btn-sm" :disabled="loading.save" @click="restoreAuditEntry(entry)">
                  Restore Deleted Data
                </button>
              </div>
            </article>
            <PaginationControls
              :page="auditLogs.page"
              :page-size="auditLogs.pageSize"
              :total="auditLogs.total"
              :disabled="loading.audit"
              @update:page="updatePage(auditLogs, loadAuditLogs, $event)"
              @update:page-size="updatePageSize(auditLogs, loadAuditLogs, $event)"
            />
          </div>
          <div v-else class="panel-empty-state">No audit activity has been recorded yet.</div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-dashboard-page {
  background: linear-gradient(180deg, #f6f9ff 0%, #ffffff 32%);
  min-height: calc(100vh - 5rem);
}

.admin-empty-state,
.admin-panel,
.summary-card,
.audit-card {
  background: #ffffff;
  border: 1px solid rgba(64, 123, 255, 0.12);
  border-radius: 18px;
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08);
}

.admin-empty-state {
  padding: 2.5rem;
  text-align: center;
}

.admin-hero {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
  margin-bottom: 1.75rem;
}

.eyebrow {
  color: #407bff;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.hero-copy {
  max-width: 54rem;
  color: #5b6475;
}

.hero-badge {
  background:  #407bff;
  color: #fff;
  border-radius: 999px;
  padding: 0.65rem 1rem;
  font-weight: 700;
  text-transform: capitalize;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  padding: 1.25rem;
}

.summary-label,
.summary-detail {
  display: block;
}

.summary-label,
.panel-header p,
.record-summary p,
.audit-card p {
  color: #5b6475;
}

.summary-value {
  display: block;
  font-size: 2rem;
  line-height: 1.1;
  margin: 0.35rem 0;
  color: #132238;
}

.admin-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  scrollbar-width: thin;
}

.tab-button {
  border: 1px solid rgba(64, 123, 255, 0.18);
  border-radius: 999px;
  padding: 0.75rem 1rem;
  background: #fff;
  color: #274472;
  font-weight: 600;
  min-height: 2.85rem;
  white-space: nowrap;
}

.tab-button.active {
  background: #407bff;
  color: #fff;
}

.panel-grid {
  display: grid;
  grid-template-columns: minmax(260px, 320px) 1fr;
  gap: 1.25rem;
  min-width: 0;
}

.admin-panel {
  padding: 1.35rem;
  margin-bottom: 1rem;
  min-width: 0;
}

.panel-header {
  margin-bottom: 1rem;
}

.split-header,
.search-row,
.record-summary,
.record-actions,
.editor-actions,
.audit-header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.search-row {
  display: flex;
  min-width: min(100%, 340px);
  max-width: 100%;
}

.search-row .form-control {
  min-height: 2.85rem;
}

.form-grid {
  display: grid;
  gap: 0.9rem;
}

.two-column {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.full-width {
  grid-column: 1 / -1;
}

label span {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
  color: #274472;
}

.form-control {
  width: 100%;
  border-radius: 12px;
  border: 1px solid #d5dce8;
  padding: 0.75rem 0.9rem;
  background: #fbfcfe;
}

.code-field {
  font-family: 'Courier New', monospace;
}

.table-shell {
  width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.admin-table th,
.admin-table td {
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid #edf2fb;
  text-align: left;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.admin-table th:last-child,
.admin-table td:last-child {
  width: 7.5rem;
}

.record-stack,
.audit-list {
  display: grid;
  gap: 0.9rem;
}

.records-shell {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.record-grid {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
}

.compact-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.users-grid,
.vehicles-grid,
.flowcharts-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.record-card,
.editor-card,
.audit-card {
  padding: 0.95rem;
}

.record-card {
  border: 1px solid #d9e4f4;
  border-radius: 16px;
  background: #f3f7fd;
  min-width: 0;
}

.compact-card {
  padding: 0.95rem;
}

.user-record-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 0;
  background: #eef4fb;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.user-record-card:hover {
  transform: translateY(-2px);
  border-color: #c9d8ee;
  box-shadow: 0 18px 30px rgba(39, 68, 114, 0.08);
}

.vehicle-record-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 0;
  background: #edf3fb;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.vehicle-record-card:hover {
  transform: translateY(-2px);
  border-color: #c9d8ee;
  box-shadow: 0 18px 30px rgba(39, 68, 114, 0.08);
}

.admin-record-card,
.flowchart-record-card,
.audit-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 0;
  background: #eef4fb;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.flowchart-record-card {
  height: 16.5rem;
  overflow: hidden;
}

.admin-record-card:hover,
.flowchart-record-card:hover,
.audit-card:hover {
  transform: translateY(-2px);
  border-color: #c9d8ee;
  box-shadow: 0 18px 30px rgba(39, 68, 114, 0.08);
}

.admin-card-header,
.flowchart-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.9rem;
  background: transparent;
}

.admin-card-identity,
.flowchart-card-identity {
  min-width: 0;
  flex: 1;
  background: transparent;
  box-shadow: none;
}

.admin-card-identity h3,
.flowchart-card-identity h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  color: #132238;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  background: transparent;
  box-shadow: none;
}

.admin-card-identity p,
.flowchart-card-identity p {
  margin-top: 0.45rem;
  margin-bottom: 0;
  color: #607089;
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: anywhere;
  background: transparent;
  box-shadow: none;
}

.admin-card-pill {
  flex: 0 0 auto;
  align-self: flex-start;
}

.record-detail-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.admin-card-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(39, 68, 114, 0.09);
  background: transparent;
}

.admin-card-footer {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.8rem;
  background: transparent;
}

.record-detail-item {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  background: transparent;
}

.record-detail-item strong {
  color: #132238;
  overflow-wrap: anywhere;
}

.record-detail-label {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #607089;
}

.admin-card-actions,
.flowchart-card-actions {
  margin-top: 0.85rem;
}

.admin-card-button {
  min-width: 0;
  width: auto;
  justify-self: end;
  background: transparent;
}

.admin-card-protection {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.admin-card-userid strong {
  font-size: 0.78rem;
  line-height: 1.35;
}

.flowchart-card-meta {
  margin-top: 0.85rem;
}

.flowchart-card-header {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(6rem, 6rem) minmax(2.5rem, 2.5rem);
  align-content: start;
}

.flowchart-card-actions {
  margin-top: auto;
  min-height: 3rem;
  padding-top: 0.75rem;
  padding-bottom: 0.1rem;
  width: 100%;
  justify-content: flex-end;
}

.flowchart-card-identity {
  min-height: 6rem;
}

.flowchart-card-identity h3 {
  min-height: 2.6rem;
}

.flowchart-card-identity p {
  min-height: 3rem;
}

.flowchart-card-meta {
  min-height: 2.5rem;
  align-content: start;
}

.audit-grid .audit-card {
  min-height: 0;
}

.audit-card {
  gap: 0.85rem;
}

.audit-body {
  display: grid;
  gap: 0.35rem;
}

.user-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.9rem;
}

.user-card-identity {
  min-width: 0;
  flex: 1;
}

.user-card-identity h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  color: #132238;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.user-card-email {
  margin-top: 0.45rem;
  color: #607089;
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.user-card-meta {
  flex: 0 0 auto;
}

.user-card-pill {
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  letter-spacing: 0.01em;
}

.vehicle-card-header {
  margin-top: 0.15rem;
}

.vehicle-card-identity {
  min-width: 0;
}

.vehicle-card-identity h3 {
  margin: 0;
  font-size: 1.02rem;
  line-height: 1.3;
  color: #132238;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.vehicle-card-trim {
  margin-top: 0.45rem;
  color: #607089;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.compact-card h3 {
  font-size: 1rem;
  margin-bottom: 0.3rem;
}

.compact-card p {
  margin-bottom: 0;
  font-size: 0.86rem;
}

.compact-summary {
  align-items: flex-start;
  gap: 1rem;
  margin-top: 0.35rem;
}

.compact-editor-card {
  padding: 1.05rem;
}

.record-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  color: #4c5a70;
  min-width: 0;
  font-size: 0.82rem;
}

.record-secondary-meta {
  font-size: 0.85rem;
  color: #5b6475;
}

.vehicle-card-usage {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.72rem;
  border-radius: 999px;
  background: rgba(19, 34, 56, 0.05);
  color: #516176;
  font-weight: 600;
}

.record-selection-row,
.bulk-toolbar,
.bulk-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.user-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-top: 0.85rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(39, 68, 114, 0.09);
}

.user-card-grant-button {
  min-width: 0;
  padding: 0.55rem 0.9rem;
  font-size: 0.8rem;
  line-height: 1.15;
  letter-spacing: 0.02em;
}

.user-card-icon-actions {
  gap: 0.5rem;
  flex-wrap: nowrap;
}

.user-card-icon-actions .btn {
  flex: 0 0 auto;
}

.user-card-edit-actions {
  margin-top: 0.9rem;
}

.vehicle-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.8rem;
  margin-top: 0.85rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(39, 68, 114, 0.09);
}

.vehicle-card-icon-actions {
  gap: 0.5rem;
  flex-wrap: nowrap;
}

.vehicle-card-icon-actions .btn {
  flex: 0 0 auto;
}

.vehicle-card-edit-actions {
  margin-top: 0.9rem;
}

.bulk-toolbar {
  padding: 0.85rem 1rem;
  border: 1px solid #edf2fb;
  border-radius: 14px;
  background: #f8fbff;
  flex-wrap: wrap;
}

.bulk-toolbar-actions {
  flex-wrap: wrap;
}

.selection-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: #274472;
  font-weight: 600;
}

.selection-toggle input {
  width: 1rem;
  height: 1rem;
}

.selectable-card.selected {
  border-color: rgba(64, 123, 255, 0.38);
  box-shadow: 0 12px 24px rgba(64, 123, 255, 0.1);
}

.editor-card {
  margin-top: 1rem;
  background: #fff;
  border: 1px solid #edf2fb;
}

.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(64, 123, 255, 0.12);
  color: #2f5dcc;
  font-weight: 700;
  text-transform: capitalize;
}

.pill-admin {
  background: rgba(21, 163, 74, 0.14);
  color: #15803d;
}

.actions-cell,
.record-actions,
.editor-actions {
  justify-content: flex-end;
}

.compact-actions-row {
  gap: 0.45rem;
  flex-wrap: wrap;
}

.compact-actions-row .btn {
  flex: 1 1 4.5rem;
  min-width: 0;
  padding: 0.38rem 0.6rem;
  font-size: 0.78rem;
  line-height: 1.15;
}

.compact-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto !important;
  width: 2.5rem !important;
  min-width: 2.5rem !important;
  height: 2.5rem !important;
  min-height: 2.5rem !important;
  padding: 0 !important;
  border-radius: 50% !important;
}

.compact-icon-button .pi {
  font-size: 0.95rem;
}

.subtle-icon-button {
  border-color: rgba(64, 123, 255, 0.18);
  background: transparent;
}

.subtle-icon-button.danger {
  border-color: rgba(220, 53, 69, 0.18);
  background: transparent;
}

.actions-cell .btn {
  white-space: nowrap;
}

.panel-loading {
  color: #5b6475;
  padding: 1rem 0;
}

.audit-body {
  display: grid;
  gap: 0.35rem;
}

.audit-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.85rem;
}

.audit-status {
  color: #15803d;
  font-weight: 600;
}

.panel-empty-state {
  padding: 1.25rem 0;
  color: #5b6475;
  text-align: center;
}

.btn {
  border-radius: 999px;
  font-weight: 600;
}

@media (max-width: 1199px) {
  .compact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 991px) {
  .panel-grid,
  .two-column {
    grid-template-columns: 1fr;
  }

  .compact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .split-header,
  .search-row,
  .record-summary,
  .record-actions,
  .editor-actions,
  .user-card-header,
  .user-card-footer,
  .vehicle-card-footer,
  .record-selection-row,
  .bulk-toolbar,
  .bulk-toolbar-actions,
  .audit-header,
  .admin-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .actions-cell {
    min-width: 8rem;
  }

  .admin-table th:last-child,
  .admin-table td:last-child {
    width: auto;
  }

  .search-row {
    width: 100%;
  }

  .admin-card-header,
  .flowchart-card-header,
  .audit-header {
    flex-direction: row;
    align-items: flex-start;
  }

  .users-panel .user-card-footer,
  .vehicles-panel .vehicle-card-footer {
    margin-top: 1.15rem;
    align-items: flex-end;
    justify-content: flex-end;
  }

  .users-panel .user-card-icon-actions,
  .vehicles-panel .vehicle-card-icon-actions {
    width: auto;
    align-self: flex-end;
    justify-content: flex-end;
    flex-direction: row;
    align-items: center;
    flex-wrap: nowrap;
  }

  .users-panel .user-card-icon-actions .btn,
  .vehicles-panel .vehicle-card-icon-actions .btn {
    flex: 0 0 auto;
  }
}

@media (max-width: 767px) {
  .admin-dashboard-page {
    padding-bottom: 1.5rem;
  }

  .container {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .admin-hero,
  .admin-panel,
  .summary-card,
  .audit-card,
  .record-card,
  .editor-card {
    border-radius: 16px;
  }

  .admin-panel,
  .summary-card,
  .audit-card,
  .record-card,
  .editor-card {
    padding: 1rem;
  }

  .summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .summary-value {
    font-size: 1.7rem;
  }

  .admin-tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    margin-left: -0.1rem;
    margin-right: -0.1rem;
    scroll-snap-type: x proximity;
  }

  .tab-button {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }

  .split-header {
    gap: 1rem;
  }

  .panel-header {
    margin-bottom: 0.9rem;
  }

  .search-row,
  .search-row .form-control {
    width: 100%;
  }

  .bulk-toolbar,
  .bulk-toolbar-actions,
  .record-selection-row,
  .record-actions,
  .editor-actions,
  .audit-actions {
    width: 100%;
  }

  .bulk-toolbar-actions,
  .editor-actions,
  .record-actions,
  .audit-actions {
    justify-content: stretch;
  }

  .bulk-toolbar-actions .btn,
  .editor-actions .btn,
  .record-actions .btn,
  .audit-actions .btn,
  .user-card-grant-button {
    width: 100%;
  }

  .compact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-panel .record-grid,
  .vehicles-panel .record-grid,
  .flowcharts-panel .record-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .users-panel .record-card,
  .vehicles-panel .record-card,
  .flowcharts-panel .record-card {
    padding: 0.85rem;
    border-radius: 18px;
    min-height: 10.5rem;
  }

  .flowcharts-panel .flowchart-record-card {
    height: 15.5rem;
  }

  .user-card-header,
  .user-card-footer,
  .vehicle-card-footer,
  .record-summary,
  .audit-header {
    gap: 0.85rem;
  }

  .admin-card-header,
  .flowchart-card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .admin-card-meta {
    flex-direction: column;
    align-items: stretch;
  }

  .users-panel .user-card-header,
  .users-panel .user-card-footer,
  .vehicles-panel .record-selection-row,
  .vehicles-panel .vehicle-card-footer,
  .flowcharts-panel .record-selection-row,
  .flowcharts-panel .flowchart-card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .users-panel .user-card-footer,
  .vehicles-panel .vehicle-card-footer,
  .flowcharts-panel .flowchart-card-actions {
    margin-top: auto;
  }

  .users-panel .user-card-footer {
    margin-top: 1.05rem;
  }

  .flowcharts-panel .flowchart-card-actions {
    padding-top: 1rem;
    min-height: 2.7rem;
  }

  .user-card-icon-actions,
  .vehicle-card-icon-actions {
    width: 100%;
    justify-content: stretch;
  }

  .users-panel .user-card-icon-actions,
  .vehicles-panel .vehicle-card-icon-actions,
  .flowcharts-panel .flowchart-card-actions {
    width: auto;
    justify-content: flex-end;
    flex-direction: row;
    align-items: center;
    flex-wrap: nowrap;
    align-self: flex-end;
  }

  .user-card-icon-actions .btn,
  .vehicle-card-icon-actions .btn {
    flex: 1 1 0;
  }

  .users-panel .user-card-icon-actions .btn,
  .vehicles-panel .vehicle-card-icon-actions .btn,
  .flowcharts-panel .flowchart-card-actions .btn {
    width: 2.35rem;
    flex: 0 0 auto;
  }

  .record-meta {
    width: 100%;
    justify-content: space-between;
  }

  .users-panel .record-meta,
  .flowcharts-panel .record-meta {
    justify-content: flex-start;
  }

  .users-panel .user-card-meta {
    padding-bottom: 0.85rem;
  }

  .flowcharts-panel .flowchart-card-meta {
    display: grid;
    gap: 0.2rem;
    margin-top: 0;
    min-height: 2.35rem;
  }

  .users-panel .user-card-grant-button,
  .vehicles-panel .bulk-toolbar-actions .btn,
  .flowcharts-panel .bulk-toolbar-actions .btn {
    width: 100%;
  }

  .admin-card-button {
    width: 100%;
    justify-self: stretch;
  }
}

@media (max-width: 520px) {
  .compact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .admin-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-panel .record-grid,
  .vehicles-panel .record-grid,
  .flowcharts-panel .record-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .record-card,
  .compact-card,
  .audit-card {
    padding: 0.85rem;
  }

  .users-panel .record-card,
  .vehicles-panel .record-card,
  .flowcharts-panel .record-card {
    padding: 0.8rem;
    min-height: 10rem;
  }

  .flowcharts-panel .flowchart-record-card {
    height: 14.75rem;
  }

  .user-card-grant-button {
    padding: 0.48rem 0.72rem;
    font-size: 0.76rem;
  }

  .compact-icon-button {
    min-width: 2.15rem;
    width: 2.15rem;
    height: 2.1rem;
  }

  .record-detail-label,
  .admin-card-protection,
  .record-meta {
    font-size: 0.74rem;
  }

  .admin-card-identity h3,
  .flowchart-card-identity h3,
  .user-card-identity h3,
  .vehicle-card-identity h3 {
    font-size: 0.92rem;
  }

  .admin-card-identity p,
  .flowchart-card-identity p,
  .user-card-email,
  .vehicle-card-trim,
  .compact-card p {
    font-size: 0.8rem;
  }
}

@media (max-width: 420px) {
  .compact-grid {
    grid-template-columns: 1fr;
  }

  .admin-grid {
    grid-template-columns: 1fr;
  }

  .users-panel .record-grid,
  .vehicles-panel .record-grid,
  .flowcharts-panel .record-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .users-panel .record-card,
  .vehicles-panel .record-card,
  .flowcharts-panel .record-card {
    min-height: 9.5rem;
  }

  .flowcharts-panel .flowchart-record-card {
    height: 14.25rem;
  }

  .user-card-icon-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .vehicle-card-icon-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .users-panel .user-card-icon-actions,
  .vehicles-panel .vehicle-card-icon-actions,
  .flowcharts-panel .flowchart-card-actions {
    width: auto;
    justify-content: flex-end;
    flex-direction: row;
    align-items: center;
    flex-wrap: nowrap;
    align-self: flex-end;
  }

  .record-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .users-panel .record-meta,
  .flowcharts-panel .record-meta {
    flex-direction: row;
    align-items: center;
  }

  .users-panel .user-card-meta {
    padding-bottom: 0.7rem;
  }
}

/* ── Dark mode ── */
.dark-mode.admin-dashboard-page {
  --color-surface: #162234;
  --color-surface-raised: #1b2a40;
  --color-border: #33465f;
  --color-border-subtle: rgba(148, 163, 184, 0.16);
  --color-text-primary: #e2e8f0;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #7b8da5;
  --color-brand: #4f8cff;
  background: linear-gradient(180deg, #0d1420 0%, #111a29 32%, #0f1726 100%);
}

.dark-mode .admin-empty-state,
.dark-mode .admin-panel,
.dark-mode .summary-card,
.dark-mode .audit-card {
  background: #162234;
  border-color: rgba(148, 163, 184, 0.12);
  box-shadow: 0 20px 45px rgba(2, 6, 23, 0.38);
}

.dark-mode h1,
.dark-mode h2,
.dark-mode h3 {
  color: #e2e8f0;
}

.dark-mode .hero-copy,
.dark-mode .summary-label,
.dark-mode .summary-detail,
.dark-mode .panel-header p,
.dark-mode .record-summary p,
.dark-mode .audit-card p,
.dark-mode .panel-loading,
.dark-mode .panel-empty-state,
.dark-mode .record-secondary-meta {
  color: #94a3b8;
}

.dark-mode .summary-value {
  color: #e2e8f0;
}

.dark-mode .summary-card {
  background: #162234;
}

.dark-mode label span {
  color: #94a3b8;
}

.dark-mode .form-control {
  background: #101928;
  border-color: rgba(148, 163, 184, 0.18);
  color: #e2e8f0;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.dark-mode .form-control::placeholder {
  color: #4a5a6e;
}

.dark-mode .form-control:focus {
  border-color: rgba(79, 140, 255, 0.55);
  box-shadow: 0 0 0 0.18rem rgba(79, 140, 255, 0.14);
}

.dark-mode .tab-button {
  background: rgba(22, 34, 52, 0.96);
  border-color: rgba(148, 163, 184, 0.14);
  color: #a9b8cb;
}

.dark-mode .tab-button.active {
  background: #447fff;
  color: #fff;
  border-color: transparent;
  box-shadow: none;
}

.dark-mode .record-card {
  background: #172438;
  border-color: rgba(148, 163, 184, 0.12);
}

.dark-mode .user-record-card {
  background: #172438;
}

.dark-mode .user-record-card:hover,
[data-theme="dark"] .user-record-card:hover {
  border-color: #3a5070;
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.3);
}

.dark-mode .vehicle-record-card {
  background: #172438;
}

.dark-mode .admin-record-card,
.dark-mode .flowchart-record-card,
.dark-mode .audit-card {
  background: #172438;
}

.dark-mode .vehicle-record-card:hover,
[data-theme="dark"] .vehicle-record-card:hover {
  border-color: #3a5070;
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.3);
}

.dark-mode .admin-record-card:hover,
.dark-mode .flowchart-record-card:hover,
.dark-mode .audit-card:hover {
  border-color: #3a5070;
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.3);
}

.dark-mode .user-card-identity h3,
.dark-mode .vehicle-card-identity h3,
.dark-mode .admin-card-identity h3,
.dark-mode .flowchart-card-identity h3 {
  color: #e2e8f0;
}

.dark-mode .admin-card-identity,
.dark-mode .admin-card-identity h3,
.dark-mode .admin-card-identity p {
  background: transparent !important;
  box-shadow: none !important;
}

.dark-mode .user-card-email,
.dark-mode .vehicle-card-trim,
.dark-mode .admin-card-identity p,
.dark-mode .flowchart-card-identity p,
.dark-mode .record-detail-label {
  color: #7a8fa6;
}

.dark-mode .editor-card {
  background: #111b2b;
  border-color: rgba(148, 163, 184, 0.12);
}

.dark-mode .bulk-toolbar {
  background: rgba(17, 27, 43, 0.92);
  border-color: rgba(148, 163, 184, 0.12);
}

.dark-mode .selection-toggle {
  color: #94a3b8;
}

.dark-mode .admin-card-meta,
.dark-mode .admin-card-footer,
.dark-mode .user-card-footer,
.dark-mode .vehicle-card-footer {
  border-top-color: rgba(148, 163, 184, 0.12);
}

.dark-mode .admin-card-header,
.dark-mode .admin-card-meta,
.dark-mode .admin-card-footer,
.dark-mode .record-detail-item {
  background: transparent !important;
  box-shadow: none;
}

.dark-mode .admin-table th,
.dark-mode .admin-table td {
  border-bottom-color: #2d3f55;
  color: #cbd5e1;
}

.dark-mode .record-meta {
  color: #7a8fa6;
}

.dark-mode .vehicle-card-usage {
  background: rgba(255, 255, 255, 0.05);
  color: #a5b4c7;
}

.dark-mode .subtle-icon-button {
  border-color: rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.03);
  color: #b5c2d3;
}

.dark-mode .subtle-icon-button.danger {
  border-color: rgba(220, 53, 69, 0.3);
  background: rgba(255, 255, 255, 0.03);
}

.dark-mode .btn-outline-primary,
.dark-mode .btn-outline-danger,
.dark-mode .btn-secondary {
  background: rgba(255, 255, 255, 0.03);
}

.dark-mode .btn-outline-primary {
  border-color: rgba(79, 140, 255, 0.28);
  color: #8ab5ff;
}

.dark-mode .btn-outline-primary:hover,
.dark-mode .btn-outline-primary:focus {
  background: rgba(79, 140, 255, 0.12);
  border-color: rgba(79, 140, 255, 0.42);
  color: #dbeafe;
}

.dark-mode .subtle-icon-button:hover {
  background: rgba(64, 123, 255, 0.25);
  border-color: rgba(64, 123, 255, 0.5);
  color: #7fb3ff;
}

.dark-mode .btn-outline-danger {
  border-color: rgba(248, 113, 113, 0.26);
  color: #fca5a5;
}

.dark-mode .admin-card-button {
  background: transparent;
}

.dark-mode .btn-outline-danger:hover,
.dark-mode .btn-outline-danger:focus {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.4);
  color: #ffe4e6;
}

.dark-mode .btn-primary {
  background: #447fff;
  border-color: transparent;
  box-shadow: none;
}


.dark-mode .pill {
  background: rgba(79, 140, 255, 0.18);
  color: #98beff;
}

.dark-mode .pill-admin {
  background: rgba(34, 197, 94, 0.16);
  color: #6ee7a2;
}

.dark-mode .audit-header {
  color: #e2e8f0;
}

.dark-mode .audit-status {
  color: #4ade80;
}

.dark-mode .record-detail-item strong {
  color: #e2e8f0;
}

.dark-mode .pagination-controls {
  border-top-color: rgba(148, 163, 184, 0.12);
}

.dark-mode .selectable-card.selected {
  border-color: rgba(64, 123, 255, 0.5);
  box-shadow: 0 12px 24px rgba(64, 123, 255, 0.15);
}

/* Flowchart record delete button — no subtle-icon-button class, boost visibility in dark mode */
.dark-mode .record-actions .compact-icon-button:not(.subtle-icon-button) {
  border-color: rgba(220, 53, 69, 0.3);
  background: transparent;
  color: #94a3b8;
}

.dark-mode .record-actions .compact-icon-button:not(.subtle-icon-button):hover {
  background: rgba(220, 53, 69, 0.3);
  border-color: rgba(220, 53, 69, 0.6);
  color: #ff8a8a;
}
</style>