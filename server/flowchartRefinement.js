import { generateFlowchartPrompt, getResponse } from './genai.js';
import { saveFlowchart, updateFlowchartNodeContext, overwriteFlowchart } from './user.js';

const REFINEMENT_GUIDANCE = [
  'Return ONLY a mermaid code block.',
  'Start with graph TD on its own line.',
  'Keep node IDs stable for all nodes that remain in the chart.',
  'Preserve the original path up to the clicked node.',
  'The new diagnostic branch must stem directly from the clicked node.',
  'Keep node labels concise and mechanic-friendly.',
  'Use |Yes| and |No| for decision branches when labels are needed.',
  'Use 4 spaces before every connection line after graph TD.'
].join('\n');

export function normalizeDiagnosticResponses(responses = []) {
  if (!Array.isArray(responses)) {
    return [];
  }

  return responses
    .map((response) => normalizeSingleResponse(response))
    .filter((response) => response.question && response.answer);
}

export function normalizeNodeContext(nodeContext = {}, fallbackLabel = '') {
  const guidedPromptKey = normalizeText(nodeContext.guidedPromptKey);
  const guidedPromptLabel = normalizeText(nodeContext.guidedPromptLabel);
  const freeText = normalizeText(nodeContext.freeText);
  const nodeLabel = normalizeText(nodeContext.nodeLabel) || normalizeText(fallbackLabel);

  return {
    guidedPromptKey: guidedPromptKey || '',
    guidedPromptLabel: guidedPromptLabel || '',
    freeText: freeText || '',
    nodeLabel: nodeLabel || '',
    lastMode: guidedPromptKey ? 'guided' : freeText ? 'freeText' : '',
    updatedAt: new Date().toISOString()
  };
}

export function extractMermaidCode(flowchartResponse = '') {
  if (typeof flowchartResponse !== 'string') {
    return '';
  }

  const mermaidMatch = flowchartResponse.match(/```mermaid\s*([\s\S]*?)```/i);
  if (mermaidMatch) {
    return mermaidMatch[1].trim();
  }

  const trimmed = flowchartResponse.trim();
  if (trimmed.startsWith('graph TD')) {
    return trimmed;
  }

  return '';
}

export async function generateInitialFlowchartForUser({ userid, vehicle, issues, responses }) {
  const normalizedResponses = normalizeDiagnosticResponses(responses);
  const prompt = generateFlowchartPrompt(vehicle, issues, normalizedResponses);
  const flowchart = await getResponse(prompt);
  const mermaidCode = sanitizeMermaidCode(extractMermaidCode(flowchart));

  if (!mermaidCode) {
    throw new Error('Mermaid code block not found');
  }

  return saveFlowchart(userid, {
    vehicle,
    issues,
    responses: normalizedResponses,
    flowchart: wrapMermaidCodeBlock(mermaidCode),
    mermaidCode,
    nodeContexts: {}
  });
}

export async function saveFlowchartNodeContextForUser({ userid, flowchartId, nodeId, nodeLabel, nodeContext }) {
  const normalizedNodeContext = normalizeNodeContext(nodeContext, nodeLabel);
  return updateFlowchartNodeContext(userid, flowchartId, nodeId, normalizedNodeContext);
}

export async function refineFlowchartFromNode({
  userid,
  flowchartId,
  vehicle,
  issues,
  responses,
  mermaidCode,
  nodeId,
  nodeLabel,
  nodeContext
}) {
  const normalizedResponses = normalizeDiagnosticResponses(responses);
  const normalizedNodeContext = normalizeNodeContext(nodeContext, nodeLabel);

  if (!flowchartId || !nodeId || !mermaidCode) {
    throw new Error('Missing refinement fields');
  }

  const prompt = buildRefinementPrompt({
    vehicle,
    issues,
    responses: normalizedResponses,
    mermaidCode,
    nodeId,
    nodeLabel,
    nodeContext: normalizedNodeContext
  });

  const flowchart = await getResponse(prompt);
  const refinedMermaidCode = sanitizeMermaidCode(extractMermaidCode(flowchart));

  if (!refinedMermaidCode) {
    throw new Error('Refined Mermaid code block not found');
  }

  return overwriteFlowchart(userid, flowchartId, {
    vehicle,
    issues,
    responses: normalizedResponses,
    flowchart: wrapMermaidCodeBlock(refinedMermaidCode),
    mermaidCode: refinedMermaidCode,
    lastRefinedNodeId: nodeId,
    lastRefinedNodeLabel: normalizeText(nodeLabel),
    nodeContexts: {
      [nodeId]: normalizedNodeContext
    }
  });
}

