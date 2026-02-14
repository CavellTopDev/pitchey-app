import { useState, useCallback } from 'react';
import { UIActionsService } from '../services/ui-actions.service';
import { toast } from 'react-hot-toast';

/**
 * Hook for scheduling meetings
 */
export function useScheduleMeeting() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleMeeting = useCallback(async (
    recipientId: string,
    subject: string,
    meetingType: 'pitch' | 'investment' | 'production' | 'demo' = 'pitch',
    options?: {
      proposedTimes?: string[];
      message?: string;
    }
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await UIActionsService.scheduleMeeting({
        recipientId,
        subject,
        meetingType,
        ...options,
      });
      
      if (result.success) {
        toast.success(result.message || 'Meeting scheduled successfully');
      } else {
        toast.error(result.error || 'Failed to schedule meeting');
      }
      
      return result;
    } catch (err: any) {
      const message = err?.message || 'Failed to schedule meeting';
      setError(message);
      toast.error(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  return { scheduleMeeting, loading, error };
}

/**
 * Hook for requesting demos
 */
export function useRequestDemo() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const requestDemo = useCallback(async (
    data: {
      pitchId?: string;
      name: string;
      email: string;
      company?: string;
      message?: string;
      preferredTime?: string;
    },
    type: 'platform' | 'pitch' = 'pitch'
  ) => {
    setLoading(true);
    
    try {
      const result = await UIActionsService.requestDemo({
        ...data,
        requestType: type,
      });
      
      if (result.success) {
        setSubmitted(true);
        toast.success(result.message || 'Demo request submitted');
      }
      
      return result;
    } catch (err) {
      toast.error('Failed to submit demo request');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return { requestDemo, loading, submitted };
}

/**
 * Hook for sharing content
 */
export function useShare() {
  const [loading, setLoading] = useState(false);

  const share = useCallback(async (
    type: 'pitch' | 'profile' | 'investment',
    id: string,
    options?: {
      platform?: 'twitter' | 'linkedin' | 'facebook' | 'copy';
      title?: string;
      description?: string;
      url?: string;
    }
  ) => {
    setLoading(true);
    
    try {
      const result = await UIActionsService.shareContent({
        type,
        id,
        ...options,
      });
      
      if (result.success) {
        toast.success(result.message || 'Shared successfully');
      } else if (result.showModal) {
        // Return modal data for component to handle
        return result;
      }
      
      return result;
    } catch (err) {
      toast.error('Failed to share');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return { share, loading };
}

/**
 * Hook for exporting data
 */
export function useExport() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const exportData = useCallback(async (
    type: 'analytics' | 'report' | 'pitches' | 'investments',
    format: 'pdf' | 'csv' | 'excel' = 'csv',
    filters?: Record<string, any>
  ) => {
    setLoading(true);
    setProgress(0);
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const result = await UIActionsService.exportData({
        type,
        format,
        filters,
      });
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (result.success) {
        toast.success(result.message || 'Export completed');
      } else if ('error' in result) {
        const errorMsg = typeof result.error === 'string' ? result.error : 'Export failed';
        toast.error(errorMsg);
      }
      
      return result;
    } catch (err) {
      toast.error('Export failed');
      return { success: false };
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, []);

  return { exportData, loading, progress };
}

/**
 * Hook for 2FA management
 */
export function useTwoFactor() {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationRequired, setVerificationRequired] = useState(false);

  const enableTwoFactor = useCallback(async (
    method: 'sms' | 'totp' | 'email',
    contact?: string
  ) => {
    setLoading(true);
    
    try {
      const data: any = { method };
      if (method === 'sms') data.phoneNumber = contact;
      if (method === 'email') data.email = contact;
      
      const result = await UIActionsService.enableTwoFactor(data);
      
      if (result.success) {
        if (result.qrCode) {
          setQrCode(result.qrCode);
          setBackupCodes(result.backupCodes || []);
        }
        if (result.verificationRequired) {
          setVerificationRequired(true);
        }
        toast.success('2FA setup initiated');
      } else {
        toast.error(result.error || '2FA setup failed');
      }
      
      return result;
    } catch (err) {
      toast.error('Failed to enable 2FA');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyCode = useCallback(async (code: string) => {
    setLoading(true);
    
    try {
      const result = await UIActionsService.verifyTwoFactor(code);
      
      if (result.success) {
        toast.success('2FA enabled successfully');
        setVerificationRequired(false);
      } else {
        toast.error(result.error || 'Invalid code');
      }
      
      return result;
    } catch (err) {
      toast.error('Verification failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    enableTwoFactor,
    verifyCode,
    loading,
    qrCode,
    backupCodes,
    verificationRequired,
  };
}

/**
 * Hook for verification badge
 */
export function useVerificationBadge() {
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);

  const startVerification = useCallback(async (
    type: 'creator' | 'investor' | 'production',
    documents?: File[],
    additionalInfo?: any
  ) => {
    setLoading(true);
    
    try {
      const result = await UIActionsService.startVerification({
        type,
        documents,
        ...additionalInfo,
      });
      
      if (result.success) {
        setVerificationStatus(result.status || 'pending');
        toast.success(result.message || 'Verification started');
      } else {
        toast.error(result.error || 'Verification failed');
      }
      
      return result;
    } catch (err) {
      toast.error('Failed to start verification');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return { startVerification, loading, verificationStatus };
}

/**
 * Hook for bulk actions
 */
export function useBulkActions() {
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedItems(ids);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const performBulkAction = useCallback(async (
    type: 'nda' | 'pitch' | 'investment' | 'message',
    action: 'approve' | 'reject' | 'delete' | 'archive' | 'export',
    reason?: string
  ) => {
    if (selectedItems.length === 0) {
      toast.error('No items selected');
      return { success: false };
    }
    
    setLoading(true);
    
    try {
      const result = await UIActionsService.performBulkAction({
        type,
        action,
        ids: selectedItems,
        reason,
      });
      
      if (result.success) {
        toast.success(result.message || 'Bulk action completed');
        setSelectedItems([]);
      } else {
        toast.error('Some items failed to process');
      }
      
      return result;
    } catch (err) {
      toast.error('Bulk action failed');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, [selectedItems]);

  return {
    selectedItems,
    toggleSelection,
    selectAll,
    clearSelection,
    performBulkAction,
    loading,
    hasSelection: selectedItems.length > 0,
    selectionCount: selectedItems.length,
  };
}

/**
 * Hook for drag and drop reordering
 */
export function useDragReorder<T extends { id: string }>(
  initialItems: T[],
  type: 'pipeline' | 'playlist' | 'gallery'
) {
  const [items, setItems] = useState(initialItems);
  const [draggedItem, setDraggedItem] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDragStart = useCallback((item: T) => {
    setDraggedItem(item);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((targetItem: T) => {
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    
    setItems(prevItems => {
      const newItems = [...prevItems];
      const draggedIndex = newItems.findIndex(item => item.id === draggedItem.id);
      const targetIndex = newItems.findIndex(item => item.id === targetItem.id);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        newItems.splice(draggedIndex, 1);
        newItems.splice(targetIndex, 0, draggedItem);
      }
      
      return newItems;
    });
    
    setDraggedItem(null);
  }, [draggedItem]);

  const saveOrder = useCallback(async () => {
    setSaving(true);
    
    try {
      const orderedItems = items.map((item, index) => ({
        id: item.id,
        position: index,
      }));
      
      const result = await UIActionsService.reorderItems({
        type,
        items: orderedItems,
      });
      
      if (result.success) {
        toast.success(result.message || 'Order saved');
      }
      
      return result;
    } catch (err) {
      toast.error('Failed to save order');
      return { success: false };
    } finally {
      setSaving(false);
    }
  }, [items, type]);

  return {
    items,
    setItems,
    draggedItem,
    handleDragStart,
    handleDragOver,
    handleDrop,
    saveOrder,
    saving,
  };
}

/**
 * Hook for payment methods
 */
export function usePaymentMethods() {
  const [loading, setLoading] = useState(false);
  const [requiresAction, setRequiresAction] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const addPaymentMethod = useCallback(async (
    type: 'card' | 'bank' | 'paypal',
    token?: string
  ) => {
    setLoading(true);
    setRequiresAction(false);
    
    try {
      const result = await UIActionsService.addPaymentMethod({
        type,
        token,
        returnUrl: window.location.href,
      });

      if (result && result.success) {
        if ((result as any).requiresAction && (result as any).clientSecret) {
          setRequiresAction(true);
          setClientSecret((result as any).clientSecret);
        } else {
          toast.success((result as any).message || 'Payment method added');
        }
      } else if (result) {
        const errorMsg = typeof (result as any).error === 'string' ? (result as any).error : (result as any).error?.message || 'Failed to add payment method';
        toast.error(errorMsg);
      }
      
      return result;
    } catch (err) {
      toast.error('Failed to add payment method');
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    addPaymentMethod,
    loading,
    requiresAction,
    clientSecret,
  };
}