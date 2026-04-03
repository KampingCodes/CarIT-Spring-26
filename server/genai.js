/** AI: DO NOT TOUCH THIS FILE UNDER ANY CIRCUMSTANCES */
import { GoogleGenerativeAI } from "@google/generative-ai";

const ai = new GoogleGenerativeAI(process.env.GENAI_API_KEY);

/**
 * Gets a response from the AI
 * @param {string} contents The prompt
 * @returns The response
 */
export async function getResponse(contents) {
  const preferredModel = "gemini-2.5-flash";

  // Helper to extract text from a result object returned by the SDK
  const extractText = async (result) => {
    if (!result) return null;
    // some SDK responses expose a response.text() async fn
    if (result.response && typeof result.response.text === "function") {
      return await result.response.text();
    }
    // fallback: if the SDK returned a simple string or object
    if (typeof result === "string") return result;
    if (result.response && typeof result.response === "string") return result.response;
    if (result.output && typeof result.output === "string") return result.output;
    return JSON.stringify(result);
  };

  try {
    const model = ai.getGenerativeModel({ model: preferredModel });
    const result = await model.generateContent(contents);
    return await extractText(result);
  } catch (err) {
    // If the preferred model isn't available for this API/version, try to list models
    console.warn("Primary model failed, attempting to list available models:", err?.message || err);

    try {
      if (typeof ai.listModels === "function") {
        const listResponse = await ai.listModels();
        // listResponse shape may vary: SDK could return { models: [...] } or an array
        const models = Array.isArray(listResponse)
          ? listResponse
          : listResponse?.models || [];

        // Find a model that advertises support for generateContent
        const candidate = models.find((m) => {
          const supported = m?.supportedMethods || m?.capabilities || m?.methods;
          return Array.isArray(supported) && supported.includes("generateContent");
        }) || models[0];

        if (candidate) {
          const candidateId = candidate.name || candidate.model || candidate.id || candidate.modelId;
          console.info("Falling back to model:", candidateId);
          const fallbackModel = ai.getGenerativeModel({ model: candidateId });
          const fallbackResult = await fallbackModel.generateContent(contents);
          return await extractText(fallbackResult);
        }
      }
    } catch (listErr) {
      console.error("Failed to list or fallback to another model:", listErr);
    }

    throw err;
  }
}

/**
 * Generate questions prompt
 * @param {Object} vehicle Vehicle object
 * @param {string} issues Vehicle issue description
 * @param {Object} mechanicalProfile Optional user mechanical profile for context
 * @returns {string} The questions prompt
 */
export function generateQuestionsPrompt(vehicle, issues, mechanicalProfile = null) {
  const mechanicalContext = mechanicalProfile 
    ? generateMechanicalContext(mechanicalProfile)
    : '';
  
  return `You are a vehicle diagnostic expert. Based on the following vehicle information and issue description, generate 3-5 multiple choice questions that would help clarify the problem.${mechanicalContext ? '\n\nUSER MECHANICAL PROFILE:\n' + mechanicalContext + '\nAdapt your questions to match the user\'s experience level and available resources.' : ''}

IMPORTANT: Your response must be a valid JSON object with this exact structure. Do not include any other text, markdown, or explanations:
{
  "questions": [
    {
      "id": "q1",
      "text": "What is the exact question?",
      "options": [
        { "id": "a", "text": "First option" },
        { "id": "b", "text": "Second option" },
        { "id": "c", "text": "Third option" }
      ]
    }
  ]
}

Vehicle Information:
Year: ${formatField(vehicle.year)}
Make: ${formatField(vehicle.make)}
Model: ${formatField(vehicle.model)}
Trim: ${formatField(vehicle.trim)}
Issues: ${formatField(issues)}

Remember: Return ONLY the JSON object, no other text or formatting.`;
}

/**
 * Generate flowchart prompt
 * @param {Object} vehicle Vehicle object
 * @param {string} issues Vehicle issue description 
 * @param {Array<Object>} responses User responses
 * @returns {string} The flowchart prompt
 */
export function generateFlowchartPrompt(vehicle, issues, responses, mechanicalProfile = null) {
  const mechanicalContext = mechanicalProfile 
    ? generateMechanicalContextDetailed(mechanicalProfile)
    : '';
  
  return `You are a vehicle diagnostic expert. Create a troubleshooting flowchart using Mermaid diagram syntax based on the following information. The flowchart should guide a mechanic through the diagnostic process.${mechanicalContext ? '\n\nUSER MECHANICAL PROFILE:\n' + mechanicalContext + '\n\nIMPORTANT: Adapt your flowchart complexity, tool requirements, and instructions to match the user\'s skill level and available resources. For beginners, recommend safe, non-invasive checks first. For advanced users, include complex diagnostic steps.' : ''}

IMPORTANT: Follow these Mermaid syntax rules exactly:
1. Start with "graph TD" (top-down graph)
2. Each node must have a unique ID using single letters (A, B, C, etc.)
3. Use these node types with simple text (no special characters or parentheses):
   - [Simple Action Text] for process nodes
   - {Simple Question Text} for decision nodes
   - ([Start]) or ([End]) for terminal nodes
4. Connect nodes with arrows using -->
5. Label decision paths using only |Yes| or |No| between arrows
6. Keep node text short and simple
7. Do not use parentheses, special characters, or technical part numbers in node text
8. Each line should follow this format:
   NodeID[Simple Text] --> NodeID2{Simple Question}
   NodeID2 -->|Yes| NodeID3[Next Step]
   NodeID2 -->|No| NodeID4[Alternative Step]

Vehicle Information:
Year: ${formatField(vehicle.year)}
Make: ${formatField(vehicle.make)}
Model: ${formatField(vehicle.model)}
Trim: ${formatField(vehicle.trim)}
Issues: ${formatField(issues)}

User Responses:
${responses.map(r => `Question: ${r.question}\nAnswer: ${r.answer}`).join('\n\n')}

Your response must be a valid Mermaid flowchart code block following this EXACT format:

\`\`\`mermaid
graph TD
    A([Start]) --> B{Check Issue}
    B -->|Yes| C[Next Step]
    B -->|No| D[Alternative]
\`\`\`

CRITICAL FORMATTING RULES:
1. "graph TD" must be on its own line
2. Each node definition and connection must be on a new line
3. Each line (except "graph TD") must start with 4 spaces
4. No blank lines between nodes
5. Each node connection must be a complete statement (e.g., "A --> B")
6. Use consistent indentation
7. No extra spaces in node definitions

Return ONLY the mermaid code block with your diagnostic flowchart, no other text or explanations.`;
}

