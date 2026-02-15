import { describe, it, expect } from 'vitest';
import {
  validationRules,
  FormValidator,
  createValidator,
  validatePitchForm,
  validateProductionRegistration,
  validateEmail,
  validatePassword,
  validateRequired,
} from '../validation';

// ============================================================================
// validationRules.required
// ============================================================================
describe('validationRules.required', () => {
  const rule = validationRules.required('Name');

  it('passes for non-empty string', () => {
    expect(rule('John').isValid).toBe(true);
  });

  it('fails for empty string', () => {
    const result = rule('');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Name');
  });

  it('fails for whitespace-only string', () => {
    expect(rule('   ').isValid).toBe(false);
  });
});

// ============================================================================
// validationRules.email
// ============================================================================
describe('validationRules.email', () => {
  const rule = validationRules.email();

  it('passes for valid email', () => {
    expect(rule('user@example.com').isValid).toBe(true);
  });

  it('fails for email without @', () => {
    expect(rule('userexample.com').isValid).toBe(false);
  });

  it('fails for email without domain', () => {
    expect(rule('user@').isValid).toBe(false);
  });

  it('fails for email without TLD', () => {
    expect(rule('user@example').isValid).toBe(false);
  });
});

// ============================================================================
// validationRules.password
// ============================================================================
describe('validationRules.password', () => {
  const rule = validationRules.password();

  it('passes for valid password', () => {
    expect(rule('SecurePass1').isValid).toBe(true);
  });

  it('fails for short password', () => {
    const result = rule('Ab1');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('8');
  });

  it('fails without uppercase', () => {
    const result = rule('lowercase1');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('uppercase');
  });

  it('fails without lowercase', () => {
    const result = rule('UPPERCASE1');
    expect(result.isValid).toBe(false);
  });

  it('fails without number', () => {
    const result = rule('NoNumberHere');
    expect(result.isValid).toBe(false);
  });
});

// ============================================================================
// validationRules.passwordConfirm
// ============================================================================
describe('validationRules.passwordConfirm', () => {
  const rule = validationRules.passwordConfirm('MyPass123');

  it('passes when passwords match', () => {
    expect(rule('MyPass123').isValid).toBe(true);
  });

  it('fails when passwords differ', () => {
    const result = rule('Different123');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('match');
  });
});

// ============================================================================
// validationRules.url
// ============================================================================
describe('validationRules.url', () => {
  const rule = validationRules.url();

  it('passes for valid URL', () => {
    expect(rule('https://example.com').isValid).toBe(true);
  });

  it('passes for http URL', () => {
    expect(rule('http://example.com/path').isValid).toBe(true);
  });

  it('fails for invalid URL', () => {
    expect(rule('not-a-url').isValid).toBe(false);
  });
});

// ============================================================================
// validationRules.phone
// ============================================================================
describe('validationRules.phone', () => {
  const rule = validationRules.phone();

  it('passes for valid phone', () => {
    expect(rule('+1 (555) 123-4567').isValid).toBe(true);
  });

  it('passes for digits-only phone', () => {
    expect(rule('15551234567').isValid).toBe(true);
  });

  it('fails for too-short number', () => {
    expect(rule('12345').isValid).toBe(false);
  });
});

// ============================================================================
// validationRules.minLength / maxLength
// ============================================================================
describe('validationRules.minLength', () => {
  const rule = validationRules.minLength(3);

  it('passes for string at min length', () => {
    expect(rule('abc').isValid).toBe(true);
  });

  it('fails for string below min length', () => {
    const result = rule('ab');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('3');
  });
});

describe('validationRules.maxLength', () => {
  const rule = validationRules.maxLength(5);

  it('passes for string at max length', () => {
    expect(rule('abcde').isValid).toBe(true);
  });

  it('fails for string above max length', () => {
    const result = rule('abcdef');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('5');
  });
});

