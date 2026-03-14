import { describe, it, expect } from 'vitest';
import {
  containsSensitiveContent,
  filterForPrivacy,
  filterWorkContext,
  filterWithAudit,
  generatePrivacySummary,
} from './truth-filter';
import type { TruthPacket, WorkContext } from '@/types/daemon';

describe('privacy/truth-filter', () => {
  describe('containsSensitiveContent', () => {
    describe('salary/compensation', () => {
      it('detects salary mentions', () => {
        expect(containsSensitiveContent('Discussed salary increase').sensitive).toBe(true);
        expect(containsSensitiveContent('Salary review meeting').category).toBe('salary');
      });

      it('detects compensation', () => {
        expect(containsSensitiveContent('Compensation package review').sensitive).toBe(true);
      });

      it('detects bonus', () => {
        expect(containsSensitiveContent('Q4 bonus discussion').sensitive).toBe(true);
      });

      it('detects pay rate', () => {
        expect(containsSensitiveContent('Pay rate adjustment').sensitive).toBe(true);
      });
    });

    describe('medical/health', () => {
      it('detects medical mentions', () => {
        expect(containsSensitiveContent('Medical appointment').sensitive).toBe(true);
        expect(containsSensitiveContent('Medical appointment').category).toBe('medical');
      });

      it('detects health issues', () => {
        expect(containsSensitiveContent('Health condition update').sensitive).toBe(true);
      });

      it('detects doctor visits', () => {
        expect(containsSensitiveContent('Doctor appointment at 2pm').sensitive).toBe(true);
      });
    });

    describe('HR/performance', () => {
      it('detects HR meetings', () => {
        expect(containsSensitiveContent('HR meeting scheduled').sensitive).toBe(true);
        expect(containsSensitiveContent('HR discussion').category).toBe('hr');
      });

      it('detects performance reviews', () => {
        expect(containsSensitiveContent('Performance review').sensitive).toBe(true);
      });

      it('detects PIP', () => {
        expect(containsSensitiveContent('Started on PIP').sensitive).toBe(true);
      });

      it('detects termination', () => {
        expect(containsSensitiveContent('Termination discussion').sensitive).toBe(true);
      });

      it('detects layoff', () => {
        expect(containsSensitiveContent('Layoff announcements').sensitive).toBe(true);
      });
    });

    describe('personal notes', () => {
      it('detects 1-on-1 meetings', () => {
        expect(containsSensitiveContent('1-on-1 with manager').sensitive).toBe(true);
        expect(containsSensitiveContent('1on1 notes').sensitive).toBe(true);
      });

      it('detects one-on-one', () => {
        expect(containsSensitiveContent('One-on-one discussion').sensitive).toBe(true);
      });

      it('detects personal notes', () => {
        expect(containsSensitiveContent('Personal notes and thoughts').sensitive).toBe(true);
      });
    });

    describe('credentials', () => {
      it('detects passwords', () => {
        expect(containsSensitiveContent('Password reset required').sensitive).toBe(true);
        expect(containsSensitiveContent('password list').category).toBe('credentials');
      });

      it('detects API keys', () => {
        expect(containsSensitiveContent('API key rotation').sensitive).toBe(true);
        expect(containsSensitiveContent('api-key exposed').sensitive).toBe(true);
      });

      it('detects credentials', () => {
        expect(containsSensitiveContent('Credential management').sensitive).toBe(true);
      });

      it('detects tokens', () => {
        expect(containsSensitiveContent('Token refresh logic').sensitive).toBe(true);
      });

      it('detects secrets', () => {
        expect(containsSensitiveContent('Secret management').sensitive).toBe(true);
      });
    });

    describe('legal', () => {
      it('detects legal matters', () => {
        expect(containsSensitiveContent('Legal matter discussion').sensitive).toBe(true);
        expect(containsSensitiveContent('Legal issue').category).toBe('legal');
      });

      it('detects NDA', () => {
        expect(containsSensitiveContent('NDA signing').sensitive).toBe(true);
      });

      it('detects lawsuits', () => {
        expect(containsSensitiveContent('Lawsuit update').sensitive).toBe(true);
      });

      it('detects harassment', () => {
        expect(containsSensitiveContent('Harassment complaint').sensitive).toBe(true);
      });

      it('detects discrimination', () => {
        expect(containsSensitiveContent('Discrimination claim').sensitive).toBe(true);
      });
    });

    describe('confidential', () => {
      it('detects private content', () => {
        expect(containsSensitiveContent('Private meeting').sensitive).toBe(true);
      });

      it('detects confidential content', () => {
        expect(containsSensitiveContent('Confidential document').sensitive).toBe(true);
      });
    });

    describe('safe content', () => {
      it('allows normal work content', () => {
        expect(containsSensitiveContent('Sprint planning meeting').sensitive).toBe(false);
      });

      it('allows technical content', () => {
        expect(containsSensitiveContent('Working on API refactor').sensitive).toBe(false);
      });

      it('allows project updates', () => {
        expect(containsSensitiveContent('Project milestone achieved').sensitive).toBe(false);
      });
    });
  });

  describe('filterForPrivacy', () => {
    const basePacket: TruthPacket = {
      availability: [
        'Monday 2-4pm',
        'Salary discussion at 3pm',
        'Tuesday morning free',
      ],
      workloadSummary: 'Working on API refactor',
      relevantExpertise: ['React', 'Password management', 'TypeScript', 'Python', 'Go'],
      currentFocus: 'Sprint planning',
      lastActiveProject: 'Dashboard redesign',
    };

    it('filters out sensitive availability items', () => {
      const filtered = filterForPrivacy(basePacket, 'balanced');
      expect(filtered.availability).not.toContain('Salary discussion at 3pm');
      expect(filtered.availability.length).toBe(2);
    });

    it('filters out sensitive expertise items', () => {
      const filtered = filterForPrivacy(basePacket, 'balanced');
      expect(filtered.relevantExpertise).not.toContain('Password management');
    });

    it('limits expertise for minimal privacy', () => {
      const filtered = filterForPrivacy(basePacket, 'minimal');
      expect(filtered.relevantExpertise.length).toBeLessThanOrEqual(2);
    });

    it('limits expertise for balanced privacy', () => {
      const filtered = filterForPrivacy(basePacket, 'balanced');
      expect(filtered.relevantExpertise.length).toBeLessThanOrEqual(3);
    });

    it('removes currentFocus and lastActiveProject for minimal privacy', () => {
      const filtered = filterForPrivacy(basePacket, 'minimal');
      expect(filtered.currentFocus).toBeUndefined();
      expect(filtered.lastActiveProject).toBeUndefined();
    });

    it('keeps currentFocus for balanced privacy', () => {
      const filtered = filterForPrivacy(basePacket, 'balanced');
      expect(filtered.currentFocus).toBe('Sprint planning');
    });

    it('sanitizes email addresses', () => {
      const packet: TruthPacket = {
        availability: ['Meeting with john@example.com'],
        workloadSummary: 'Light',
        relevantExpertise: [],
      };
      const filtered = filterForPrivacy(packet, 'balanced');
      expect(filtered.availability[0]).toContain('[email]');
      expect(filtered.availability[0]).not.toContain('john@example.com');
    });

    it('sanitizes phone numbers', () => {
      const packet: TruthPacket = {
        availability: ['Call 555-123-4567'],
        workloadSummary: 'Light',
        relevantExpertise: [],
      };
      const filtered = filterForPrivacy(packet, 'balanced');
      expect(filtered.availability[0]).toContain('[phone]');
    });

    it('sanitizes dollar amounts', () => {
      const packet: TruthPacket = {
        availability: ['Budget discussion $50,000'],
        workloadSummary: 'Light',
        relevantExpertise: [],
      };
      const filtered = filterForPrivacy(packet, 'balanced');
      expect(filtered.availability[0]).toContain('[amount]');
    });

    it('sanitizes URLs for minimal privacy', () => {
      const packet: TruthPacket = {
        availability: ['Check https://example.com/doc'],
        workloadSummary: 'Light',
        relevantExpertise: [],
      };
      const filtered = filterForPrivacy(packet, 'minimal');
      expect(filtered.availability[0]).toContain('[link]');
    });

    it('sanitizes @mentions for minimal privacy', () => {
      const packet: TruthPacket = {
        availability: ['Sync with @johndoe'],
        workloadSummary: 'Light',
        relevantExpertise: [],
      };
      const filtered = filterForPrivacy(packet, 'minimal');
      expect(filtered.availability[0]).toContain('[mention]');
    });
  });

  describe('filterWorkContext', () => {
    const contexts: WorkContext[] = [
      {
        id: '1',
        userId: 'user-1',
        source: 'github',
        title: 'PR: Fix authentication',
        summary: 'Updated login flow',
        timestamp: new Date(),
      },
      {
        id: '2',
        userId: 'user-1',
        source: 'calendar',
        title: 'Salary review meeting',
        summary: 'Discuss compensation',
        timestamp: new Date(),
      },
      {
        id: '3',
        userId: 'user-1',
        source: 'slack',
        title: 'Team standup',
        summary: 'Daily sync with team@example.com',
        timestamp: new Date(),
      },
    ];

    it('filters out contexts with sensitive titles', () => {
      const filtered = filterWorkContext(contexts, 'balanced');
      expect(filtered.some(c => c.title === 'Salary review meeting')).toBe(false);
    });

    it('keeps non-sensitive contexts', () => {
      const filtered = filterWorkContext(contexts, 'balanced');
      expect(filtered.some(c => c.title === 'PR: Fix authentication')).toBe(true);
    });

    it('sanitizes PII in summaries', () => {
      const filtered = filterWorkContext(contexts, 'balanced');
      const standup = filtered.find(c => c.title === 'Team standup');
      expect(standup?.summary).toContain('[email]');
    });
  });

  describe('filterWithAudit', () => {
    it('returns filtered packet with audit trail', () => {
      const packet: TruthPacket = {
        availability: ['Monday free', 'HR meeting Tuesday'],
        workloadSummary: 'Light',
        relevantExpertise: ['React', 'Salary negotiation'],
      };

      const result = filterWithAudit(packet, 'balanced');

      expect(result.filtered.availability.length).toBe(1);
      expect(result.blockedCount).toBe(2);
      expect(result.audit.length).toBeGreaterThan(0);
    });

    it('logs blocked items in audit', () => {
      const packet: TruthPacket = {
        availability: ['Salary discussion'],
        workloadSummary: 'Light',
        relevantExpertise: [],
      };

      const result = filterWithAudit(packet, 'balanced');
      const blockedEntry = result.audit.find(a => a.action === 'blocked');

      expect(blockedEntry).toBeDefined();
      expect(blockedEntry?.originalData).toBe('Salary discussion');
      expect(blockedEntry?.category).toBe('salary');
    });

    it('logs sanitized items in audit', () => {
      const packet: TruthPacket = {
        availability: ['Call john@example.com'],
        workloadSummary: 'Light',
        relevantExpertise: [],
      };

      const result = filterWithAudit(packet, 'balanced');
      const synthesizedEntry = result.audit.find(a => a.action === 'synthesized');

      expect(synthesizedEntry).toBeDefined();
      expect(synthesizedEntry?.filteredData).toContain('[email]');
    });
  });

  describe('generatePrivacySummary', () => {
    it('summarizes blocked items by category', () => {
      const audit = [
        { timestamp: new Date(), action: 'blocked' as const, category: 'salary' },
        { timestamp: new Date(), action: 'blocked' as const, category: 'medical' },
      ];

      const summary = generatePrivacySummary(audit);
      expect(summary).toContain('Blocked 2 item(s)');
      expect(summary).toContain('salary');
      expect(summary).toContain('medical');
    });

    it('summarizes sanitized items', () => {
      const audit = [
        { timestamp: new Date(), action: 'synthesized' as const },
        { timestamp: new Date(), action: 'synthesized' as const },
      ];

      const summary = generatePrivacySummary(audit);
      expect(summary).toContain('Sanitized 2 item(s)');
    });

    it('returns message for empty audit', () => {
      const summary = generatePrivacySummary([]);
      expect(summary).toBe('No sensitive content filtered.');
    });
  });
});
