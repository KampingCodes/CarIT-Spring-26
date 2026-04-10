/**
 * Returns a mermaid.initialize() config object that matches the site's
 * light or dark theme palette.
 */
export function getMermaidConfig(isDark = false) {
  if (!isDark) {
    return {
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
      flowchart: { htmlLabels: true, curve: 'basis' }
    };
  }

  return {
    startOnLoad: false,
    securityLevel: 'loose',
    theme: 'base',
    themeVariables: {
      // Overall canvas
      background:            '#22222c',
      // Primary nodes (rectangles, etc.)
      primaryColor:          '#2c2c3a',
      primaryTextColor:      '#eaeaf6',
      primaryBorderColor:    '#38384e',
      // Secondary / tertiary nodes
      secondaryColor:        '#1e1e27',
      secondaryTextColor:    '#b0b0cc',
      secondaryBorderColor:  '#38384e',
      tertiaryColor:         '#18181f',
      tertiaryTextColor:     '#b0b0cc',
      tertiaryBorderColor:   '#38384e',
      // Lines and labels
      lineColor:             '#6090ff',
      edgeLabelBackground:   '#2c2c3a',
      // Special node types
      clusterBkg:            '#1e1e27',
      clusterBorder:         '#38384e',
      titleColor:            '#eaeaf6',
      // Note nodes
      noteBkgColor:          '#2c2c3a',
      noteTextColor:         '#eaeaf6',
      noteBorderColor:       '#38384e',
      // Font
      fontFamily:            'Nunito, Arial, sans-serif',
      fontSize:              '14px',
    },
    flowchart: { htmlLabels: true, curve: 'basis' }
  };
}

/**
 * Post-processes a rendered Mermaid SVG string.
 * In dark mode, replaces the hardcoded white background rect that Mermaid
 * injects into the SVG with the site's dark surface color.
 */
export function applyMermaidThemeToSvg(svg, isDark = false) {
  if (!isDark || !svg) return svg;
  // Mermaid adds <rect ... style="fill: white;" ...> or fill="#ffffff"/"white" as the first rect
  return svg
    .replace(/(<rect[^>]*)(fill="white"|fill="#ffffff"|fill="#FFFFFF")/gi, '$1fill="#22222c"')
    .replace(/(<rect[^>]*style="[^"]*fill:\s*)(white|#fff(?:fff)?)(;?[^"]*")/gi, '$1#22222c$3');
}

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

export function prepareMermaidForRender(mermaidCode = '', options = {}) {
  if (typeof mermaidCode !== 'string' || !mermaidCode.trim()) {
    return mermaidCode;
  }

  const { wrapAt = 24 } = options;

  return mermaidCode
    .split('\n')
    .map((line) => wrapMermaidLine(line, wrapAt))
    .join('\n');
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

function wrapMermaidLine(line, wrapAt) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('graph ')) {
    return line;
  }

  return line
    .replace(/\(\[(.*?)\]\)/g, (_, label) => `([${wrapLabelText(label, wrapAt)}])`)
    .replace(/\[(.*?)\]/g, (_, label) => `[${wrapLabelText(label, wrapAt)}]`)
    .replace(/\{(.*?)\}/g, (_, label) => `{${wrapLabelText(label, Math.max(16, wrapAt - 4))}}`)
    .replace(/\((?!\[)(.*?)\)/g, (_, label) => `(${wrapLabelText(label, wrapAt)})`);
}

function wrapLabelText(label, wrapAt) {
  const normalized = normalizeText(String(label).replace(/<br\s*\/?>/gi, ' '));
  if (!normalized || normalized.length <= wrapAt) {
    return normalized;
  }

  const words = normalized.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }

    if (`${currentLine} ${word}`.length > wrapAt) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    currentLine = `${currentLine} ${word}`;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join('<br/>');
}
