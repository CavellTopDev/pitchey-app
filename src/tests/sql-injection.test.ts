/**
 * SQL Injection Security Test Suite
 * 
 * Tests common SQL injection attack vectors to ensure queries are properly sanitized
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SafeQueryBuilder, validateInput, escapeLikePattern } from '../utils/safe-query-builder';

describe('SQL Injection Prevention Tests', () => {
  
  describe('SafeQueryBuilder', () => {
    let builder: SafeQueryBuilder;
    
    beforeAll(() => {
      builder = new SafeQueryBuilder();
    });
    
    it('should reject DROP TABLE injection attempts', () => {
      expect(() => {
        SafeQueryBuilder.buildPitchSearchQuery({
          search: "'; DROP TABLE users; --"
        });
      }).not.toThrow();
      
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: "'; DROP TABLE users; --"
      });
      
      // The malicious input should be parameterized, not concatenated
      expect(result.query).toContain('$');
      expect(result.params).toContain("%'; DROP TABLE users; --%");
    });
    
    it('should reject UNION SELECT injection attempts', () => {
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        genre: "action' UNION SELECT * FROM users --"
      });
      
      // The genre should be parameterized
      expect(result.query).toContain('$');
      expect(result.params).toContain("action' UNION SELECT * FROM users --");
    });
    
    it('should reject boolean-based blind SQL injection', () => {
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: "test' OR '1'='1"
      });
      
      // Should be safely parameterized
      expect(result.params).toContain("%test' OR '1'='1%");
    });
    
    it('should reject time-based blind SQL injection', () => {
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: "'; WAITFOR DELAY '00:00:10'--"
      });
      
      // Should be safely parameterized
      expect(result.params).toContain("%'; WAITFOR DELAY '00:00:10'--%");
    });
    
    it('should handle malicious ORDER BY input', () => {
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        sortBy: "(SELECT * FROM users)",
        sortOrder: "ASC; DELETE FROM pitches" as any
      });
      
      // Should default to safe values
      expect(result.query).toContain('ORDER BY');
      expect(result.query).not.toContain('SELECT * FROM users');
      expect(result.query).not.toContain('DELETE');
    });
    
    it('should handle malicious LIMIT/OFFSET', () => {
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        limit: "10; DELETE FROM users" as any,
        offset: "-1 UNION SELECT * FROM passwords" as any
      });
      
      // Should use parameterized values
      expect(result.params).toContain(20); // default limit
      expect(result.params).toContain(0);  // default offset
    });
    
    it('should prevent second-order SQL injection', () => {
      // User creates account with malicious username
      const maliciousUsername = "admin'--";
      
      // Later, username is used in query
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: maliciousUsername
      });
      
      // Should be safely parameterized
      expect(result.params).toContain(`%${maliciousUsername}%`);
    });
    
    it('should handle comment-based injection', () => {
      const inputs = [
        "' OR 1=1--",
        "' OR 1=1#",
        "' OR 1=1/*",
        "admin'/*",
        "' or 1=1--",
        "' or 1=1#",
        "' or 1=1/*"
      ];
      
      inputs.forEach(input => {
        const result = SafeQueryBuilder.buildPitchSearchQuery({
          search: input
        });
        
        // All should be safely parameterized
        expect(result.params).toContain(`%${input}%`);
        expect(result.query).not.toContain(input);
      });
    });
    
    it('should handle stacked queries injection', () => {
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: "'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'password123'); --"
      });
      
      // Should be parameterized, preventing execution
      expect(result.params[0]).toContain('INSERT INTO');
      expect(result.query).not.toContain('INSERT INTO');
    });
    
    it('should handle encoded injection attempts', () => {
      const encodedInjections = [
        "\\x27\\x20\\x4F\\x52\\x20\\x31\\x3D\\x31", // Hex encoding
        "%27%20OR%201%3D1",                        // URL encoding
        "&#39; OR &#49;=&#49;",                    // HTML encoding
      ];
      
      encodedInjections.forEach(input => {
        const result = SafeQueryBuilder.buildPitchSearchQuery({
          search: input
        });
        
        // Should treat as normal string
        expect(result.params).toContain(`%${input}%`);
      });
    });
  });
  
  describe('Input Validation', () => {
    
    it('should reject SQL keywords in string input', () => {
      const maliciousInputs = [
        'DROP TABLE users',
        'DELETE FROM pitches',
        'UPDATE users SET role="admin"',
        'INSERT INTO sessions',
        'ALTER TABLE',
        'EXEC sp_',
        'SCRIPT',
        'UNION SELECT'
      ];
      
      maliciousInputs.forEach(input => {
        expect(() => {
          validateInput(input, 'string');
        }).toThrow(/SQL keyword/);
      });
    });
    
    it('should validate email format', () => {
      expect(() => {
        validateInput('test@example.com', 'email');
      }).not.toThrow();
      
      expect(() => {
        validateInput("test'; DROP TABLE users; --@example.com", 'email');
      }).toThrow(/Invalid email format/);
    });
    
    it('should validate number input', () => {
      expect(validateInput('123', 'number')).toBe(123);
      expect(validateInput(456, 'number')).toBe(456);
      
      expect(() => {
        validateInput('123; DELETE FROM users', 'number');
      }).toThrow(/Invalid number/);
    });
    
    it('should handle null/undefined safely', () => {
      expect(() => {
        validateInput(null, 'string');
      }).toThrow();
      
      expect(() => {
        validateInput(undefined, 'number');
      }).toThrow();
    });
  });
  
  describe('LIKE Pattern Escaping', () => {
    
    it('should escape LIKE wildcards', () => {
      expect(escapeLikePattern('test%value')).toBe('test\\%value');
      expect(escapeLikePattern('test_value')).toBe('test\\_value');
      expect(escapeLikePattern('test\\value')).toBe('test\\\\value');
    });
    
    it('should handle complex patterns', () => {
      const input = '50%_off\\sale';
      const escaped = escapeLikePattern(input);
      expect(escaped).toBe('50\\%\\_off\\\\sale');
    });
  });
  
  describe('Real-world Attack Scenarios', () => {
    
    it('should prevent authentication bypass', () => {
      // Classic auth bypass attempt
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: "admin' --"
      });
      
      expect(result.query).not.toContain("admin' --");
      expect(result.params).toContain("%admin' --%");
    });
    
    it('should prevent data extraction via error messages', () => {
      // Attempting to extract table names via error
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: "' AND 1=CONVERT(int, (SELECT TOP 1 name FROM sysobjects WHERE xtype='U'))--"
      });
      
      // Should be parameterized, not executed
      expect(result.params[0]).toContain('CONVERT');
    });
    
    it('should prevent blind injection via timing', () => {
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: "'; IF (1=1) WAITFOR DELAY '00:00:10'--"
      });
      
      // Should be parameterized
      expect(result.params[0]).toContain('WAITFOR');
    });
    
    it('should handle polyglot injection attempts', () => {
      // Polyglot that works in multiple contexts
      const polyglot = "SLEEP(5)/*' or SLEEP(5) or '\" or SLEEP(5) or \"*/";
      
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: polyglot
      });
      
      expect(result.params).toContain(`%${polyglot}%`);
      expect(result.query).not.toContain('SLEEP');
    });
  });
  
  describe('Performance and Edge Cases', () => {
    
    it('should handle extremely long inputs', () => {
      const longInput = 'a'.repeat(10000);
      
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: longInput
      });
      
      expect(result.params).toContain(`%${longInput}%`);
    });
    
    it('should handle special characters safely', () => {
      const specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
      
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: specialChars
      });
      
      expect(result.params).toContain(`%${specialChars}%`);
    });
    
    it('should handle unicode and emoji', () => {
      const unicode = "🎬 电影 фильм 映画";
      
      const result = SafeQueryBuilder.buildPitchSearchQuery({
        search: unicode
      });
      
      expect(result.params).toContain(`%${unicode}%`);
    });
    
    it('should maintain query performance with safe building', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        SafeQueryBuilder.buildPitchSearchQuery({
          search: `test${i}`,
          genre: 'action',
          sortBy: 'views'
        });
      }
      
      const elapsed = performance.now() - start;
      
      // Should complete 1000 queries in under 100ms
      expect(elapsed).toBeLessThan(100);
    });
  });
});

