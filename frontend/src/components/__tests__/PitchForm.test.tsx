import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, waitForElementToBeRemoved } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'
import CreatePitch from '../../pages/CreatePitch'
import { getMockAuthStore } from '../../test/utils'

// Mock dependencies
vi.mock('../../services/pitch.service', () => ({
  pitchService: {
    create: vi.fn(),
  },
}))

vi.mock('../../services/upload.service', () => ({
  uploadService: {
    uploadFile: vi.fn(),
  },
}))

vi.mock('../../components/Toast/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}))

// Mock validation utilities
vi.mock('../../utils/validation', () => ({
  validatePitchForm: vi.fn(() => ({ isValid: true, errors: {} })),
  FormValidator: vi.fn(() => ({
    validate: vi.fn(() => ({ isValid: true, errors: {} })),
  })),
  validationSchemas: {
    pitch: {
      title: vi.fn(() => true),
      logline: vi.fn(() => true),
    },
  },
}))

// Mock character utilities  
vi.mock('../../utils/characterUtils', () => ({
  serializeCharacters: vi.fn(() => []),
}))

// Mock constants
vi.mock('../../constants/pitchConstants', () => ({
  getGenresSync: vi.fn(() => ['Drama', 'Comedy', 'Thriller']),
  getFormatsSync: vi.fn(() => ['Feature Film', 'TV Series', 'Short Film']),
  FALLBACK_GENRES: ['Drama', 'Comedy', 'Thriller'],
}))

// Mock constants/messages
vi.mock('../../constants/messages', () => ({
  MESSAGES: {
    pitch: {
      create: {
        success: 'Pitch created successfully',
        error: 'Failed to create pitch',
      },
    },
  },
  VALIDATION_MESSAGES: {
    required: 'This field is required',
  },
  SUCCESS_MESSAGES: {
    pitchCreated: 'Pitch created successfully',
  },
  ERROR_MESSAGES: {
    pitchCreateFailed: 'Failed to create pitch',
  },
}))

vi.mock('../../utils/accessibility', () => ({
  a11y: {
    announcer: {
      createAnnouncer: vi.fn(),
      announce: vi.fn(),
    },
    validation: {
      announceFieldError: vi.fn(),
      announceErrors: vi.fn(),
      announceSuccess: vi.fn(),
    },
    focus: {
      focusById: vi.fn(),
    },
    button: {
      getAttributes: vi.fn(() => ({})),
    },
    formField: {
      getLabelAttributes: vi.fn(() => ({})),
      getAttributes: vi.fn(() => ({})),
      getErrorAttributes: vi.fn(() => ({})),
      getHelpAttributes: vi.fn(() => ({})),
    },
    fileUpload: {
      getDropZoneAttributes: vi.fn(() => ({})),
      getInputAttributes: vi.fn(() => ({})),
    },
    keyboard: {
      onActivate: vi.fn(() => vi.fn()),
    },
    aria: {
      labelledBy: vi.fn(() => ({})),
    },
    classes: {
      focusVisible: 'focus-visible',
      srOnly: 'sr-only',
      disabledElement: 'disabled',
    },
  },
}))

// Mock character utils
vi.mock('../../utils/characterUtils', () => ({
  serializeCharacters: vi.fn((chars) => chars),
}))

const mockCreatorUser = {
  id: '1',
  email: 'creator@test.com',
  username: 'testcreator',
  name: 'Test Creator',
  role: 'creator',
}

describe('PitchForm (CreatePitch)', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Setup auth store
    const authStore = getMockAuthStore()
    authStore.user = mockCreatorUser
    authStore.isAuthenticated = true

    // Mock pitch service
    const { pitchService } = require('../../services/pitch.service')
    pitchService.create.mockResolvedValue({
      id: '1',
      title: 'Test Pitch',
      status: 'draft',
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('Form Rendering', () => {
    it('should render all form sections', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        expect(screen.getByText('Create New Pitch')).toBeInTheDocument()
        expect(screen.getByText('Basic Information')).toBeInTheDocument()
        expect(screen.getByText('Themes & World Building')).toBeInTheDocument()
        expect(screen.getByText('Upload Documents')).toBeInTheDocument()
        expect(screen.getByText('NDA Configuration')).toBeInTheDocument()
        expect(screen.getByText('Media & Assets')).toBeInTheDocument()
      })
    })

    it('should render all required form fields', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/genre/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/format category/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/logline/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/short synopsis/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/themes/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/world & setting/i)).toBeInTheDocument()
      })
    })

    it('should show submit and cancel buttons', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create pitch/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      render(<CreatePitch />)

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/title.*required/i)).toBeInTheDocument()
        expect(screen.getByText(/genre.*required/i)).toBeInTheDocument()
        expect(screen.getByText(/format.*required/i)).toBeInTheDocument()
        expect(screen.getByText(/logline.*required/i)).toBeInTheDocument()
        expect(screen.getByText(/synopsis.*required/i)).toBeInTheDocument()
      })
    })

    it('should validate title length', async () => {
      render(<CreatePitch />)

      const titleInput = screen.getByLabelText(/title/i)
      await user.type(titleInput, 'A'.repeat(101)) // Assuming max length is 100
      await user.tab() // Trigger blur

      await waitFor(() => {
        expect(screen.getByText(/title.*too long/i)).toBeInTheDocument()
      })
    })

    it('should validate logline length', async () => {
      render(<CreatePitch />)

      const loglineInput = screen.getByLabelText(/logline/i)
      await user.type(loglineInput, 'A'.repeat(501)) // Assuming max length is 500
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/logline.*too long/i)).toBeInTheDocument()
      })
    })

    it('should show real-time validation for touched fields', async () => {
      render(<CreatePitch />)

      const titleInput = screen.getByLabelText(/title/i)
      await user.type(titleInput, 'Valid Title')
      await user.clear(titleInput)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByText(/title.*required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Interactions', () => {
    it('should update form data when typing in fields', async () => {
      render(<CreatePitch />)

      const titleInput = screen.getByLabelText(/title/i)
      await user.type(titleInput, 'My Test Pitch')

      expect(titleInput).toHaveValue('My Test Pitch')
    })

    it('should show format subtypes when category is selected', async () => {
      render(<CreatePitch />)

      const categorySelect = screen.getByLabelText(/format category/i)
      await user.selectOptions(categorySelect, 'Film')

      await waitFor(() => {
        expect(screen.getByLabelText(/format subtype/i)).toBeInTheDocument()
      })
    })

    it('should show custom format field when "Custom Format" is selected', async () => {
      render(<CreatePitch />)

      const categorySelect = screen.getByLabelText(/format category/i)
      await user.selectOptions(categorySelect, 'Other')

      await waitFor(async () => {
        const subtypeSelect = screen.getByLabelText(/format subtype/i)
        await user.selectOptions(subtypeSelect, 'Custom Format (please specify)')
      })

      await waitFor(() => {
        expect(screen.getByLabelText(/custom format/i)).toBeInTheDocument()
      })
    })

    it('should update character count display', async () => {
      render(<CreatePitch />)

      const synopsisInput = screen.getByLabelText(/short synopsis/i)
      await user.type(synopsisInput, 'This is a test synopsis')

      await waitFor(() => {
        expect(screen.getByText(/23\/1000/)).toBeInTheDocument()
      })
    })
  })

  describe('File Upload', () => {
    it('should handle image file upload', async () => {
      render(<CreatePitch />)

      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' })
      const imageInput = screen.getByLabelText(/cover image/i)

      await user.upload(imageInput, file)

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument()
      })
    })

    it('should handle PDF file upload', async () => {
      render(<CreatePitch />)

      const file = new File(['test pdf'], 'script.pdf', { type: 'application/pdf' })
      const pdfInput = screen.getByLabelText(/script pdf/i)

      await user.upload(pdfInput, file)

      await waitFor(() => {
        expect(screen.getByText('script.pdf')).toBeInTheDocument()
      })
    })

    it('should handle video file upload', async () => {
      render(<CreatePitch />)

      const file = new File(['test video'], 'pitch.mp4', { type: 'video/mp4' })
      const videoInput = screen.getByLabelText(/pitch video/i)

      await user.upload(videoInput, file)

      await waitFor(() => {
        expect(screen.getByText('pitch.mp4')).toBeInTheDocument()
      })
    })

    it('should allow file removal', async () => {
      render(<CreatePitch />)

      const file = new File(['test image'], 'test.jpg', { type: 'image/jpeg' })
      const imageInput = screen.getByLabelText(/cover image/i)

      await user.upload(imageInput, file)

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument()
      })

      const removeButton = screen.getByRole('button', { name: /remove/i })
      await user.click(removeButton)

      await waitFor(() => {
        expect(screen.queryByText('test.jpg')).not.toBeInTheDocument()
      })
    })

    it('should validate file types', async () => {
      render(<CreatePitch />)

      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      const imageInput = screen.getByLabelText(/cover image/i)

      await user.upload(imageInput, invalidFile)

      await waitFor(() => {
        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument()
      })
    })

    it('should validate file sizes', async () => {
      render(<CreatePitch />)

      // Create a large file (over limit)
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      })
      Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 })

      const imageInput = screen.getByLabelText(/cover image/i)
      await user.upload(imageInput, largeFile)

      await waitFor(() => {
        expect(screen.getByText(/file too large/i)).toBeInTheDocument()
      })
    })
  })

  describe('NDA Configuration', () => {
    it('should show NDA options', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        expect(screen.getByText('No NDA Required')).toBeInTheDocument()
        expect(screen.getByText('Use Platform Standard NDA')).toBeInTheDocument()
        expect(screen.getByText('Use Custom NDA')).toBeInTheDocument()
      })
    })

    it('should show custom NDA upload when selected', async () => {
      render(<CreatePitch />)

      const customNDARadio = screen.getByLabelText(/use custom nda/i)
      await user.click(customNDARadio)

      await waitFor(() => {
        expect(screen.getByText('Upload Custom NDA')).toBeInTheDocument()
      })
    })

    it('should handle custom NDA file upload', async () => {
      render(<CreatePitch />)

      const customNDARadio = screen.getByLabelText(/use custom nda/i)
      await user.click(customNDARadio)

      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload nda/i })
        expect(uploadButton).toBeInTheDocument()
      })
    })

    it('should show NDA protection info when NDA is required', async () => {
      render(<CreatePitch />)

      const platformNDARadio = screen.getByLabelText(/platform standard nda/i)
      await user.click(platformNDARadio)

      await waitFor(() => {
        expect(screen.getByText('NDA Protection Active')).toBeInTheDocument()
      })
    })
  })

  describe('Character Management', () => {
    it('should render character management section', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        // The CharacterManagement component should be rendered
        expect(screen.getByText(/character/i)).toBeInTheDocument()
      })
    })
  })

  describe('Document Upload', () => {
    it('should render document upload section', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        expect(screen.getByText('Upload Documents')).toBeInTheDocument()
        expect(screen.getByText('Document Guidelines')).toBeInTheDocument()
      })
    })
  })

  describe('Form Submission', () => {
    const fillValidForm = async () => {
      const titleInput = screen.getByLabelText(/title/i)
      const genreSelect = screen.getByLabelText(/genre/i)
      const categorySelect = screen.getByLabelText(/format category/i)
      const loglineInput = screen.getByLabelText(/logline/i)
      const synopsisInput = screen.getByLabelText(/short synopsis/i)

      await user.type(titleInput, 'Test Pitch Title')
      await user.selectOptions(genreSelect, 'Drama')
      await user.selectOptions(categorySelect, 'Film')
      
      await waitFor(async () => {
        const subtypeSelect = screen.getByLabelText(/format subtype/i)
        await user.selectOptions(subtypeSelect, 'Feature Narrative (live action)')
      })

      await user.type(loglineInput, 'A compelling story about...')
      await user.type(synopsisInput, 'This is a test synopsis for the pitch')
    }

    it('should submit form with valid data', async () => {
      const { pitchService } = require('../../services/pitch.service')
      render(<CreatePitch />)

      await fillValidForm()

      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(pitchService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Pitch Title',
            genre: 'Drama',
            format: 'Feature Narrative (live action)',
            logline: 'A compelling story about...',
            shortSynopsis: 'This is a test synopsis for the pitch',
          })
        )
      })
    })

    it('should show loading state during submission', async () => {
      const { pitchService } = require('../../services/pitch.service')
      // Make the service return a delayed promise
      pitchService.create.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<CreatePitch />)

      await fillValidForm()

      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      expect(screen.getByText(/creating/i)).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('should navigate to pitches page on successful submission', async () => {
      const { navigate } = render(<CreatePitch />)

      await fillValidForm()

      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(navigate).toHaveBeenCalledWith('/creator/pitches')
      })
    })

    it('should handle submission errors', async () => {
      const { pitchService } = require('../../services/pitch.service')
      pitchService.create.mockRejectedValue(new Error('API Error'))

      render(<CreatePitch />)

      await fillValidForm()

      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to create pitch/i)).toBeInTheDocument()
      })
    })

    it('should prevent submission with invalid data', async () => {
      const { pitchService } = require('../../services/pitch.service')
      render(<CreatePitch />)

      // Submit without filling required fields
      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      expect(pitchService.create).not.toHaveBeenCalled()
    })
  })

  describe('Navigation', () => {
    it('should navigate back when clicking back button', async () => {
      const { navigate } = render(<CreatePitch />)

      const backButton = screen.getByRole('button', { name: /go back/i })
      await user.click(backButton)

      expect(navigate).toHaveBeenCalledWith('/creator/dashboard')
    })

    it('should navigate back when clicking cancel', async () => {
      const { navigate } = render(<CreatePitch />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(navigate).toHaveBeenCalledWith('/creator/dashboard')
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/genre/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/logline/i)).toBeInTheDocument()
      })
    })

    it('should have proper heading structure', async () => {
      render(<CreatePitch />)

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1, name: /create new pitch/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: /basic information/i })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: /themes & world building/i })).toBeInTheDocument()
      })
    })

    it('should announce form errors to screen readers', async () => {
      const { a11y } = require('../../utils/accessibility')
      render(<CreatePitch />)

      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(a11y.validation.announceErrors).toHaveBeenCalled()
      })
    })

    it('should focus first error field on validation failure', async () => {
      const { a11y } = require('../../utils/accessibility')
      render(<CreatePitch />)

      const submitButton = screen.getByRole('button', { name: /create pitch/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(a11y.focus.focusById).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle genre loading failure gracefully', async () => {
      // Mock failed genre loading
      vi.doMock('../../constants/pitchConstants', () => ({
        getGenres: vi.fn().mockRejectedValue(new Error('Failed to load')),
        getFormats: vi.fn().mockResolvedValue(['Film', 'TV']),
        getGenresSync: vi.fn().mockReturnValue(['Drama', 'Comedy']),
        getFormatsSync: vi.fn().mockReturnValue(['Film', 'TV']),
        FALLBACK_GENRES: ['Drama', 'Comedy', 'Action'],
      }))

      render(<CreatePitch />)

      await waitFor(() => {
        const genreSelect = screen.getByLabelText(/genre/i)
        expect(genreSelect).toBeInTheDocument()
        // Should show fallback genres
        expect(screen.getByRole('option', { name: 'Drama' })).toBeInTheDocument()
      })
    })
  })
})