// ============================================================================
// validationRules.file
// ============================================================================
describe('validationRules.file', () => {
  it('passes for valid file', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const rule = validationRules.file({ allowedTypes: ['application/pdf'] });
    expect(rule(file).isValid).toBe(true);
  });

  it('fails for oversized file', () => {
    const file = new File([new ArrayBuffer(20 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    const rule = validationRules.file({ maxSize: 10 * 1024 * 1024 });
    expect(rule(file).isValid).toBe(false);
  });

  it('fails for wrong file type', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const rule = validationRules.file({ allowedTypes: ['application/pdf'] });
    const result = rule(file);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('application/pdf');
  });

  it('passes for null when not required', () => {
    const rule = validationRules.file({ required: false });
    expect(rule(null).isValid).toBe(true);
  });

  it('fails for null when required', () => {
    const rule = validationRules.file({ required: true });
    expect(rule(null).isValid).toBe(false);
  });
});

// ============================================================================
// validationRules.select
// ============================================================================
describe('validationRules.select', () => {
  const rule = validationRules.select('Genre');

  it('passes for non-empty selection', () => {
    expect(rule('action').isValid).toBe(true);
  });

  it('fails for empty string', () => {
    const result = rule('');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('genre');
  });
});

// ============================================================================
// validationRules.checkbox
// ============================================================================
describe('validationRules.checkbox', () => {
  const rule = validationRules.checkbox('Terms');

  it('passes when checked', () => {
    expect(rule(true).isValid).toBe(true);
  });

  it('fails when unchecked', () => {
    const result = rule(false);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('terms');
  });
});

// ============================================================================
// validationRules.custom
// ============================================================================
describe('validationRules.custom', () => {
  it('passes when custom validator returns true', () => {
    const rule = validationRules.custom((v: number) => v > 0, 'Must be positive');
    expect(rule(5).isValid).toBe(true);
  });

  it('fails when custom validator returns false', () => {
    const rule = validationRules.custom((v: number) => v > 0, 'Must be positive');
    const result = rule(-1);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('Must be positive');
  });
});

// ============================================================================
// FormValidator
// ============================================================================
describe('FormValidator', () => {
  it('validates a single field successfully', () => {
    const v = new FormValidator({
      name: [validationRules.required('Name')],
    });
    expect(v.validateField('name', 'John').isValid).toBe(true);
  });

  it('validates a single field with error', () => {
    const v = new FormValidator({
      name: [validationRules.required('Name')],
    });
    const result = v.validateField('name', '');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Name');
  });

  it('returns valid for unknown field', () => {
    const v = new FormValidator({});
    expect(v.validateField('unknown', 'anything').isValid).toBe(true);
  });

  it('validates entire form with errors', () => {
    const v = new FormValidator({
      email: [validationRules.required('Email'), validationRules.email()],
      password: [validationRules.required('Password')],
    });
    const result = v.validateForm({ email: '', password: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.fieldErrors.email).toBeDefined();
    expect(result.fieldErrors.password).toBeDefined();
  });

  it('validates entire form successfully', () => {
    const v = new FormValidator({
      email: [validationRules.required('Email'), validationRules.email()],
    });
    const result = v.validateForm({ email: 'user@example.com' });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('getFieldErrors returns empty array for valid field', () => {
    const v = new FormValidator({ name: [validationRules.required('Name')] });
    v.validateForm({ name: 'John' });
    expect(v.getFieldErrors('name')).toEqual([]);
  });

  it('getFieldErrors returns errors after validation', () => {
    const v = new FormValidator({ name: [validationRules.required('Name')] });
    v.validateForm({ name: '' });
    expect(v.getFieldErrors('name').length).toBeGreaterThan(0);
  });

  it('hasFieldErrors detects errors', () => {
    const v = new FormValidator({ name: [validationRules.required('Name')] });
    v.validateForm({ name: '' });
    expect(v.hasFieldErrors('name')).toBe(true);
  });

  it('clearFieldErrors removes errors for a field', () => {
    const v = new FormValidator({ name: [validationRules.required('Name')] });
    v.validateForm({ name: '' });
    v.clearFieldErrors('name');
    expect(v.getFieldErrors('name')).toEqual([]);
  });

  it('clearAllErrors resets all errors', () => {
    const v = new FormValidator({
      a: [validationRules.required('A')],
      b: [validationRules.required('B')],
    });
    v.validateForm({ a: '', b: '' });
    v.clearAllErrors();
    expect(v.getFieldErrors('a')).toEqual([]);
    expect(v.getFieldErrors('b')).toEqual([]);
  });
});

// ============================================================================
// createValidator
// ============================================================================
describe('createValidator', () => {
  it('returns a FormValidator instance', () => {
    const v = createValidator({ name: [validationRules.required('Name')] });
    expect(v).toBeInstanceOf(FormValidator);
  });
});

// ============================================================================
// validatePitchForm
// ============================================================================
describe('validatePitchForm', () => {
  const validPitch = {
    title: 'My Pitch',
    genre: 'action',
    formatCategory: 'Feature Film',
    formatSubtype: 'Theatrical',
    logline: 'A hero saves the world',
    shortSynopsis: 'A compelling short synopsis about an adventurous hero.',
    themes: '',
    worldDescription: '',
    image: null,
    pdf: null,
    video: null,
  };

  it('passes for valid pitch data', () => {
    const result = validatePitchForm(validPitch);
    expect(result.isValid).toBe(true);
  });

  it('fails for missing title', () => {
    const result = validatePitchForm({ ...validPitch, title: '' });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.title).toBeDefined();
  });

  it('validates custom format when subtype requires it', () => {
    const result = validatePitchForm({
      ...validPitch,
      formatSubtype: 'Custom Format (please specify)',
      customFormat: '',
    });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.customFormat).toBeDefined();
  });

  it('skips custom format validation when not needed', () => {
    const result = validatePitchForm(validPitch);
    expect(result.fieldErrors.customFormat).toBeUndefined();
  });
});

// ============================================================================
// validateProductionRegistration
// ============================================================================
describe('validateProductionRegistration', () => {
  const validData = {
    companyName: 'Test Studios',
    registrationNumber: '123456',
    website: 'https://teststudios.com',
    companyEmail: 'info@teststudios.com',
    companyPhone: '+1 555 123 4567',
    address: '123 Main St',
    city: 'Los Angeles',
    state: 'CA',
    zipCode: '90001',
    country: 'USA',
    linkedin: 'https://linkedin.com/company/teststudios',
    twitter: 'https://twitter.com/teststudios',
    instagram: 'https://instagram.com/teststudios',
    facebook: 'https://facebook.com/teststudios',
    firstName: 'Jane',
    lastName: 'Doe',
    position: 'Head of Dev',
    email: 'jane@teststudios.com',
    username: 'janedoe',
    password: 'SecurePass1',
    confirmPassword: 'SecurePass1',
    agreeToTerms: true,
    agreeToVetting: true,
  };

  it('passes for valid registration data', () => {
    const result = validateProductionRegistration(validData);
    expect(result.isValid).toBe(true);
  });

  it('fails when passwords do not match', () => {
    const result = validateProductionRegistration({
      ...validData,
      confirmPassword: 'Different1',
    });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.confirmPassword).toBeDefined();
  });

  it('fails when terms not agreed', () => {
    const result = validateProductionRegistration({
      ...validData,
      agreeToTerms: false,
    });
    expect(result.isValid).toBe(false);
  });

  it('validates optional URL fields only when provided', () => {
    const result = validateProductionRegistration({
      ...validData,
      linkedin: 'not-a-url',
    });
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.linkedin).toBeDefined();
  });

  it('passes when optional URL fields are empty', () => {
    const result = validateProductionRegistration({
      ...validData,
      linkedin: '',
      twitter: '',
    });
    expect(result.isValid).toBe(true);
  });
});

// ============================================================================
// Utility functions
// ============================================================================
describe('validateEmail', () => {
  it('returns true for valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('returns false for invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});

describe('validatePassword', () => {
  it('returns valid for strong password', () => {
    expect(validatePassword('StrongPass1').isValid).toBe(true);
  });

  it('returns invalid for weak password', () => {
    expect(validatePassword('weak').isValid).toBe(false);
  });
});

describe('validateRequired', () => {
  it('returns valid for non-empty value', () => {
    expect(validateRequired('hello', 'Field').isValid).toBe(true);
  });

  it('returns invalid for empty value', () => {
    const result = validateRequired('', 'Field');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Field');
  });
});
