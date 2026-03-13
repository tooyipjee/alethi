import type { TruthPacket, PrivacyLevel, WorkContext } from '@/types/daemon';

const SENSITIVE_PATTERNS = [
  /salary/i,
  /compensation/i,
  /pay\s*(rate|grade|band)/i,
  /bonus/i,
  /medical/i,
  /health\s*(issue|condition|record)/i,
  /doctor/i,
  /hr\s*(meeting|discussion|complaint)/i,
  /performance\s*review/i,
  /pip\b/i,
  /termination/i,
  /layoff/i,
  /1[\s-]?on[\s-]?1/i,
  /one[\s-]?on[\s-]?one/i,
  /personal\s*(note|journal|diary)/i,
  /password/i,
  /credential/i,
  /secret/i,
  /api[\s-]?key/i,
  /token/i,
  /private/i,
  /confidential/i,
  /nda\b/i,
  /legal\s*(matter|issue|dispute)/i,
  /lawsuit/i,
  /harassment/i,
  /discrimination/i,
];

const ALWAYS_BLOCKED_CATEGORIES = [
  'salary',
  'medical',
  'hr',
  'legal',
  'credentials',
  'personal_notes',
];

export interface PrivacyAuditEntry {
  timestamp: Date;
  action: 'shared' | 'blocked' | 'synthesized';
  originalData?: string;
  filteredData?: string;
  reason?: string;
  category?: string;
}

export interface FilterResult {
  filtered: TruthPacket;
  audit: PrivacyAuditEntry[];
  blockedCount: number;
}

export function containsSensitiveContent(text: string): { sensitive: boolean; category?: string } {
  const lowerText = text.toLowerCase();
  
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(lowerText)) {
      const match = lowerText.match(pattern);
      if (match) {
        const category = categorizeSensitiveContent(match[0]);
        return { sensitive: true, category };
      }
    }
  }
  
  return { sensitive: false };
}

function categorizeSensitiveContent(match: string): string {
  const lower = match.toLowerCase();
  
  if (/salary|compensation|pay|bonus/i.test(lower)) return 'salary';
  if (/medical|health|doctor/i.test(lower)) return 'medical';
  if (/hr|performance|pip|termination|layoff/i.test(lower)) return 'hr';
  if (/1[\s-]?on[\s-]?1|one[\s-]?on[\s-]?one|personal/i.test(lower)) return 'personal_notes';
  if (/password|credential|secret|api[\s-]?key|token/i.test(lower)) return 'credentials';
  if (/legal|lawsuit|harassment|discrimination|nda/i.test(lower)) return 'legal';
  if (/private|confidential/i.test(lower)) return 'confidential';
  
  return 'unknown';
}

export function filterForPrivacy(
  truthPacket: TruthPacket,
  privacyLevel: PrivacyLevel
): TruthPacket {
  const result = { ...truthPacket };
  
  result.availability = truthPacket.availability
    .filter(a => !containsSensitiveContent(a).sensitive)
    .map(a => sanitizeText(a, privacyLevel));
  
  result.workloadSummary = sanitizeText(truthPacket.workloadSummary, privacyLevel);
  
  result.relevantExpertise = truthPacket.relevantExpertise
    .filter(e => !containsSensitiveContent(e).sensitive)
    .map(e => sanitizeText(e, privacyLevel));
  
  if (truthPacket.currentFocus) {
    const focusCheck = containsSensitiveContent(truthPacket.currentFocus);
    result.currentFocus = focusCheck.sensitive 
      ? undefined 
      : sanitizeText(truthPacket.currentFocus, privacyLevel);
  }
  
  if (truthPacket.lastActiveProject) {
    const projectCheck = containsSensitiveContent(truthPacket.lastActiveProject);
    result.lastActiveProject = projectCheck.sensitive
      ? undefined
      : sanitizeText(truthPacket.lastActiveProject, privacyLevel);
  }

  if (privacyLevel === 'minimal') {
    result.relevantExpertise = result.relevantExpertise.slice(0, 2);
    delete result.currentFocus;
    delete result.lastActiveProject;
  } else if (privacyLevel === 'balanced') {
    result.relevantExpertise = result.relevantExpertise.slice(0, 3);
  }
  
  return result;
}

