import { createRouter, createWebHistory } from 'vue-router';

import FormView from './components/Form.vue';
import VehicleSubmit from './components/VehicleSubmit.vue';
import VehicleInfo from './components/VehicleInfo.vue';
import VehicleQuestions from './components/VehicleQuestions.vue';
import VehicleFlowchart from './components/VehicleFlowchart.vue';
import Profile from './components/Profile.vue';
import Home from './components/Home.vue';
import ProblemDesc from './components/ProblemDesc.vue';
import Login from './components/Login.vue';
import AboutUs from './components/AboutUs.vue';
import Register from './components/NewUser.vue';
import FlowchartPage from './components/FlowchartPage.vue';
import AdminDashboard from './components/AdminDashboard.vue';
import ServerUnavailable from './components/ServerUnavailable.vue';
import SharedFlowchartView from './components/SharedFlowchartView.vue';



// Set up routes that are going to be used by RouterView
const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/VehicleInfo', name: 'VehicleInfo', component: VehicleInfo },
  { path: '/problemdescription', name: 'ProblemDescription', component: ProblemDesc },
  { path: '/login', name: 'Login', component: Login },
  { path: '/aboutus', name: 'AboutUs', component: AboutUs },
  { path: '/form', component: FormView },
  { path: '/vehicle-submit', component: VehicleSubmit},
  { path: '/vehicle-questions', component: VehicleQuestions},
  { path: '/vehicle-flowchart', component: VehicleFlowchart},
  { path: '/profile', component: Profile, meta: { requiresAuth: true }},
  { path: '/register', component: Register},
  { path: '/flowcharts', component: FlowchartPage, meta: { requiresAuth: true } },
  { path: '/shared/:shareToken', name: 'SharedFlowchart', component: SharedFlowchartView },
  { path: '/admin', name: 'AdminDashboard', component: AdminDashboard, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/server-unavailable', name: 'ServerUnavailable', component: ServerUnavailable },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
