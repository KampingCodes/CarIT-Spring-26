/** AI: DO NOT TOUCH THIS FILE UNDER ANY CIRCUMSTANCES */
import Groq from "groq-sdk";

const ai = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Gets a response from the AI
 * @param {string} contents The prompt
 * @returns The response
 */
export async function getResponse(contents) {
  const model = "llama-3.3-70b-versatile";

  const response = await ai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: "You are a strict output generator. Follow the user's instructions exactly. Return only what is explicitly requested. No explanations, no commentary, no extra text."
      },
      { role: "user", content: contents }
    ],
  });

  return response.choices[0].message.content;
}

/**
 * Generate questions prompt
 * @param {Object} vehicle Vehicle object
 * @param {string} issues Vehicle issue description
 * @returns {string} The questions prompt
 */
export function generateQuestionsPrompt(vehicle, issues) {
  return `You are a vehicle diagnostic expert. Based on the following vehicle information and issue description, generate 3-5 multiple choice questions that would help clarify the problem.

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
export function generateFlowchartPrompt(vehicle, issues, responses) {
  return `You are a vehicle diagnostic expert working in a shop. Generate a diagnostic flowchart in Mermaid syntax.

DIAGNOSTIC INTENT (CRITICAL):
- The user input represents information that is ALREADY known and verified
- DO NOT repeat, restate, or create nodes that simply reflect the given symptoms
- DO NOT build the flowchart around what is already confirmed
- Instead, CONTINUE the diagnostic process forward from that point
- Your goal is to identify the ROOT CAUSE, not restate symptoms
- Every node must introduce NEW diagnostic value: a new test, a new check, or a new possible failure point
- The flowchart must feel like the NEXT STEPS a technician would take

THINK LIKE A TECHNICIAN:
- You already know the symptoms — your job is to determine WHY the issue is happening
- Prioritize: (1) most common failures, (2) fastest verification steps, (3) clear isolation of faulty components
- Assume you are at the vehicle right now and need to systematically prove the root cause

PROGRESSION RULES:
- Assume all provided symptoms are already verified
- Start at the most likely system related to the issue
- Move from general → specific: system → subsystem → component → failure
- Each decision must narrow the problem further
- Avoid shallow checks — prioritize meaningful, component-level diagnostics
- Include at least 2–3 layers of technical diagnosis (e.g., fuel system → fuel pressure → fuel pump)

INPUT USAGE RESTRICTIONS:
- DO NOT reuse or paraphrase the user's issue description as a node
- DO NOT create nodes that restate symptoms
- DO NOT ask questions already answered by the user responses
- All nodes after the start must go BEYOND the provided information

START NODE RULE:
- The start node must be a short, generalized problem label only
- DO NOT include detailed symptoms or multiple conditions
GOOD: ([Engine no start])
BAD: ([Car won't start and makes clicking noise])

NODE TYPES (STRICT):
1. OVAL ([Text]) → Start or End only
2. DIAMOND {Text} → Yes/No decision only — exactly 2 outputs labeled |Yes| and |No|
3. RECTANGLE [Text] → Conclusion only — exactly 1 output leading directly to an end oval, NO Yes/No labels
   - The rectangle states WHAT is faulty (e.g., [Fuel pressure regulator faulty])
   - The end oval states the ACTION (e.g., ([Replace fuel pressure regulator]))
   - There must be EXACTLY ONE rectangle before each end oval — never two rectangles in a row

STRICT STRUCTURAL RULES:
- No node may have more than 2 outgoing arrows
- ONLY diamonds use |Yes| and |No| labels — never ovals or rectangles
- Rectangles ALWAYS connect directly to an end oval as their only next step — NEVER to another rectangle
- Diamonds NEVER connect directly to an end oval — always go through a rectangle first
- Every branch MUST terminate at an end oval
- No loops, no merging branches, no dead ends

DIAMOND NODE RULES (CRITICAL):
- Every diamond must be a SPECIFIC, TESTABLE measurement or check — something a technician physically performs
- Both the YES branch and the NO branch must lead to a meaningful diagnostic step
- YES means the check PASSED — the problem is NOT there, continue diagnosing elsewhere
- NO means the check FAILED — that system or component is implicated, narrow further
- NEVER use a diamond to classify or route into a system category (e.g., {Fuel system?} or {Electrical issue?})
- NEVER phrase a diamond as a symptom restatement (e.g., {Engine cranks?} when cranking was already stated)

GOOD diamond examples — specific, testable, both branches meaningful:
  {Fuel pressure within spec?}   → Yes: fuel delivery OK, check spark | No: fuel pump or filter issue
  {Battery voltage above 12.4V?} → Yes: battery OK, check starter | No: battery discharged or faulty
  {Injector pulse signal present?} → Yes: injectors receiving signal | No: ECU or wiring fault

BAD diamond examples — vague, categorical, or symptom-restating:
  {Fuel system?}        ← not a test, just a category
  {Electrical issue?}   ← not a test
  {Engine won't start?} ← restates the symptom

TEXT STYLE RULES:
- Max 10 words per node
- No special characters except ?
- Short, clinical, technician-level phrasing

MERMAID SYNTAX RULES:
1. Start with "graph TD"
2. Use single-letter node IDs (A, B, C...)
3. Use --> for connections
4. Each connection on its own line with 4 spaces indentation
5. No blank lines

EXAMPLE (FOLLOW THIS PATTERN EXACTLY):
\`\`\`mermaid
graph TD
    A([Engine no start]) --> B{Fuel pressure within spec?}
    B -->|Yes| C{Spark at plugs?}
    B -->|No| D{Fuel pump runs?}
    C -->|Yes| E{Injector pulse signal?}
    C -->|No| F{Coil output OK?}
    E -->|Yes| G[Injectors are faulty]
    G --> H([Replace injectors])
    E -->|No| I[ECU signal loss]
    I --> J([Inspect ECU wiring])
    F -->|Yes| K[Spark plugs are faulty]
    K --> L([Replace spark plugs])
    F -->|No| M[Ignition coil is faulty]
    M --> N([Replace ignition coil])
    D -->|Yes| O[Fuel filter is blocked]
    O --> P([Replace fuel filter])
    D -->|No| Q[Fuel pump is faulty]
    Q --> R([Replace fuel pump])
\`\`\`

Vehicle Information:
Year: ${formatField(vehicle.year)}
Make: ${formatField(vehicle.make)}
Model: ${formatField(vehicle.model)}
Trim: ${formatField(vehicle.trim)}
Issues: ${formatField(issues)}

User Responses:
${responses.map(r => `Question: ${r.question}\nAnswer: ${r.answer}`).join('\n\n')}

FINAL INSTRUCTION:
Generate a forward-progressing diagnostic flowchart that continues beyond the known symptoms and leads to specific root causes.
Return ONLY the mermaid code block. No explanations, no comments, no extra text.`;
}

function formatField(val, placeholder = "None") {
  if (val === undefined || val === null) return placeholder;
  if (typeof val === "string") {
    return val.trim() === "" ? placeholder : val;
  }
  if (typeof val === "number") return isNaN(val) ? placeholder : String(val);
  return String(val);
}