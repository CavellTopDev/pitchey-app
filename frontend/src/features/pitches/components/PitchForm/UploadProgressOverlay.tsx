/**
 * Upload Progress Overlay
 * Shows detailed upload progress during pitch creation
 */

import React from 'react';
import { X, CheckCircle, AlertCircle, Upload, Loader2 } from 'lucide-react';
import type { PendingUpload } from '../../hooks/usePitchUploadManager';

interface UploadProgressOverlayProps {
  isVisible: boolean;
  uploads: PendingUpload[];
  overallProgress: number;
  currentStep: 'form' | 'creating' | 'uploading' | 'complete';
  onCancel?: () => void;
}

export function UploadProgressOverlay({
  isVisible,
  uploads,
  overallProgress,
  currentStep,
  onCancel
}: UploadProgressOverlayProps) {
  if (!isVisible) return null;

  const getStepLabel = () => {
    switch (currentStep) {
      case 'form':
        return 'Validating form...';
      case 'creating':
        return 'Creating pitch...';
      case 'uploading':
        return 'Uploading files...';
      case 'complete':
        return 'Finalizing...';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = (status: PendingUpload['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'uploading':
        return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />;
      default:
        return <Upload className="w-4 h-4 text-gray-400" />;
    }
  };

  const completedCount = uploads.filter(u => u.status === 'completed').length;
  const errorCount = uploads.filter(u => u.status === 'error').length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {getStepLabel()}
          </h3>
          {onCancel && currentStep !== 'complete' && (
            <button
              onClick={onCancel}
              className="p-1 hover:bg-gray-100 rounded-full transition"
              aria-label="Cancel"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}
        </div>

        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Overall Progress</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* File List */}
        {uploads.length > 0 && currentStep === 'uploading' && (
          <div className="space-y-3 max-h-48 overflow-y-auto">
            <div className="text-sm text-gray-500 mb-2">
              {completedCount} of {uploads.length} files uploaded
              {errorCount > 0 && ` (${errorCount} failed)`}
            </div>

            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
              >
                {getStatusIcon(upload.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {upload.file.name}
                  </p>
                  {upload.status === 'uploading' && (
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                      <div
                        className="bg-purple-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                  {upload.status === 'error' && upload.error && (
                    <p className="text-xs text-red-500 mt-1">{upload.error}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {upload.status === 'uploading' ? `${upload.progress}%` :
                   upload.status === 'completed' ? 'Done' :
                   upload.status === 'error' ? 'Failed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Step Indicator */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <StepIndicator step={1} label="Create" active={currentStep === 'creating'} complete={currentStep === 'uploading' || currentStep === 'complete'} />
          <div className="w-8 h-0.5 bg-gray-200" />
          <StepIndicator step={2} label="Upload" active={currentStep === 'uploading'} complete={currentStep === 'complete'} />
          <div className="w-8 h-0.5 bg-gray-200" />
          <StepIndicator step={3} label="Done" active={currentStep === 'complete'} complete={false} />
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step, label, active, complete }: { step: number; label: string; active: boolean; complete: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
          complete ? 'bg-green-500 text-white' :
          active ? 'bg-purple-600 text-white' :
          'bg-gray-200 text-gray-500'
        }`}
      >
        {complete ? <CheckCircle className="w-4 h-4" /> : step}
      </div>
      <span className={`text-xs mt-1 ${active ? 'text-purple-600 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

export default UploadProgressOverlay;
