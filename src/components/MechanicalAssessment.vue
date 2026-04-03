<template>
  <div class="mechanical-assessment">
    <div class="assessment-header">
      <h2>Mechanical Capability Assessment</h2>
      <p class="subtitle">Help us tailor diagnostic flowcharts to your skill level and tools</p>
      <div class="progress-bar">
        <div class="progress" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <p class="progress-text">Step {{ currentStep }} of {{ totalSteps }}</p>
    </div>

    <div class="assessment-content">
      <!-- Step 1: Experience -->
      <div v-if="currentStep === 1" class="step">
        <h3>Mechanical Experience</h3>
        
        <div class="form-group">
          <label>Years of hands-on mechanical experience:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="formData.experience.yearsOfExperience" type="radio" :value="0">
              <span>None (0 years)</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.yearsOfExperience" type="radio" :value="1">
              <span>1-3 years</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.yearsOfExperience" type="radio" :value="4">
              <span>4-8 years</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.yearsOfExperience" type="radio" :value="8">
              <span>8+ years</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Hours per month working on vehicles:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="formData.experience.hoursPerMonth" type="radio" :value="0">
              <span>Rarely or never</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.hoursPerMonth" type="radio" :value="1">
              <span>1-5 hours</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.hoursPerMonth" type="radio" :value="6">
              <span>6-20 hours</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.hoursPerMonth" type="radio" :value="20">
              <span>20+ hours</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Overall mechanical confidence:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="formData.experience.level" type="radio" value="beginner">
              <span>Beginner - Learning basics</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.level" type="radio" value="intermediate">
              <span>Intermediate - Comfortable with common repairs</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.experience.level" type="radio" value="advanced">
              <span>Advanced - Tackle complex diagnostics</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Work types you've done (select all that apply):</label>
          <div class="checkbox-group">
            <label class="checkbox-option" v-for="workType in workTypeOptions" :key="workType.id">
              <input type="checkbox" :value="workType.id" v-model="formData.experience.workTypes">
              <span>{{ workType.label }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Step 2: Comfort Levels -->
      <div v-if="currentStep === 2" class="step">
        <h3>Comfort Level by System</h3>
        <p class="step-description">Rate your comfort working on each system (1 = Never done it, 5 = Very comfortable)</p>
        
        <div class="form-group">
          <label v-for="(value, system) in formData.experience.comfortLevel" :key="system">
            <div class="comfort-label">{{ capitalizeSystem(system) }}</div>
            <input type="range" v-model.number="formData.experience.comfortLevel[system]" min="1" max="5" class="range-slider">
            <span class="range-value">{{ formData.experience.comfortLevel[system] }}</span>
          </label>
        </div>
      </div>

      <!-- Step 3: Tools -->
      <div v-if="currentStep === 3" class="step">
        <h3>Tools & Diagnostic Equipment</h3>
        
        <div class="form-group">
          <label class="checkbox-option">
            <input v-model="formData.tools.hasBasicTools" type="checkbox">
            <span>Basic tools (screwdrivers, wrenches, sockets, etc.)</span>
          </label>
        </div>

        <div class="form-group">
          <label>Specialized tools you own (select all that apply):</label>
          <div class="checkbox-group">
            <label class="checkbox-option" v-for="tool in specializedToolsOptions" :key="tool.id">
              <input type="checkbox" :value="tool.id" v-model="formData.tools.specializedTools">
              <span>{{ tool.label }}</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>Diagnostic capability:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="formData.tools.diagnosticCapability" type="radio" value="none">
              <span>None - No diagnostic tools</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.tools.diagnosticCapability" type="radio" value="basic_obd2">
              <span>Basic - OBD2 scanner only</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.tools.diagnosticCapability" type="radio" value="advanced">
              <span>Advanced - Professional diagnostic equipment</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Step 4: Workspace -->
      <div v-if="currentStep === 4" class="step">
        <h3>Workspace & Conditions</h3>
        
        <div class="form-group">
          <label>Primary workspace type:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="formData.workspace.type" type="radio" value="driveway">
              <span>Driveway/street</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.workspace.type" type="radio" value="garage">
              <span>Garage/covered space</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.workspace.type" type="radio" value="professional_shop">
              <span>Professional shop/facility</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.workspace.type" type="radio" value="varies">
              <span>Varies depending on project</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-option">
            <input v-model="formData.workspace.hasLift" type="checkbox">
            <span>Access to vehicle lift or ramps</span>
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-option">
            <input v-model="formData.workspace.hasJackStands" type="checkbox">
            <span>Own jack stands and safety equipment</span>
          </label>
        </div>

        <div class="form-group">
          <label>Safety features in workspace (select all that apply):</label>
          <div class="checkbox-group">
            <label class="checkbox-option" v-for="feature in safetyFeaturesOptions" :key="feature.id">
              <input type="checkbox" :value="feature.id" v-model="formData.workspace.safetyFeatures">
              <span>{{ feature.label }}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Step 5: Support & Learning -->
      <div v-if="currentStep === 5" class="step">
        <h3>Support & Learning Preferences</h3>
        
        <div class="form-group">
          <label class="checkbox-option">
            <input v-model="formData.support.hasAccessToMechanic" type="checkbox">
            <span>I have access to a mechanic I can ask for help</span>
          </label>
        </div>

        <div class="form-group">
          <label class="checkbox-option">
            <input v-model="formData.support.hasTechnicalBackup" type="checkbox">
            <span>I have technical backup (friend, forums, videos, etc.)</span>
          </label>
        </div>

        <div class="form-group">
          <label>Preferred instruction style:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input v-model="formData.support.learningPreference" type="radio" value="step_by_step">
              <span>Step-by-step detailed instructions</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.support.learningPreference" type="radio" value="overview_focused">
              <span>Overview with key points highlighted</span>
            </label>
            <label class="radio-option">
              <input v-model="formData.support.learningPreference" type="radio" value="technical_details">
              <span>Technical details and specifications</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="assessment-actions">
      <button v-if="currentStep > 1" @click="previousStep" class="btn btn-secondary">Back</button>
      <button v-if="currentStep < totalSteps" @click="nextStep" class="btn btn-primary">Next</button>
      <button v-if="currentStep === totalSteps" @click="submitAssessment" class="btn btn-success">Complete Assessment</button>
    </div>

    <div class="assessment-summary" v-if="currentStep === totalSteps">
      <h4>Your Profile Summary</h4>
      <ul>
        <li v-for="(item, index) in capabilitySummary" :key="index">{{ item }}</li>
      </ul>
    </div>
  </div>
</template>

<script>
import { useMechanicalProfileStore } from '@/stores/mechanicalProfile';

export default {
  name: 'MechanicalAssessment',
  emits: ['assessment-complete', 'close'],
  
  data() {
    return {
      currentStep: 1,
      totalSteps: 5,
      
      formData: {
        experience: {
          level: 'beginner',
          hoursPerMonth: 0,
          yearsOfExperience: 0,
          workTypes: [],
          comfortLevel: {
            electrical: 1,
            engine: 1,
            transmission: 1,
            suspension: 1,
            diagnostics: 2
          }
        },
        tools: {
          hasBasicTools: true,
          specializedTools: [],
          diagnosticCapability: 'none'
        },
        workspace: {
          type: 'driveway',
          hasLift: false,
          hasJackStands: false,
          safetyFeatures: []
        },
        support: {
          hasAccessToMechanic: false,
          hasTechnicalBackup: false,
          learningPreference: 'step_by_step'
        }
      },
      
      workTypeOptions: [
        { id: 'oil_change', label: 'Oil changes' },
        { id: 'air_filter', label: 'Air/cabin filters' },
        { id: 'brake_pads', label: 'Brake pads' },
        { id: 'battery', label: 'Battery replacement' },
        { id: 'fluids', label: 'Fluid top-ups and changes' },
        { id: 'spark_plugs', label: 'Spark plugs' },
        { id: 'belts_hoses', label: 'Belts and hoses' },
        { id: 'suspension', label: 'Suspension work' },
        { id: 'brake_system', label: 'Brake system repairs' },
        { id: 'transmission_work', label: 'Transmission work' },
        { id: 'engine_work', label: 'Engine work' },
        { id: 'electrical', label: 'Electrical repairs' }
      ],
      
      specializedToolsOptions: [
        { id: 'multimeter', label: 'Multimeter' },
        { id: 'diagnostic_scanner', label: 'OBD2 diagnostic scanner' },
        { id: 'torque_wrench', label: 'Torque wrench' },
        { id: 'timing_tools', label: 'Timing tools' },
        { id: 'compression_tester', label: 'Compression tester' },
        { id: 'fuel_pressure_gauge', label: 'Fuel pressure gauge' },
        { id: 'coolant_system_tester', label: 'Coolant system tester' },
        { id: 'battery_tester', label: 'Battery tester' },
        { id: 'brake_bleeder', label: 'Brake bleeder kit' },
        { id: 'hoist_lift', label: 'Hoist or lift' }
      ],
      
      safetyFeaturesOptions: [
        { id: 'ventilation', label: 'Good ventilation' },
        { id: 'lighting', label: 'Adequate lighting' },
        { id: 'fire_extinguisher', label: 'Fire extinguisher' },
        { id: 'spill_kit', label: 'Spill containment kit' },
        { id: 'first_aid', label: 'First aid kit' },
        { id: 'safety_glasses', label: 'Safety glasses/PPE' }
      ]
    };
  },

  computed: {
    progressPercent() {
      return (this.currentStep / this.totalSteps) * 100;
    },
    
    capabilitySummary() {
      const store = useMechanicalProfileStore();
      return store.getCapabilitySummary;
    }
  },

  methods: {
    nextStep() {
      if (this.currentStep < this.totalSteps) {
        this.currentStep++;
      }
    },
    
    previousStep() {
      if (this.currentStep > 1) {
        this.currentStep--;
      }
    },
    
    submitAssessment() {
      const store = useMechanicalProfileStore();
      
      store.setExperience(this.formData.experience);
      store.setTools(this.formData.tools);
      store.setWorkspace(this.formData.workspace);
      store.setSupport(this.formData.support);
      store.completeAssessment();
      
      this.$emit('assessment-complete', store.getCompleteProfile);
    },
    
    capitalizeSystem(system) {
      const map = {
        electrical: 'Electrical',
        engine: 'Engine',
        transmission: 'Transmission',
        suspension: 'Suspension',
        diagnostics: 'Diagnostics'
      };
      return map[system] || system;
    }
  }
};
</script>

<style scoped>
.mechanical-assessment {
  max-width: 700px;
  margin: 0 auto;
  padding: 30px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.assessment-header {
  text-align: center;
  margin-bottom: 30px;
}

.assessment-header h2 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 24px;
}

.subtitle {
  color: #666;
  margin: 0 0 20px 0;
  font-size: 14px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin-bottom: 10px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #45a049);
  transition: width 0.3s ease;
}

.progress-text {
  color: #999;
  font-size: 12px;
  margin: 0;
}

.assessment-content {
  min-height: 400px;
  margin-bottom: 30px;
}

.step {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.step h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
}

.step-description {
  color: #666;
  margin: 0 0 20px 0;
  font-size: 14px;
}

.form-group {
  margin-bottom: 25px;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  color: #333;
  font-weight: 500;
  font-size: 14px;
}

.radio-group,
.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio-option,
.checkbox-option {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.radio-option input,
.checkbox-option input {
  margin-right: 10px;
  cursor: pointer;
}

.radio-option span,
.checkbox-option span {
  font-size: 14px;
  color: #555;
}

.radio-option:hover,
.checkbox-option:hover {
  color: #2196F3;
}

.radio-option input:checked + span,
.checkbox-option input:checked + span {
  color: #2196F3;
  font-weight: 500;
}

.comfort-label {
  display: inline-block;
  width: 130px;
  font-weight: 500;
  margin-bottom: 5px;
}

.range-slider {
  width: 200px;
  margin: 0 15px;
  vertical-align: middle;
}

.range-value {
  display: inline-block;
  min-width: 30px;
  text-align: center;
  color: #2196F3;
  font-weight: bold;
}

.assessment-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover {
  background: #1976D2;
}

.btn-secondary {
  background: #e0e0e0;
  color: #333;
}

.btn-secondary:hover {
  background: #d0d0d0;
}

.btn-success {
  background: #4CAF50;
  color: white;
}

.btn-success:hover {
  background: #45a049;
}

.assessment-summary {
  background: #f5f5f5;
  border-left: 4px solid #4CAF50;
  padding: 15px;
  border-radius: 4px;
}

.assessment-summary h4 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 14px;
}

.assessment-summary ul {
  margin: 0;
  padding-left: 20px;
}

.assessment-summary li {
  color: #555;
  font-size: 13px;
  margin-bottom: 5px;
}
</style>
