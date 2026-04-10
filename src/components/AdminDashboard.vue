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
            <div v-else-if="admins.items.length > 0" class="table-shell">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Access Level</th>
                    <th>Granted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="admin in admins.items" :key="admin.userId">
                    <td>{{ admin.username }}</td>
                    <td>{{ admin.email || '—' }}</td>
                    <td><span class="pill">{{ admin.accessLevel }}</span></td>
                    <td>{{ formatDate(admin.grantedAt) }}</td>
                    <td class="actions-cell">
                      <button class="btn btn-outline-danger btn-sm" :disabled="admin.isBootstrap || loading.save" @click="revokeAdmin(admin.userId)">
                        Revoke
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
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

        <section v-if="activeTab === 'users'" class="admin-panel table-panel">
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
            <div class="record-grid compact-grid">
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

        <section v-if="activeTab === 'vehicles'" class="admin-panel table-panel">
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

            <div class="record-grid compact-grid">
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

        <section v-if="activeTab === 'flowcharts'" class="admin-panel table-panel">
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

            <article v-for="record in flowcharts.items" :key="`${record.ownerUserId}:${record.flowchartId}`" class="record-card selectable-card" :class="{ selected: isFlowchartSelected(record) }">
              <div class="record-selection-row">
                <label class="selection-toggle">
                  <input type="checkbox" :checked="isFlowchartSelected(record)" @change="toggleFlowchartSelection(record)" />
                </label>
              </div>

              <div class="record-summary">
                <div>
                  <h3>{{ vehicleLabel(record.vehicle) || record.flowchartId }}</h3>
                  <p>{{ record.ownerName || record.ownerUserId }} · {{ record.issues }}</p>
                </div>
                <div class="record-meta">
                  <span>{{ record.responses?.length || 0 }} responses</span>
                  <span>{{ formatDate(record.updatedAt) }}</span>
                </div>
              </div>

              <div class="record-actions">
                <button class="btn btn-outline-danger btn-sm compact-icon-button" title="Delete flowchart" aria-label="Delete flowchart" @click="deleteRecord('flowcharts', record)">
                  <i class="pi pi-trash"></i>
                </button>
              </div>
            </article>
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
          <div v-else-if="auditLogs.items.length > 0" class="audit-list">
            <article v-for="entry in auditLogs.items" :key="entry._id" class="audit-card">
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
  background: linear-gradient(135deg, #407bff, #6ba2ff);
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
}

.tab-button {
  border: 1px solid rgba(64, 123, 255, 0.18);
  border-radius: 999px;
  padding: 0.75rem 1rem;
  background: #fff;
  color: #274472;
  font-weight: 600;
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
  min-width: min(100%, 340px);
  max-width: 100%;
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
}

.record-grid {
  display: grid;
  gap: 0.9rem;
}

.compact-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.record-card,
.editor-card,
.audit-card {
  padding: 1rem;
}

.record-card {
  border: 1px solid #d9e4f4;
  border-radius: 16px;
  background: #f3f7fd;
}

.compact-card {
  padding: 1.1rem;
}

