import { useEffect, useRef, useCallback } from 'react';
import { a11y } from '../utils/accessibility';

interface UseAccessibilityOptions {
  /** Announce messages to screen readers */
  announcements?: boolean;
  /** Enable focus management */
  focusManagement?: boolean;
  /** Enable keyboard navigation */
  keyboardNavigation?: boolean;
  /** Component name for debugging */
  componentName?: string;
}

/**
 * Hook for managing accessibility features in components
 */
export const useAccessibility = (options: UseAccessibilityOptions = {}) => {
  const {
    announcements = true,
    focusManagement = true,
    keyboardNavigation = true,
    componentName = 'Component',
  } = options;

  const previousFocusRef = useRef<HTMLElement | null>(null);
  const announcementTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize accessibility announcer on mount
  useEffect(() => {
    if (announcements) {
      a11y.announcer.createAnnouncer();
    }
  }, [announcements]);

  // Announce message to screen readers
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      if (!announcements) return;

      // Clear previous announcement timeout
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }

      // Delay to ensure screen readers catch the announcement
      announcementTimeoutRef.current = setTimeout(() => {
        a11y.announcer.announce(message, priority);
      }, 100);
    },
    [announcements]
  );

  // Focus management utilities
  const focusUtils = {
    /** Save current focus for later restoration */
    saveFocus: useCallback(() => {
      if (focusManagement) {
        previousFocusRef.current = document.activeElement as HTMLElement;
      }
    }, [focusManagement]),

    /** Restore previously saved focus */
    restoreFocus: useCallback(() => {
      if (focusManagement && previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    }, [focusManagement]),

    /** Focus first focusable element in container */
    focusFirst: useCallback(
      (container: HTMLElement) => {
        if (focusManagement) {
          a11y.focus.focusFirst(container);
        }
      },
      [focusManagement]
    ),

    /** Focus element by ID */
    focusById: useCallback(
      (id: string, fallbackSelector?: string) => {
        if (focusManagement) {
          a11y.focus.focusById(id, fallbackSelector);
        }
      },
      [focusManagement]
    ),

    /** Trap focus within container */
    trapFocus: useCallback(
      (container: HTMLElement) => {
        if (focusManagement) {
          return a11y.focus.trapFocus(container);
        }
        return () => {}; // Return empty cleanup function
      },
      [focusManagement]
    ),
  };

  // Keyboard navigation utilities
  const keyboardUtils = {
    /** Handle escape key */
    handleEscape: useCallback(
      (callback: () => void) => {
        if (keyboardNavigation) {
          return a11y.keyboard.onEscape(callback);
        }
        return () => {}; // Return empty function
      },
      [keyboardNavigation]
    ),

    /** Handle enter/space activation */
    handleActivate: useCallback(
      (callback: () => void) => {
        if (keyboardNavigation) {
          return a11y.keyboard.onActivate(callback);
        }
        return () => {}; // Return empty function
      },
      [keyboardNavigation]
    ),

    /** Handle arrow key navigation */
    handleArrowNavigation: useCallback(
      (config: {
        items: HTMLElement[];
        currentIndex: number;
        onChange: (newIndex: number) => void;
        loop?: boolean;
      }) => {
        if (keyboardNavigation) {
          return a11y.keyboard.arrowNavigation(config);
        }
        return () => {}; // Return empty function
      },
      [keyboardNavigation]
    ),
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  return {
    announce,
    focus: focusUtils,
    keyboard: keyboardUtils,
    // Expose all utility functions
    aria: a11y.aria,
    formField: a11y.formField,
    button: a11y.button,
    modal: a11y.modal,
    navigation: a11y.navigation,
    validation: a11y.validation,
    generateId: a11y.generateId,
    classes: a11y.classes,
  };
};

/**
 * Hook for managing form accessibility
 */
export const useFormAccessibility = (formId: string) => {
  const { announce, validation, formField, generateId } = useAccessibility();

  const announceFormErrors = useCallback(
    (errors: Record<string, string>) => {
      const errorMessages = Object.values(errors).filter(Boolean);
      if (errorMessages.length > 0) {
        announce(`Form contains ${errorMessages.length} error${errorMessages.length > 1 ? 's' : ''}: ${errorMessages.join(', ')}`, 'assertive');
      }
    },
    [announce]
  );

  const announceFormSuccess = useCallback(
    (message?: string) => {
      announce(message || 'Form submitted successfully', 'polite');
    },
    [announce]
  );

  const getFieldAttributes = useCallback(
    (config: {
      name: string;
      label: string;
      required?: boolean;
      error?: string;
      helpText?: string;
    }) => {
      const fieldId = `${formId}-${config.name}`;
      const hasError = Boolean(config.error);
      
      return formField.getAttributes({
        id: fieldId,
        label: config.label,
        required: config.required,
        invalid: hasError,
        errorId: hasError ? `${fieldId}-error` : undefined,
        helpId: config.helpText ? `${fieldId}-help` : undefined,
      });
    },
    [formId, formField]
  );

  const getErrorAttributes = useCallback(
    (fieldName: string) => formField.getErrorAttributes(`${formId}-${fieldName}`),
    [formId, formField]
  );

  const getHelpAttributes = useCallback(
    (fieldName: string) => formField.getHelpAttributes(`${formId}-${fieldName}`),
    [formId, formField]
  );

  return {
    announceFormErrors,
    announceFormSuccess,
    getFieldAttributes,
    getErrorAttributes,
    getHelpAttributes,
    formId,
  };
};

/**
 * Hook for managing modal accessibility
 */
export const useModalAccessibility = () => {
  const { focus, keyboard, modal, announce } = useAccessibility();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const trapFocusCleanup = useRef<(() => void) | null>(null);

  const openModal = useCallback(
    (config?: { labelId?: string; descriptionId?: string; announceOpen?: string }) => {
      // Save current focus
      focus.saveFocus();

      // Announce modal opening
      if (config?.announceOpen) {
        announce(config.announceOpen, 'polite');
      }

      // Trap focus when modal opens
      if (modalRef.current) {
        trapFocusCleanup.current = focus.trapFocus(modalRef.current);
      }

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    },
    [focus, announce]
  );

  const closeModal = useCallback(
    (announceClose?: string) => {
      // Clean up focus trap
      if (trapFocusCleanup.current) {
        trapFocusCleanup.current();
        trapFocusCleanup.current = null;
      }

      // Restore focus
      focus.restoreFocus();

      // Restore body scroll
      document.body.style.overflow = '';

      // Announce modal closing
      if (announceClose) {
        announce(announceClose, 'polite');
      }
    },
    [focus, announce]
  );

  const getModalAttributes = useCallback(
    (config: {
      isOpen: boolean;
      labelId?: string;
      descriptionId?: string;
    }) => modal.getContainerAttributes(config),
    [modal]
  );

  const handleEscapeClose = useCallback(
    (onClose: () => void) => keyboard.handleEscape(() => {
      closeModal('Modal closed');
      onClose();
    }),
    [keyboard, closeModal]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trapFocusCleanup.current) {
        trapFocusCleanup.current();
      }
      document.body.style.overflow = '';
    };
  }, []);

  return {
    modalRef,
    openModal,
    closeModal,
    getModalAttributes,
    handleEscapeClose,
    getBackdropAttributes: modal.getBackdropAttributes,
  };
};

/**
 * Hook for managing live regions and announcements
 */
export const useLiveRegion = () => {
  const { announce } = useAccessibility();
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  const updateLiveRegion = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      // Update live region directly
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = message;
        liveRegionRef.current.setAttribute('aria-live', priority);
      }

      // Also announce via global announcer
      announce(message, priority);
    },
    [announce]
  );

  const clearLiveRegion = useCallback(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
    }
  }, []);

  return {
    liveRegionRef,
    updateLiveRegion,
    clearLiveRegion,
  };
};

export default useAccessibility;