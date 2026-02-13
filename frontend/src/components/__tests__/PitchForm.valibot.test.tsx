import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import * as v from 'valibot'
import {
  PitchFormSchema,
  validatePitchForm,
  validateField,
  getCharacterCountInfo,
  type PitchFormData
} from '../../schemas/pitch.schema'

describe('PitchForm Validation with Valibot', () => {
  describe('Schema Validation', () => {
    it('should validate a complete valid pitch form', () => {
      const validData: PitchFormData = {
        title: 'Amazing Movie Title',
        genre: 'Drama',
        formatCategory: 'Film',
        formatSubtype: 'Feature Film',
        logline: 'A compelling story about a hero who must overcome great challenges to save the world.',
        shortSynopsis: 'This is a detailed synopsis that explains the story in greater depth. It provides context for the characters and their motivations, setting up the dramatic stakes.',
        themes: 'Redemption, courage, sacrifice',
        worldDescription: 'A dystopian future where technology has failed',
        characters: [
          {
            name: 'John Hero',
            role: 'Protagonist',
            description: 'A reluctant hero with a dark past',
            order: 1
          }
        ],
        ndaConfig: {
          requireNDA: true,
          ndaType: 'platform',
          customNDA: null
        },
        seekingInvestment: true,
        budgetRange: '1m-5m'
      }

      const result = validatePitchForm(validData)
      console.log('Validation result:', result)
      expect(result.success).toBe(true)
      expect(result.errors).toBeUndefined()
      expect(result.data).toEqual(validData)
    })

    it('should fail validation with missing required fields', () => {
      const invalidData = {
        title: '',
        genre: '',
        formatCategory: '',
        logline: '',
        shortSynopsis: '',
        ndaConfig: {
          requireNDA: false,
          ndaType: 'none',
        },
        seekingInvestment: false
      }

      const result = validatePitchForm(invalidData)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors?.title).toContain('Title is required')
      expect(result.errors?.genre).toContain('Genre is required')
      expect(result.errors?.logline).toContain('Logline is required')
      expect(result.errors?.shortSynopsis).toContain('Synopsis is required')
    })

    it('should validate field length constraints', () => {
      const dataWithLongFields = {
        title: 'A'.repeat(101), // Too long
        genre: 'Drama',
        formatCategory: 'Film' as const,
        logline: 'A'.repeat(501), // Too long
        shortSynopsis: 'A'.repeat(1001), // Too long
        ndaConfig: {
          requireNDA: false,
          ndaType: 'none' as const,
        },
        seekingInvestment: false
      }

      const result = validatePitchForm(dataWithLongFields)
      expect(result.success).toBe(false)
      expect(result.errors?.title).toContain('Title must be less than 100 characters')
      expect(result.errors?.logline).toContain('Logline must be less than 500 characters')
      expect(result.errors?.shortSynopsis).toContain('Synopsis must be less than 1000 characters')
    })

    it('should validate budget range format', () => {
      const invalidBudget = {
        title: 'Test Movie',
        genre: 'Drama',
        formatCategory: 'Film' as const,
        logline: 'A test logline that is long enough',
        shortSynopsis: 'A test synopsis that meets the minimum character requirement for validation',
        ndaConfig: {
          requireNDA: false,
          ndaType: 'none' as const,
        },
        seekingInvestment: true,
        budgetRange: 'invalid budget' as any // Invalid value
      }

      const result = validatePitchForm(invalidBudget)
      expect(result.success).toBe(false)
      expect(result.errors?.budgetRange).toContain('Please select a valid budget range')
    })
  })

  describe('Field Validation', () => {
    it('should validate individual fields', () => {
      // Valid title
      let errors = validateField('title', 'Great Movie Title')
      expect(errors).toHaveLength(0)

      // Empty title
      errors = validateField('title', '')
      expect(errors).toContain('Title is required')

      // Too long title
      errors = validateField('title', 'A'.repeat(101))
      expect(errors).toContain('Title must be less than 100 characters')

      // Valid logline
      errors = validateField('logline', 'A compelling story about adventure')
      expect(errors).toHaveLength(0)

      // Too short logline
      errors = validateField('logline', 'Short')
      expect(errors).toContain('Logline must be at least 10 characters')
    })

    it('should handle optional fields correctly', () => {
      const dataWithOptionalFields: PitchFormData = {
        title: 'Test Title',
        genre: 'Action',
        formatCategory: 'Television - Scripted',
        logline: 'A compelling story about a detective solving crimes',
        shortSynopsis: 'This is a detailed synopsis about the detective story with enough characters to pass validation requirements.',
        // Optional fields left undefined
        themes: undefined,
        worldDescription: undefined,
        characters: undefined,
        ndaConfig: {
          requireNDA: false,
          ndaType: 'none',
        },
        seekingInvestment: false,
        budgetRange: undefined
      }

      const result = validatePitchForm(dataWithOptionalFields)
      expect(result.success).toBe(true)
    })
  })

  describe('Character Count Helper', () => {
    it('should return correct character count info', () => {
      const titleInfo = getCharacterCountInfo('title', 50)
      expect(titleInfo).toEqual({
        current: 50,
        max: 100,
        isValid: true
      })

      const loglineInfo = getCharacterCountInfo('logline', 600)
      expect(loglineInfo).toEqual({
        current: 600,
        max: 500,
        isValid: false
      })

      const synopsisInfo = getCharacterCountInfo('shortSynopsis', 1000)
      expect(synopsisInfo).toEqual({
        current: 1000,
        max: 1000,
        isValid: true
      })
    })
  })

  describe('Character Validation', () => {
    it('should validate character objects', () => {
      const validCharacter = {
        name: 'John Doe',
        role: 'Protagonist',
        description: 'The main character',
        order: 1
      }

      expect(() => v.parse(v.array(v.object({
        name: v.pipe(v.string(), v.nonEmpty()),
        role: v.pipe(v.string(), v.nonEmpty()),
        description: v.string(),
        order: v.optional(v.number())
      })), [validCharacter])).not.toThrow()
    })

    it('should reject invalid character data', () => {
      const invalidCharacter = {
        name: '', // Empty name
        role: 'Protagonist',
        description: 'A'.repeat(201), // Too long
        order: 1
      }

      const dataWithInvalidCharacter: PitchFormData = {
        title: 'Test',
        genre: 'Drama',
        formatCategory: 'Film',
        logline: 'A test logline that is valid',
        shortSynopsis: 'A test synopsis that meets the minimum character requirement for proper validation',
        characters: [invalidCharacter],
        ndaConfig: {
          requireNDA: false,
          ndaType: 'none',
        },
        seekingInvestment: false
      }

      const result = validatePitchForm(dataWithInvalidCharacter)
      expect(result.success).toBe(false)
    })
  })

  describe('NDA Configuration Validation', () => {
    it('should validate NDA configurations', () => {
      const validNDAConfigs = [
        { requireNDA: false, ndaType: 'none' as const, customNDA: null },
        { requireNDA: true, ndaType: 'platform' as const, customNDA: null },
        { requireNDA: true, ndaType: 'custom' as const, customNDA: null }
      ]

      validNDAConfigs.forEach(config => {
        const data: PitchFormData = {
          title: 'Test',
          genre: 'Drama',
          formatCategory: 'Film',
          logline: 'A test logline for validation',
          shortSynopsis: 'A test synopsis that meets the minimum character requirement for validation testing',
          ndaConfig: config,
          seekingInvestment: false
        }

        const result = validatePitchForm(data)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid NDA type', () => {
      const invalidNDAData = {
        title: 'Test',
        genre: 'Drama',
        formatCategory: 'Film',
        logline: 'A test logline for validation',
        shortSynopsis: 'A test synopsis that meets the minimum character requirement for validation testing',
        ndaConfig: {
          requireNDA: true,
          ndaType: 'invalid' as any, // Invalid type
        },
        seekingInvestment: false
      }

      const result = validatePitchForm(invalidNDAData)
      expect(result.success).toBe(false)
    })
  })

  describe('Format Validation', () => {
    it('should validate format categories', () => {
      const validCategories = [
        'Television - Scripted',
        'Television - Unscripted',
        'Film',
        'Animation (Series)',
        'Audio',
        'Digital / Emerging',
        'Stage-to-Screen'
      ]

      validCategories.forEach(category => {
        const data = {
          title: 'Test',
          genre: 'Drama',
          formatCategory: category,
          logline: 'A test logline for validation',
          shortSynopsis: 'A test synopsis that meets the minimum character requirement for validation testing',
          ndaConfig: {
            requireNDA: false,
            ndaType: 'none' as const,
          },
          seekingInvestment: false
        }

        const result = validatePitchForm(data)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid format category', () => {
      const data = {
        title: 'Test',
        genre: 'Drama',
        formatCategory: 'Invalid Category' as any,
        logline: 'A test logline for validation',
        shortSynopsis: 'A test synopsis that meets the minimum character requirement for validation testing',
        ndaConfig: {
          requireNDA: false,
          ndaType: 'none',
        },
        seekingInvestment: false
      }

      const result = validatePitchForm(data)
      expect(result.success).toBe(false)
    })
  })

  describe('Type Safety', () => {
    it('should infer correct types from schema', () => {
      // This test verifies TypeScript compilation
      const data: v.InferOutput<typeof PitchFormSchema> = {
        title: 'Test',
        genre: 'Drama',
        formatCategory: 'Film',
        logline: 'Test logline for validation',
        shortSynopsis: 'Test synopsis that meets the minimum character requirement for validation testing',
        ndaConfig: {
          requireNDA: false,
          ndaType: 'none',
        },
        seekingInvestment: false
      }

      // TypeScript will error if types don't match
      const result = validatePitchForm(data)
      expect(result.success).toBe(true)
    })
  })
})