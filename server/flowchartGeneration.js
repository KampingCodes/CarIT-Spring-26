import { randomUUID } from 'crypto';
import { generateFlowchartPrompt, getResponse } from './genai.js';
import { saveFlowchart, upsertCar } from './user.js';

export async function generateInitialFlowchartForUser({ userid, vehicle, issues, responses, persist = Boolean(userid) }) {
  const normalizedResponses = normalizeDiagnosticResponses(responses);
  const prompt = generateFlowchartPrompt(vehicle, issues, normalizedResponses);
  const flowchart = await getResponse(prompt);
  const mermaidCode = sanitizeMermaidCode(extractMermaidCode(flowchart));

  if (!mermaidCode) {
    throw new Error('Mermaid code block not found');
  }

  await ensureVehicleExists(vehicle);

  const recordPayload = {
    vehicle,
    issues,
    responses: normalizedResponses,
    flowchart: wrapMermaidCodeBlock(mermaidCode),
    mermaidCode,
    nodeContexts: {}
  };

  if (persist) {
    return saveFlowchart(userid, recordPayload);
  }

  const timestamp = new Date().toISOString();
  return {
    flowchartId: `guest-${randomUUID()}`,
    ...recordPayload,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastRefinedNodeId: '',
    lastRefinedNodeLabel: '',
    sessionOnly: true,
    saveDisabled: true
  };
}

function normalizeDiagnosticResponses(responses = []) {
  if (!Array.isArray(responses)) {
    return [];
  }

  return responses
    .map((response) => normalizeSingleResponse(response))
    .filter((response) => response.question && response.answer);
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

function extractMermaidCode(flowchartResponse = '') {
  if (typeof flowchartResponse !== 'string') {
    return '';
  }

  // Match ```mermaid ... ``` (preferred)
  const mermaidMatch = flowchartResponse.match(/```mermaid\s*([\s\S]*?)```/i);
  if (mermaidMatch) {
    return mermaidMatch[1].trim();
  }

  // Match plain ``` ... ``` block that contains a graph TD declaration
  const plainCodeMatch = flowchartResponse.match(/```[^\S\r\n]*\r?\n([\s\S]*?)```/i);
  if (plainCodeMatch && /graph\s+TD/i.test(plainCodeMatch[1])) {
    return plainCodeMatch[1].trim();
  }

  // Match bare graph TD block anywhere in the response
  const graphMatch = flowchartResponse.match(/(graph\s+TD[\s\S]*?)(?:\n\n|$)/i);
  if (graphMatch) {
    return graphMatch[1].trim();
  }

  const trimmed = flowchartResponse.trim();
  if (/^graph\s+TD/i.test(trimmed)) {
    return trimmed;
  }

  return '';
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
      .replace(/[\\/:;,.]+/g, ' ')
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

async function ensureVehicleExists(vehicle) {
  const result = await upsertCar(vehicle);
  if (typeof result === 'string') {
    return null;
  }

  return result;
}