function sanitizeText(text: string, privacyLevel: PrivacyLevel): string {
  let sanitized = text;
  
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]');
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[phone]');
  sanitized = sanitized.replace(/\$[\d,]+(\.\d{2})?/g, '[amount]');
  
  if (privacyLevel === 'minimal') {
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[link]');
    sanitized = sanitized.replace(/@\w+/g, '[mention]');
  }
  
  return sanitized;
}

export function filterWorkContext(
  contexts: WorkContext[],
  privacyLevel: PrivacyLevel
): WorkContext[] {
  return contexts
    .filter(ctx => {
      const titleCheck = containsSensitiveContent(ctx.title);
      const summaryCheck = containsSensitiveContent(ctx.summary);
      
      if (titleCheck.category && ALWAYS_BLOCKED_CATEGORIES.includes(titleCheck.category)) {
        return false;
      }
      if (summaryCheck.category && ALWAYS_BLOCKED_CATEGORIES.includes(summaryCheck.category)) {
        return false;
      }
      
      return true;
    })
    .map(ctx => ({
      ...ctx,
      title: sanitizeText(ctx.title, privacyLevel),
      summary: sanitizeText(ctx.summary, privacyLevel),
    }));
}

export function filterWithAudit(
  truthPacket: TruthPacket,
  privacyLevel: PrivacyLevel
): FilterResult {
  const audit: PrivacyAuditEntry[] = [];
  let blockedCount = 0;
  
  const filteredAvailability: string[] = [];
  for (const item of truthPacket.availability) {
    const check = containsSensitiveContent(item);
    if (check.sensitive) {
      blockedCount++;
      audit.push({
        timestamp: new Date(),
        action: 'blocked',
        originalData: item,
        reason: `Contains ${check.category} information`,
        category: check.category,
      });
    } else {
      const sanitized = sanitizeText(item, privacyLevel);
      filteredAvailability.push(sanitized);
      if (sanitized !== item) {
        audit.push({
          timestamp: new Date(),
          action: 'synthesized',
          originalData: item,
          filteredData: sanitized,
          reason: 'PII removed',
        });
      }
    }
  }

  const filteredExpertise: string[] = [];
  for (const item of truthPacket.relevantExpertise) {
    const check = containsSensitiveContent(item);
    if (check.sensitive) {
      blockedCount++;
      audit.push({
        timestamp: new Date(),
        action: 'blocked',
        originalData: item,
        reason: `Contains ${check.category} information`,
        category: check.category,
      });
    } else {
      filteredExpertise.push(sanitizeText(item, privacyLevel));
    }
  }

  const filtered: TruthPacket = {
    availability: filteredAvailability,
    workloadSummary: sanitizeText(truthPacket.workloadSummary, privacyLevel),
    relevantExpertise: filteredExpertise,
  };

  if (truthPacket.currentFocus) {
    const check = containsSensitiveContent(truthPacket.currentFocus);
    if (!check.sensitive) {
      filtered.currentFocus = sanitizeText(truthPacket.currentFocus, privacyLevel);
    } else {
      blockedCount++;
      audit.push({
        timestamp: new Date(),
        action: 'blocked',
        originalData: truthPacket.currentFocus,
        reason: `Contains ${check.category} information`,
        category: check.category,
      });
    }
  }

  if (privacyLevel === 'minimal') {
    filtered.relevantExpertise = filtered.relevantExpertise.slice(0, 2);
    delete filtered.currentFocus;
    delete filtered.lastActiveProject;
  } else if (privacyLevel === 'balanced') {
    filtered.relevantExpertise = filtered.relevantExpertise.slice(0, 3);
  }

  return { filtered, audit, blockedCount };
}

export function generatePrivacySummary(audit: PrivacyAuditEntry[]): string {
  const blocked = audit.filter(a => a.action === 'blocked');
  const synthesized = audit.filter(a => a.action === 'synthesized');
  
  const parts: string[] = [];
  
  if (blocked.length > 0) {
    const categories = [...new Set(blocked.map(b => b.category).filter(Boolean))];
    parts.push(`Blocked ${blocked.length} item(s) containing: ${categories.join(', ')}`);
  }
  
  if (synthesized.length > 0) {
    parts.push(`Sanitized ${synthesized.length} item(s) to remove PII`);
  }
  
  return parts.length > 0 
    ? parts.join('. ') + '.'
    : 'No sensitive content filtered.';
}