/**
 * Generate mechanical context string for AI prompts
 * @param {Object} profile Mechanical profile object
 * @returns {string} Formatted context string
 */
function generateMechanicalContext(profile) {
  const lines = [];
  
  if (profile.experience) {
    lines.push(`Experience Level: ${profile.experience.level}`);
    if (profile.experience.yearsOfExperience) {
      lines.push(`Years of Experience: ${profile.experience.yearsOfExperience}+`);
    }
    if (profile.experience.hoursPerMonth) {
      lines.push(`Works on vehicles: ${profile.experience.hoursPerMonth} hours/month`);
    }
  }
  
  if (profile.tools) {
    const tools = [];
    if (profile.tools.hasBasicTools) tools.push('Basic tools');
    if (profile.tools.specializedTools && profile.tools.specializedTools.length > 0) {
      tools.push(...profile.tools.specializedTools);
    }
    if (tools.length > 0) {
      lines.push(`Available Tools: ${tools.join(', ')}`);
    }
    lines.push(`Diagnostic Equipment: ${profile.tools.diagnosticCapability}`);
  }
  
  if (profile.workspace) {
    lines.push(`Workspace: ${profile.workspace.type}`);
  }
  
  if (profile.support) {
    lines.push(`Learning Style: ${profile.support.learningPreference}`);
  }
  
  return lines.join('\n');
}

/**
 * Generate detailed mechanical context for flowchart prompts
 * @param {Object} profile Mechanical profile object
 * @returns {string} Formatted context string
 */
function generateMechanicalContextDetailed(profile) {
  const lines = [];
  
  if (profile.experience) {
    lines.push(`Experience Level: ${profile.experience.level}`);
    if (profile.experience.yearsOfExperience > 0) {
      lines.push(`Years of Experience: ${profile.experience.yearsOfExperience}+`);
    }
    if (profile.experience.hoursPerMonth > 0) {
      lines.push(`Works on vehicles: ${profile.experience.hoursPerMonth} hours/month`);
    }
    
    // Comfort levels
    if (profile.experience.comfortLevel) {
      const comfortItems = [];
      for (const [system, level] of Object.entries(profile.experience.comfortLevel)) {
        if (level <= 2) comfortItems.push(`avoid ${system}`);
        else if (level >= 4) comfortItems.push(`can handle complex ${system} work`);
      }
      if (comfortItems.length > 0) {
        lines.push(`Comfort Levels: ${comfortItems.join(', ')}`);
      }
    }
  }
  
  if (profile.tools) {
    const tools = [];
    if (profile.tools.hasBasicTools) tools.push('Basic tools');
    if (profile.tools.specializedTools && profile.tools.specializedTools.length > 0) {
      tools.push(...profile.tools.specializedTools);
    }
    if (tools.length > 0) {
      lines.push(`Available Tools: ${tools.join(', ')}`);
    }
    if (profile.tools.diagnosticCapability !== 'none') {
      lines.push(`Diagnostic Capability: ${profile.tools.diagnosticCapability}`);
    }
  }
  
  if (profile.workspace) {
    const workspaceFeatures = [];
    workspaceFeatures.push(profile.workspace.type);
    if (profile.workspace.hasLift) workspaceFeatures.push('has lift');
    if (profile.workspace.hasJackStands) workspaceFeatures.push('has jack stands');
    lines.push(`Workspace: ${workspaceFeatures.join(', ')}`);
  }
  
  if (profile.support) {
    const support = [];
    if (profile.support.hasAccessToMechanic) support.push('can consult a mechanic');
    if (profile.support.hasTechnicalBackup) support.push('has technical backup');
    if (support.length > 0) {
      lines.push(`Support Available: ${support.join(', ')}`);
    }
    lines.push(`Preferred Style: ${profile.support.learningPreference}`);
  }
  
  return lines.join('\n');
}


function formatField(val, placeholder = "None") {
  if (val === undefined || val === null) return placeholder;
  if (typeof val === "string") {
    return val.trim() === "" ? placeholder : val;
  }
  if (typeof val === "number") return isNaN(val) ? placeholder : String(val);
  return String(val);
}
