import { defineStore } from 'pinia';

export const useMechanicalProfileStore = defineStore('mechanicalProfile', {
  state: () => ({
    hasCompletedAssessment: false,
    
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
  }),

  getters: {
    getCompleteProfile: (state) => {
      return {
        hasCompletedAssessment: state.hasCompletedAssessment,
        experience: state.experience,
        tools: state.tools,
        workspace: state.workspace,
        support: state.support
      };
    },

    getCapabilitySummary: (state) => {
      const profile = state;
      const summary = [];
      
      // Experience
      if (profile.experience.level) {
        summary.push(`Experience: ${profile.experience.level}`);
      }
      if (profile.experience.yearsOfExperience > 0) {
        summary.push(`${profile.experience.yearsOfExperience} years of experience`);
      }
      
      // Tools
      if (profile.tools.specializedTools.length > 0) {
        summary.push(`Tools: ${profile.tools.specializedTools.join(', ')}`);
      }
      if (profile.tools.diagnosticCapability !== 'none') {
        summary.push(`Diagnostic: ${profile.tools.diagnosticCapability}`);
      }
      
      // Workspace
      summary.push(`Workspace: ${profile.workspace.type}`);
      if (profile.workspace.hasLift) summary.push('Has lift');
      if (profile.workspace.hasJackStands) summary.push('Has jack stands');
      
      // Support
      if (profile.support.hasAccessToMechanic) summary.push('Access to mechanic');
      if (profile.support.hasTechnicalBackup) summary.push('Technical backup available');
      
      return summary;
    }
  },

  actions: {
    setExperience(experienceData) {
      this.experience = { ...this.experience, ...experienceData };
    },

    setTools(toolsData) {
      this.tools = { ...this.tools, ...toolsData };
    },

    setWorkspace(workspaceData) {
      this.workspace = { ...this.workspace, ...workspaceData };
    },

    setSupport(supportData) {
      this.support = { ...this.support, ...supportData };
    },

    completeAssessment() {
      this.hasCompletedAssessment = true;
    },

    resetToDefaults() {
      this.hasCompletedAssessment = false;
      this.experience = {
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
      };
      this.tools = {
        hasBasicTools: true,
        specializedTools: [],
        diagnosticCapability: 'none'
      };
      this.workspace = {
        type: 'driveway',
        hasLift: false,
        hasJackStands: false,
        safetyFeatures: []
      };
      this.support = {
        hasAccessToMechanic: false,
        hasTechnicalBackup: false,
        learningPreference: 'step_by_step'
      };
    }
  }
});
