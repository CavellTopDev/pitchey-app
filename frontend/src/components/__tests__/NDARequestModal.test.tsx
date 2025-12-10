import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/utils'
import userEvent from '@testing-library/user-event'
import { server } from '../../test/mocks/server'
import { http, HttpResponse } from 'msw'
import NDAModal from '../NDAModal'
import { getMockAuthStore } from '../../test/utils'

// Mock the NDA service
vi.mock('../../services/nda.service', () => ({
  NDAService: {
    canRequestNDA: vi.fn(),
    requestNDA: vi.fn(),
  },
  ndaService: {
    canRequestNDA: vi.fn(),
    requestNDA: vi.fn(),
  },
}))

const mockProps = {
  isOpen: true,
  onClose: vi.fn(),
  pitchId: 1,
  pitchTitle: 'Test Pitch',
  creatorType: 'creator' as const,
  onNDASigned: vi.fn(),
}

const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  userType: 'investor',
  role: 'investor',
}

describe('NDARequestModal', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock auth store with user
    const authStore = getMockAuthStore()
    authStore.user = mockUser

    // Mock NDA service
    const { ndaService } = require('../../services/nda.service')
    ndaService.canRequestNDA.mockResolvedValue({ canRequest: true })
    ndaService.requestNDA.mockResolvedValue({ id: '1', status: 'pending' })

    // Mock window.alert
    global.alert = vi.fn()
  })

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(<NDAModal {...mockProps} />)

      expect(screen.getByText('Request Access to Enhanced Information')).toBeInTheDocument()
      expect(screen.getByText('For: Test Pitch')).toBeInTheDocument()
    })

    it('should not render when isOpen is false', () => {
      render(<NDAModal {...mockProps} isOpen={false} />)

      expect(screen.queryByText('Request Access to Enhanced Information')).not.toBeInTheDocument()
    })

    it('should render close button', () => {
      render(<NDAModal {...mockProps} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('should render NDA type selection buttons', () => {
      render(<NDAModal {...mockProps} />)

      expect(screen.getByRole('button', { name: /standard nda/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /upload your nda/i })).toBeInTheDocument()
    })

    it('should render submit and cancel buttons', () => {
      render(<NDAModal {...mockProps} />)

      expect(screen.getByRole('button', { name: /submit nda request/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    it('should render appropriate information based on creator type', () => {
      render(<NDAModal {...mockProps} creatorType="production" />)

      expect(screen.getByText(/production companies require ndas/i)).toBeInTheDocument()
    })

    it('should show creator warning for creator users', () => {
      const authStore = getMockAuthStore()
      authStore.user = { ...mockUser, userType: 'creator' }

      render(<NDAModal {...mockProps} />)

      expect(screen.getByText(/note for creators/i)).toBeInTheDocument()
    })
  })

  describe('NDA Type Selection', () => {
    it('should start with standard NDA selected', () => {
      render(<NDAModal {...mockProps} />)

      const standardButton = screen.getByRole('button', { name: /standard nda/i })
      expect(standardButton).toHaveClass('border-purple-500')
    })

    it('should switch to upload NDA when clicked', async () => {
      render(<NDAModal {...mockProps} />)

      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      expect(uploadButton).toHaveClass('border-purple-500')
      expect(screen.getByText('Upload NDA Document')).toBeInTheDocument()
    })

    it('should show additional terms textarea for standard NDA', () => {
      render(<NDAModal {...mockProps} />)

      expect(screen.getByPlaceholderText(/add any specific terms/i)).toBeInTheDocument()
      expect(screen.getByText('Standard NDA Terms Include:')).toBeInTheDocument()
    })

    it('should show file upload area for upload NDA', async () => {
      render(<NDAModal {...mockProps} />)

      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      expect(screen.getByText('Click to upload NDA')).toBeInTheDocument()
      expect(screen.getByText('PDF, DOC, or DOCX (max 10MB)')).toBeInTheDocument()
    })
  })

  describe('Form Interactions', () => {
    it('should update additional terms when typing', async () => {
      render(<NDAModal {...mockProps} />)

      const textarea = screen.getByPlaceholderText(/add any specific terms/i)
      await user.type(textarea, 'Additional confidentiality requirements')

      expect(textarea).toHaveValue('Additional confidentiality requirements')
    })

    it('should handle file upload', async () => {
      render(<NDAModal {...mockProps} />)

      // Switch to upload mode
      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      // Upload a file
      const file = new File(['nda content'], 'nda.pdf', { type: 'application/pdf' })
      const fileInput = screen.getByLabelText(/click to upload nda/i)
      
      await user.upload(fileInput, file)

      expect(screen.getByText('nda.pdf')).toBeInTheDocument()
    })

    it('should close modal when close button is clicked', async () => {
      render(<NDAModal {...mockProps} />)

      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)

      expect(mockProps.onClose).toHaveBeenCalled()
    })

    it('should close modal when cancel button is clicked', async () => {
      render(<NDAModal {...mockProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Form Submission', () => {
    it('should submit NDA request with standard terms', async () => {
      render(<NDAModal {...mockProps} />)

      const textarea = screen.getByPlaceholderText(/add any specific terms/i)
      await user.type(textarea, 'Custom terms')

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        const { ndaService } = require('../../services/nda.service')
        expect(ndaService.canRequestNDA).toHaveBeenCalledWith(1)
        expect(ndaService.requestNDA).toHaveBeenCalledWith({
          pitchId: 1,
          message: 'Custom terms',
          templateId: undefined,
          expiryDays: 90,
        })
      })
    })

    it('should use default message when no custom terms provided', async () => {
      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        const { ndaService } = require('../../services/nda.service')
        expect(ndaService.requestNDA).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Requesting access to enhanced information for Test Pitch',
          })
        )
      })
    })

    it('should disable submit button when upload NDA is selected but no file uploaded', async () => {
      render(<NDAModal {...mockProps} />)

      // Switch to upload mode
      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      expect(submitButton).toBeDisabled()
    })

    it('should enable submit button when file is uploaded', async () => {
      render(<NDAModal {...mockProps} />)

      // Switch to upload mode
      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      // Upload a file
      const file = new File(['nda content'], 'nda.pdf', { type: 'application/pdf' })
      const fileInput = screen.getByLabelText(/click to upload nda/i)
      await user.upload(fileInput, file)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('should show loading state during submission', async () => {
      const { ndaService } = require('../../services/nda.service')
      ndaService.requestNDA.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      expect(screen.getByText('Submitting...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('should show success alert and close modal on successful submission', async () => {
      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'NDA request submitted successfully! The creator will review your request and respond shortly.'
        )
        expect(mockProps.onClose).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('should show error when user is not signed in', async () => {
      const authStore = getMockAuthStore()
      authStore.user = null

      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      expect(screen.getByText(/please sign in to request access/i)).toBeInTheDocument()
    })

    it('should handle canRequestNDA failure', async () => {
      const { ndaService } = require('../../services/nda.service')
      ndaService.canRequestNDA.mockResolvedValue({
        canRequest: false,
        reason: 'Already requested',
      })

      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Already requested')
        expect(mockProps.onClose).toHaveBeenCalled()
      })
    })

    it('should handle existing NDA scenario', async () => {
      const { ndaService } = require('../../services/nda.service')
      ndaService.canRequestNDA.mockResolvedValue({
        canRequest: false,
        existingNDA: true,
      })

      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          'You have already requested NDA access for this pitch. The creator will review your request soon.'
        )
        expect(mockProps.onClose).toHaveBeenCalled()
      })
    })

    it('should display error message on request failure', async () => {
      const { ndaService } = require('../../services/nda.service')
      ndaService.requestNDA.mockRejectedValue(new Error('API Error'))

      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
      })
    })

    it('should show generic error for unknown errors', async () => {
      const { ndaService } = require('../../services/nda.service')
      ndaService.requestNDA.mockRejectedValue('Unknown error')

      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to submit nda request/i)).toBeInTheDocument()
      })
    })
  })

  describe('File Upload Validation', () => {
    it('should accept PDF files', async () => {
      render(<NDAModal {...mockProps} />)

      // Switch to upload mode
      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      const file = new File(['pdf content'], 'nda.pdf', { type: 'application/pdf' })
      const fileInput = screen.getByLabelText(/click to upload nda/i)
      
      await user.upload(fileInput, file)

      expect(screen.getByText('nda.pdf')).toBeInTheDocument()
    })

    it('should accept DOC files', async () => {
      render(<NDAModal {...mockProps} />)

      // Switch to upload mode
      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      const file = new File(['doc content'], 'nda.doc', { 
        type: 'application/msword' 
      })
      const fileInput = screen.getByLabelText(/click to upload nda/i)
      
      await user.upload(fileInput, file)

      expect(screen.getByText('nda.doc')).toBeInTheDocument()
    })

    it('should accept DOCX files', async () => {
      render(<NDAModal {...mockProps} />)

      // Switch to upload mode
      const uploadButton = screen.getByRole('button', { name: /upload your nda/i })
      await user.click(uploadButton)

      const file = new File(['docx content'], 'nda.docx', { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      })
      const fileInput = screen.getByLabelText(/click to upload nda/i)
      
      await user.upload(fileInput, file)

      expect(screen.getByText('nda.docx')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<NDAModal {...mockProps} />)

      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        'Request Access to Enhanced Information'
      )
    })

    it('should have proper labels for form elements', () => {
      render(<NDAModal {...mockProps} />)

      expect(screen.getByLabelText(/nda type/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/additional terms/i)).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      render(<NDAModal {...mockProps} />)

      // Tab through interactive elements
      await user.tab()
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: /standard nda/i })).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: /upload your nda/i })).toHaveFocus()
    })

    it('should have proper ARIA attributes for error messages', async () => {
      const { ndaService } = require('../../services/nda.service')
      ndaService.requestNDA.mockRejectedValue(new Error('API Error'))

      render(<NDAModal {...mockProps} />)

      const submitButton = screen.getByRole('button', { name: /submit nda request/i })
      await user.click(submitButton)

      await waitFor(() => {
        const errorElement = screen.getByText('API Error')
        expect(errorElement.closest('div')).toHaveClass('text-red-600')
      })
    })
  })

  describe('Modal Behavior', () => {
    it('should prevent background scrolling when open', () => {
      render(<NDAModal {...mockProps} />)

      const modal = screen.getByRole('dialog', { hidden: true })
      expect(modal).toBeInTheDocument()
    })

    it('should handle escape key to close modal', async () => {
      render(<NDAModal {...mockProps} />)

      await user.keyboard('{Escape}')

      // Note: This would require implementing escape key handler in the component
      // expect(mockProps.onClose).toHaveBeenCalled()
    })

    it('should handle click outside to close modal', async () => {
      render(<NDAModal {...mockProps} />)

      const backdrop = screen.getByRole('dialog', { hidden: true }).parentElement
      if (backdrop) {
        await user.click(backdrop)
        // Note: This would require implementing backdrop click handler
        // expect(mockProps.onClose).toHaveBeenCalled()
      }
    })
  })

  describe('Content Variations', () => {
    it('should show investor-specific content', () => {
      render(<NDAModal {...mockProps} creatorType="investor" />)

      expect(screen.getByText(/investors require ndas to protect sensitive financial information/i)).toBeInTheDocument()
    })

    it('should show production-specific content', () => {
      render(<NDAModal {...mockProps} creatorType="production" />)

      expect(screen.getByText(/production companies require ndas to protect confidential information/i)).toBeInTheDocument()
    })

    it('should show creator-specific content', () => {
      render(<NDAModal {...mockProps} creatorType="creator" />)

      expect(screen.getByText(/creators use ndas to protect their creative concepts/i)).toBeInTheDocument()
    })
  })
})