.user-record-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 208px;
  background: linear-gradient(180deg, #f4f7fc 0%, #eef4fb 100%);
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
  min-height: 160px;
  background: linear-gradient(180deg, #f4f7fc 0%, #edf3fb 100%);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.vehicle-record-card:hover {
  transform: translateY(-2px);
  border-color: #c9d8ee;
  box-shadow: 0 18px 30px rgba(39, 68, 114, 0.08);
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-card-email {
  margin-top: 0.45rem;
  color: #607089;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
}

.vehicle-card-trim {
  margin-top: 0.45rem;
  color: #607089;
  line-height: 1.4;
}

.compact-card h3 {
  font-size: 1rem;
  margin-bottom: 0.3rem;
}

.compact-card p {
  margin-bottom: 0;
  font-size: 0.9rem;
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
  margin-top: 1rem;
  padding-top: 0.95rem;
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
  margin-top: 0.7rem;
  padding-top: 0.75rem;
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
  flex: 1 1 5.5rem;
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
  gap: 0.25rem;
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
}

@media (max-width: 640px) {
  .compact-grid {
    grid-template-columns: 1fr;
  }

  .user-card-icon-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .vehicle-card-icon-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

/* ── Dark mode ── */
.dark-mode.admin-dashboard-page {
  background: linear-gradient(180deg, #0f1623 0%, #111827 32%);
}

.dark-mode .admin-empty-state,
.dark-mode .admin-panel,
.dark-mode .summary-card,
.dark-mode .audit-card {
  background: #1a2232;
  border-color: rgba(64, 123, 255, 0.2);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
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

.dark-mode label span {
  color: #94a3b8;
}

.dark-mode .form-control {
  background: #0f1623;
  border-color: #2d3f55;
  color: #e2e8f0;
}

.dark-mode .form-control::placeholder {
  color: #4a5a6e;
}

.dark-mode .tab-button {
  background: #1a2232;
  border-color: rgba(64, 123, 255, 0.25);
  color: #94a3b8;
}

.dark-mode .tab-button.active {
  background: #407bff;
  color: #fff;
  border-color: #407bff;
}

.dark-mode .record-card,
[data-theme="dark"] .record-card {
  background: #1e2d42;
  border-color: #2d3f55;
}

.dark-mode .user-card-header,
.dark-mode .user-card-footer,
.dark-mode .user-card-identity,
.dark-mode .user-card-meta,
.dark-mode .vehicle-card-header,
.dark-mode .vehicle-card-identity,
.dark-mode .vehicle-card-footer {
  background: transparent;
  border-color: inherit;
}

/* Override theme.css [class*="card-"] blanket background on all nested card-* elements */
.dark-mode .record-card [class*="card-"] {
  background: transparent;
}

.dark-mode .user-record-card,
[data-theme="dark"] .user-record-card {
  background: linear-gradient(180deg, #1e2d42 0%, #192538 100%);
}

.dark-mode .user-record-card:hover,
[data-theme="dark"] .user-record-card:hover {
  border-color: #3a5070;
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.3);
}

.dark-mode .vehicle-record-card,
[data-theme="dark"] .vehicle-record-card {
  background: linear-gradient(180deg, #1e2d42 0%, #192538 100%);
}

.dark-mode .vehicle-record-card:hover,
[data-theme="dark"] .vehicle-record-card:hover {
  border-color: #3a5070;
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.3);
}

.dark-mode .user-card-identity h3,
.dark-mode .vehicle-card-identity h3 {
  color: #e2e8f0;
}

.dark-mode .user-card-email,
.dark-mode .vehicle-card-trim {
  color: #7a8fa6;
}

.dark-mode .editor-card {
  background: #162030;
  border-color: #2d3f55;
}

.dark-mode .bulk-toolbar {
  background: #162030;
  border-color: #2d3f55;
}

.dark-mode .selection-toggle {
  color: #94a3b8;
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
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

.dark-mode .user-card-footer {
  border-top-color: rgba(255, 255, 255, 0.07);
}

.dark-mode .vehicle-card-footer {
  border-top-color: rgba(255, 255, 255, 0.07);
}

.dark-mode .subtle-icon-button {
  border-color: rgba(64, 123, 255, 0.25);
  background: transparent;
  color: #94a3b8;
}

.dark-mode .subtle-icon-button:hover {
  background: rgba(64, 123, 255, 0.25);
  border-color: rgba(64, 123, 255, 0.5);
  color: #7fb3ff;
}

.dark-mode .subtle-icon-button.danger {
  border-color: rgba(220, 53, 69, 0.3);
  background: transparent;
  color: #94a3b8;
}

.dark-mode .subtle-icon-button.danger:hover {
  background: rgba(220, 53, 69, 0.3);
  border-color: rgba(220, 53, 69, 0.6);
  color: #ff8a8a;
}

.dark-mode .pill {
  background: rgba(64, 123, 255, 0.2);
  color: #7fb3ff;
}

.dark-mode .pill-admin {
  background: rgba(21, 163, 74, 0.2);
  color: #4ade80;
}

.dark-mode .audit-header {
  color: #e2e8f0;
}

.dark-mode .audit-status {
  color: #4ade80;
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