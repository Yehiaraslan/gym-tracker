import { describe, it, expect } from 'vitest';
import { 
  generateId, 
  getDayName, 
  calculateCycleInfo, 
  formatDate 
} from './types';

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  it('should generate string IDs', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('getDayName', () => {
  it('should return correct day names', () => {
    expect(getDayName(1)).toBe('Monday');
    expect(getDayName(2)).toBe('Tuesday');
    expect(getDayName(3)).toBe('Wednesday');
    expect(getDayName(4)).toBe('Thursday');
    expect(getDayName(5)).toBe('Friday');
    expect(getDayName(6)).toBe('Saturday');
    expect(getDayName(7)).toBe('Sunday');
  });

  it('should return empty string for invalid day numbers', () => {
    expect(getDayName(0)).toBe('');
    expect(getDayName(8)).toBe('');
    expect(getDayName(-1)).toBe('');
  });
});

describe('calculateCycleInfo', () => {
  it('should return cycle 1, week 1, day 1 for start date', () => {
    const today = new Date().toISOString().split('T')[0];
    const info = calculateCycleInfo(today);
    
    expect(info.cycle).toBe(1);
    expect(info.week).toBe(1);
    expect(info.day).toBe(1);
  });

  it('should return correct info for future start date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const info = calculateCycleInfo(futureDate.toISOString().split('T')[0]);
    
    expect(info.cycle).toBe(1);
    expect(info.week).toBe(1);
    expect(info.day).toBe(1);
  });

  it('should calculate week correctly', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // 7 days ago
    const info = calculateCycleInfo(startDate.toISOString().split('T')[0]);
    
    expect(info.week).toBe(2);
    expect(info.day).toBe(1);
  });

  it('should calculate cycle correctly after 8 weeks', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 56); // 8 weeks ago
    const info = calculateCycleInfo(startDate.toISOString().split('T')[0]);
    
    expect(info.cycle).toBe(2);
    expect(info.week).toBe(1);
  });

  it('should handle day progression within a week', () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3); // 3 days ago
    const info = calculateCycleInfo(startDate.toISOString().split('T')[0]);
    
    expect(info.week).toBe(1);
    expect(info.day).toBe(4);
  });
});

describe('formatDate', () => {
  it('should format date correctly', () => {
    const formatted = formatDate('2024-01-15');
    
    // Should contain day, month, and date
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('15');
  });

  it('should handle different dates', () => {
    const formatted = formatDate('2024-12-25');
    
    expect(formatted).toContain('Dec');
    expect(formatted).toContain('25');
  });
});