describe('Integration Tests', () => {
  
  it('should safely handle real user input from forms', () => {
    // Simulate form data
    const formData = {
      search: "Robert'); DROP TABLE users; --",
      genre: "action",
      minBudget: "1000000",
      maxBudget: "5000000; DELETE FROM pitches",
      sortBy: "views",
      sortOrder: "DESC"
    };
    
    const result = SafeQueryBuilder.buildPitchSearchQuery({
      search: formData.search,
      genre: formData.genre,
      minBudget: parseInt(formData.minBudget) || 0,
      maxBudget: parseInt(formData.maxBudget) || 0,
      sortBy: formData.sortBy,
      sortOrder: formData.sortOrder as 'ASC' | 'DESC'
    });
    
    // Check that malicious input is safely handled
    expect(result.query).not.toContain('DROP TABLE');
    expect(result.query).not.toContain('DELETE FROM');
    expect(result.params).toContain("%Robert'); DROP TABLE users; --%");
  });
  
  it('should handle API endpoint parameters safely', () => {
    // Simulate API request
    const apiParams = new URLSearchParams({
      q: "test' OR 1=1--",
      sort: "(SELECT password FROM users)",
      limit: "10 UNION SELECT * FROM sessions",
      offset: "-1"
    });
    
    const result = SafeQueryBuilder.buildPitchSearchQuery({
      search: apiParams.get('q') || undefined,
      sortBy: apiParams.get('sort') || undefined,
      limit: parseInt(apiParams.get('limit') || '20'),
      offset: parseInt(apiParams.get('offset') || '0')
    });
    
    // All malicious input should be neutralized
    expect(result.query).not.toContain('UNION SELECT');
    expect(result.query).not.toContain('SELECT password');
    expect(result.params).toContain("%test' OR 1=1--%");
  });
});