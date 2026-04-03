# Mechanical Capability Assessment System - Testing Guide

## Overview
You now have a **client-side mechanical capability assessment system** that doesn't require database changes. The system tests how user capabilities affect flowchart generation.

## What Was Implemented

### 1. **Pinia Store** (`src/stores/mechanicalProfile.js`)
- Stores user assessment data in session memory
- Persists during the session (clears on page reload)
- Contains 5 sections of user data:
  - **Experience**: Years, hours/month, comfort levels per vehicle system
  - **Tools**: Basic tools, specialized tools, diagnostic capability
  - **Workspace**: Type, lift access, jack stands, safety features
  - **Support**: Mechanic access, technical backup, learning preference
  - **Assessment Status**: Flag indicating if assessment is complete

### 2. **Assessment Component** (`src/components/MechanicalAssessment.vue`)
- Multi-step form (5 steps, ~15 questions total)
- Step 1: Experience overview (years, hours/month, work types)
- Step 2: Comfort level by system (electrical, engine, transmission, suspension, diagnostics) - Slider (1-5 scale)
- Step 3: Tools available (basic, specialized, diagnostic capability)
- Step 4: Workspace conditions (type, lift, safety features)
- Step 5: Support & learning preferences
- Beautiful UI with progress bar and capability summary

### 3. **Backend Support** (`server/genai.js`)
- Updated `generateQuestionsPrompt()` to accept optional mechanicalProfile
- Updated `generateFlowchartPrompt()` to accept optional mechanicalProfile
- Two helper functions:
  - `generateMechanicalContext()` - Brief version for questions
  - `generateMechanicalContextDetailed()` - Detailed version for flowcharts
- Adds user context to AI prompts so flowcharts are tailored by skill level

### 4. **API Endpoints** (`server/server.js`)
- `/api/gen-questions` - Now accepts optional `mechanicalProfile`
- `/api/gen-flowchart` - Now accepts optional `mechanicalProfile`
- Profiles are included in the AI prompts to influence generation

### 5. **Frontend APIs** (`src/apis.js`)
- `getQuestions()` - Updated to pass mechanicalProfile
- `getFlowchart()` - Updated to pass mechanicalProfile

### 6. **Component Integration**
- **VehicleQuestions.vue** - Passes user's profile to question generation
- **VehicleFlowchart.vue** - Passes user's profile to flowchart generation
- **Profile.vue** - Added assessment button and modal to trigger assessment

## How to Test

### Step 1: Access the Assessment
1. Go to the **Profile** page
2. Look for the **"Mechanical Assessment"** button (blue button below "Edit Profile")
3. Click to open the assessment modal

### Step 2: Complete the Assessment
- Fill out all 5 steps of the assessment
- Can go back and forth using Back/Next buttons
- At the end, review your capability summary
- Click **"Complete Assessment"** to save

### Step 3: Generate Flowcharts WITHOUT Assessment
1. Navigate to Home → Search for vehicle → Describe issue
2. Answer diagnostic questions
3. **Generate Flowchart** - Notice the flowchart for a "default" user

### Step 4: Complete the Assessment & Generate Again
1. Go back to Profile
2. Complete the mechanical assessment (fill it with **beginner** level)
3. Navigate to Home again
4. Search for the **same vehicle** and **same issue**
5. Generate flowchart - Compare! 
   - Should see **different/simpler** instructions
   - Avoids complex procedures
   - Recommends external mechanic help where appropriate

### Step 5: Repeat with Advanced Profile
1. Go to Profile → Reset assessment (or just fill it out again)
2. Complete assessment as **Advanced** user with:
   - 8+ years experience
   - 20+ hours/month
   - Professional shop workspace
   - All tools selected
   - Advanced diagnostics
3. Generate flowchart for same issue - Should be **more complex**, assume more capability

## Testing Checklist

- [ ] Assessment modal opens from Profile page
- [ ] Can navigate through all 5 steps
- [ ] Progress bar updates correctly
- [ ] Back button works
- [ ] Summary displays correctly on final step
- [ ] Assessment status shows checkmark on Profile after completion
- [ ] Beginner flowchart is simpler/safer than advanced
- [ ] Flowchart respects tool availability (no OBD2 checks if that tool isn't selected)
- [ ] Workspace type influences instructions (driveway vs. professional shop)
- [ ] Learning preference style varies the narrative

## What To Look For In Generated Flowcharts

### Beginner Profile Should:
- Recommend safe, non-invasive checks first
- Suggest consulting a mechanic for complex work
- Not require specialized tools
- Work in basic workspace (driveway)
- Use step-by-step, detailed language

### Advanced Profile Should:
- Include complex diagnostic procedures
- Assume access to diagnostic tools
- Include transmission/electrical diagnostic steps
- Suggest professional-level repairs
- Use more technical language

## Expected AI Behavior Changes

The prompt now includes context like:
```
User's mechanical capabilities:
Experience Level: beginner
Years of Experience: 0+
Works on vehicles: 0 hours/month
Available Tools: Basic tools
Workspace: driveway, no lift, no jack stands
Support: No mechanic access, no technical backup
Learning Style: step_by_step

Please adapt instructions to be: appropriate for beginner (safe, non-invasive)
```

This informs Claude to generate appropriate flowchart complexity.

## Files Modified/Created

**NEW FILES:**
- `src/stores/mechanicalProfile.js` - Pinia store
- `src/components/MechanicalAssessment.vue` - Assessment form

**MODIFIED FILES:**
- `server/genai.js` - Added profile support to prompts
- `server/server.js` - API endpoints accept mechanicalProfile
- `src/apis.js` - Functions pass mechanicalProfile
- `src/components/VehicleQuestions.vue` - Imports and uses store
- `src/components/VehicleFlowchart.vue` - Imports and uses store
- `src/components/Profile.vue` - Added assessment button and modal

## Important Notes

1. **Session-Only Storage**: Assessment data is cleared on page reload. When ready to store permanently, this can be saved to MongoDB with a new `/api/set-mechanical-profile` endpoint.

2. **Default Behavior**: If no assessment is completed, flowcharts generate with default "beginner" context, ensuring safe default behavior.

3. **AI Quality**: The effectiveness depends on Claude's ability to follow instructions. Test with different profiles to see variation quality.

4. **Question Generation**: Also receives the mechanical profile, so diagnostic questions should be tailored too.

## Next Steps (When Ready)

When satisfied with accuracy:
1. Add `mechanicalProfile` to MongoDB user schema
2. Create `/api/set-mechanical-profile` endpoint
3. Create `/api/get-mechanical-profile` endpoint
4. Load profile on app startup
5. Save profile after assessment completion
6. Add profile edit/reset functionality