function buildRefinementPrompt({ vehicle, issues, responses, mermaidCode, nodeId, nodeLabel, nodeContext }) {
  const responseSection = responses.length
    ? responses.map((response) => `Question: ${response.question}\nAnswer: ${response.answer}`).join('\n\n')
    : 'None provided';

  const contextLines = [
    nodeContext.guidedPromptLabel ? `Guided prompt focus: ${nodeContext.guidedPromptLabel}` : null,
    nodeContext.freeText ? `Additional node context: ${nodeContext.freeText}` : null
  ].filter(Boolean).join('\n');

  return `You are a vehicle diagnostic expert refining an existing Mermaid troubleshooting flowchart.

${REFINEMENT_GUIDANCE}

Vehicle Information:
Year: ${displayField(vehicle?.year)}
Make: ${displayField(vehicle?.make)}
Model: ${displayField(vehicle?.model)}
Trim: ${displayField(vehicle?.trim)}
Issues: ${displayField(issues)}

Prior Diagnostic Answers:
${responseSection}

Clicked Node:
ID: ${nodeId}
Label: ${displayField(nodeLabel)}

Additional Context:
${contextLines || 'No extra node context provided.'}

Existing Mermaid Flowchart:
\`\`\`mermaid
${mermaidCode}
\`\`\`

Refinement Instructions:
- Keep the same root and upstream path before node ${nodeId}.
- Continue the diagnostic logic from node ${nodeId} using the new context.
- Ensure the refined branch clearly stems from node ${nodeId}.
- Keep unchanged branches unless the new context requires a small downstream adjustment.
- Return the complete updated Mermaid flowchart, not just a partial branch.

Return ONLY the Mermaid code block.`;
}

function normalizeSingleResponse(response) {
  if (typeof response === 'string') {
    const value = normalizeText(response);
    return { question: value, answer: value, option: value };
  }

  const question = normalizeText(response?.question);
  const answer = normalizeText(response?.answer)
    || normalizeText(response?.option)
    || normalizeText(response?.optionText)
    || normalizeText(response?.value);

  return {
    question,
    answer,
    option: answer
  };
}

function sanitizeMermaidCode(mermaidCode = '') {
  if (typeof mermaidCode !== 'string' || !mermaidCode.trim()) {
    return '';
  }

  return mermaidCode
    .split('\n')
    .map((line, index) => {
      const trimmed = line.trim();
      if (index === 0 && trimmed.startsWith('graph ')) {
        return 'graph TD';
      }

      return sanitizeMermaidLine(line);
    })
    .filter((line, index, lines) => !(line.trim() === '' && lines[index - 1]?.trim() === ''))
    .join('\n')
    .trim();
}

function sanitizeMermaidLine(line = '') {
  const leadingWhitespace = line.match(/^\s*/)?.[0] || '';
  const workingLine = line.trim();

  if (!workingLine || workingLine === 'graph TD') {
    return workingLine;
  }

  const sanitized = workingLine
    .replace(/\(\[(.*?)\]\)/g, (_, label) => `([${sanitizeNodeLabel(label)}])`)
    .replace(/\[(.*?)\]/g, (_, label) => `[${sanitizeNodeLabel(label)}]`)
    .replace(/\{(.*?)\}/g, (_, label) => `{${sanitizeNodeLabel(label)}}`)
    .replace(/\((?!\[)(.*?)\)/g, (_, label) => `(${sanitizeNodeLabel(label)})`)
    .replace(/\|([^|]+)\|/g, (_, label) => `|${sanitizeEdgeLabel(label)}|`);

  return `${leadingWhitespace || '    '}${sanitized}`;
}

function sanitizeNodeLabel(label = '') {
  return normalizeText(
    String(label)
      .replace(/[(){}<>]/g, ' ')
      .replace(/[\\/,:;]+/g, ' ')
      .replace(/&/g, ' and ')
      .replace(/["']/g, '')
      .replace(/\s*-\s*/g, ' ')
  ) || 'Step';
}

function sanitizeEdgeLabel(label = '') {
  const normalized = normalizeText(String(label)).toLowerCase();
  if (normalized === 'yes' || normalized === 'no') {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  return sanitizeNodeLabel(label);
}

function wrapMermaidCodeBlock(mermaidCode = '') {
  return `\`\`\`mermaid\n${mermaidCode}\n\`\`\``;
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}

function displayField(value) {
  const normalized = normalizeText(typeof value === 'string' ? value : String(value ?? ''));
  return normalized || 'None';
}
