import { describe, it, expect } from 'vitest';
import { getMockWorkContext, getMockOtherUsers } from './work-context';

describe('Mock Work Context', () => {
  it('returns work context for a user', () => {
    const context = getMockWorkContext('user-123');
    
    expect(context).toBeInstanceOf(Array);
    expect(context.length).toBeGreaterThan(0);
  });

  it('includes GitHub context', () => {
    const context = getMockWorkContext('user-123');
    const githubItems = context.filter(c => c.source === 'github');
    
    expect(githubItems.length).toBeGreaterThan(0);
    expect(githubItems.some(c => c.title.includes('PR:'))).toBe(true);
  });

  it('includes Linear context', () => {
    const context = getMockWorkContext('user-123');
    const linearItems = context.filter(c => c.source === 'linear');
    
    expect(linearItems.length).toBeGreaterThan(0);
    expect(linearItems.some(c => c.title.includes('Issue:'))).toBe(true);
  });

  it('includes calendar context', () => {
    const context = getMockWorkContext('user-123');
    const calendarItems = context.filter(c => c.source === 'calendar');
    
    expect(calendarItems.length).toBeGreaterThan(0);
    expect(calendarItems.some(c => c.title.includes('Meeting:'))).toBe(true);
  });

  it('includes notion/confluence context', () => {
    const context = getMockWorkContext('user-123');
    const notionItems = context.filter(c => c.source === 'notion');
    
    expect(notionItems.length).toBeGreaterThan(0);
    expect(notionItems.some(c => c.title.includes('Doc:'))).toBe(true);
  });

  it('includes slack context', () => {
    const context = getMockWorkContext('user-123');
    const slackItems = context.filter(c => c.source === 'slack');
    
    expect(slackItems.length).toBeGreaterThan(0);
  });

  it('sets the correct userId on all items', () => {
    const userId = 'test-user-abc';
    const context = getMockWorkContext(userId);
    
    expect(context.every(c => c.userId === userId)).toBe(true);
  });

  it('has valid dates on all items', () => {
    const context = getMockWorkContext('user-123');
    
    context.forEach(item => {
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.updatedAt).toBeInstanceOf(Date);
    });
  });
});

describe('Mock Other Users (for Pan-to-Pan)', () => {
  it('returns other users with Pans', () => {
    const users = getMockOtherUsers();
    
    expect(users).toBeInstanceOf(Array);
    expect(users.length).toBeGreaterThan(0);
  });

  it('each user has a daemon/Pan name', () => {
    const users = getMockOtherUsers();
    
    users.forEach(user => {
      expect(user.daemonName).toBeDefined();
      expect(user.daemonName.length).toBeGreaterThan(0);
    });
  });

  it('each user has work context summaries', () => {
    const users = getMockOtherUsers();
    
    users.forEach(user => {
      expect(user.workContext).toBeInstanceOf(Array);
      expect(user.workContext.length).toBeGreaterThan(0);
    });
  });

  it('includes Sarah (for design review testing)', () => {
    const users = getMockOtherUsers();
    const sarah = users.find(u => u.name.includes('Sarah'));
    
    expect(sarah).toBeDefined();
    expect(sarah?.daemonName).toBe('Stella');
  });
});
