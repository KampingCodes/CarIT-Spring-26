export function extractMermaidCode(flowchart = '') {
  if (typeof flowchart !== 'string') {
    return '';
  }

  const match = flowchart.match(/```mermaid\s*([\s\S]*?)```/i);
  if (match) {
    return match[1].trim();
  }

  const trimmed = flowchart.trim();
  return trimmed.startsWith('graph TD') ? trimmed : '';
}

export function buildMermaidNodeMap(mermaidCode = '') {
  if (typeof mermaidCode !== 'string' || !mermaidCode.trim()) {
    return {};
  }

  const nodeMap = {};
  const nodePattern = /([A-Za-z0-9_]+)(?:\(\[(.*?)\]\)|\[(.*?)\]|\{(.*?)\}|\((.*?)\))/g;

  for (const line of mermaidCode.split('\n')) {
    let match;
    while ((match = nodePattern.exec(line)) !== null) {
      const nodeId = match[1];
      const label = [match[2], match[3], match[4], match[5]].find(Boolean) || nodeId;
      nodeMap[nodeId] = {
        nodeId,
        label: normalizeText(label)
      };
    }
  }

  return nodeMap;
}

export function resolveNodeSelection(selection, nodeMap = {}) {
  if (!selection) {
    return null;
  }

  const rawId = normalizeText(selection.nodeId || selection.rawId || '');
  const label = normalizeText(selection.label || '');
  const nodeIds = Object.keys(nodeMap);

  const idMatch = rawId
    ? nodeIds.find((nodeId) => rawId === nodeId || rawId.endsWith(`-${nodeId}`) || rawId.includes(`-${nodeId}-`) || rawId.includes(`${nodeId}-`))
    : '';

  if (idMatch) {
    return {
      nodeId: idMatch,
      label: nodeMap[idMatch]?.label || label || idMatch
    };
  }

  if (label) {
    const labelMatch = nodeIds.find((nodeId) => normalizeText(nodeMap[nodeId]?.label || '') === label);
    if (labelMatch) {
      return {
        nodeId: labelMatch,
        label: nodeMap[labelMatch]?.label || label
      };
    }
  }

  if (!rawId && !label) {
    return null;
  }

  return {
    nodeId: rawId || label,
    label: label || rawId
  };
}

export function normalizeDiagnosticResponses(responses = []) {
  if (!Array.isArray(responses)) {
    return [];
  }

  return responses
    .map((response) => {
      const question = normalizeText(response?.question);
      const answer = normalizeText(response?.answer) || normalizeText(response?.option);
      return question && answer
        ? { question, answer, option: answer }
        : null;
    })
    .filter(Boolean);
}

export function normalizeFlowchartRecord(record = {}, fallbackKey = 'legacy') {
  const source = typeof record === 'string'
    ? { flowchart: record }
    : (record && typeof record === 'object' ? record : {});

  const flowchart = typeof source.flowchart === 'string' ? source.flowchart : '';
  const rawMermaid = typeof source.mermaidCode === 'string' && source.mermaidCode.trim()
    ? source.mermaidCode
    : flowchart;

  return {
    ...source,
    flowchartId: typeof source.flowchartId === 'string' && source.flowchartId.trim()
      ? source.flowchartId
      : `legacy-${fallbackKey}`,
    flowchart,
    mermaidCode: extractMermaidCode(rawMermaid),
    vehicle: source.vehicle && typeof source.vehicle === 'object' ? source.vehicle : {},
    issues: typeof source.issues === 'string' ? source.issues : '',
    responses: normalizeDiagnosticResponses(source.responses),
    nodeContexts: normalizeNodeContexts(source.nodeContexts),
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : '',
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : (typeof source.createdAt === 'string' ? source.createdAt : ''),
    lastRefinedNodeId: typeof source.lastRefinedNodeId === 'string' ? source.lastRefinedNodeId : '',
    lastRefinedNodeLabel: typeof source.lastRefinedNodeLabel === 'string' ? source.lastRefinedNodeLabel : ''
  };
}

export function upsertFlowchartRecord(flowcharts = [], updatedRecord) {
  const normalizedRecord = normalizeFlowchartRecord(updatedRecord, updatedRecord?.flowchartId || 'updated');

  if (!normalizedRecord?.flowchartId) {
    return flowcharts;
  }

  const withoutExisting = flowcharts.filter((flowchart) => flowchart.flowchartId !== normalizedRecord.flowchartId);
  return sortFlowchartsByUpdatedAt([normalizedRecord, ...withoutExisting]);
}

export function sortFlowchartsByUpdatedAt(flowcharts = []) {
  return [...flowcharts].sort((left, right) => {
    const leftTime = Date.parse(left?.updatedAt || left?.createdAt || 0);
    const rightTime = Date.parse(right?.updatedAt || right?.createdAt || 0);
    return rightTime - leftTime;
  });
}

function normalizeText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}

function normalizeNodeContexts(nodeContexts = {}) {
  if (!nodeContexts || typeof nodeContexts !== 'object' || Array.isArray(nodeContexts)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(nodeContexts)
      .map(([nodeId, context]) => {
        if (!nodeId) {
          return null;
        }

        return [nodeId, {
          nodeId,
          nodeLabel: normalizeText(context?.nodeLabel || ''),
          guidedPromptKey: normalizeText(context?.guidedPromptKey || ''),
          guidedPromptLabel: normalizeText(context?.guidedPromptLabel || ''),
          freeText: normalizeText(context?.freeText || ''),
          lastMode: normalizeText(context?.lastMode || ''),
          updatedAt: typeof context?.updatedAt === 'string' ? context.updatedAt : ''
        }];
      })
      .filter(Boolean)
  );
}
