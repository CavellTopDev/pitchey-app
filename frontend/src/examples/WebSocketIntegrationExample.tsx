// This file demonstrates how to integrate all the WebSocket components
// into existing Pitchey frontend pages

import React, { useState } from 'react';
import LiveMetrics from '../components/LiveMetrics';
import NotificationDropdown from '../components/NotificationDropdown';
import PresenceIndicator, { OnlineUsersList, PresenceStatusSelector } from '../components/PresenceIndicator';
import TypingIndicator, { TypingInput, TypingTextArea } from '../components/TypingIndicator';
import UploadProgressList, { UploadProgressBadge, UploadProgressModal } from '../components/UploadProgress';
import LiveViewCounter, { ViewerList, ViewAnalytics, LiveViewBadge } from '../components/LiveViewCounter';
import { useDraftSync } from '../hooks/useDraftSync';
import { useWebSocket } from '../contexts/WebSocketContext';

// Example 1: Enhanced Creator Dashboard with Real-time Metrics
export function EnhancedCreatorDashboard() {
  const { connectionStatus, isConnected } = useWebSocket();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Notifications */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Creator Dashboard</h1>
            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 text-xs px-2 py-1 rounded-full ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                }`}></div>
                <span>{isConnected ? 'Live' : 'Offline'}</span>
              </div>
              
              {/* Upload Progress Badge */}
              <UploadProgressBadge />
              
              {/* Notifications */}
              <NotificationDropdown />
              
              {/* Presence Status Selector */}
              <PresenceStatusSelector
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Live Metrics */}
            <LiveMetrics 
              showConnectionStatus={true}
              refreshInterval={30000}
            />

            {/* Recent Pitches with Live View Counters */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Your Pitches</h2>
              </div>
              <div className="p-6 space-y-4">
                {[1, 2, 3].map((pitchId) => (
                  <div key={pitchId} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">Pitch Title {pitchId}</h3>
                      <p className="text-sm text-gray-500">Created 2 days ago</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <LiveViewBadge pitchId={pitchId} />
                      <LiveViewCounter 
                        pitchId={pitchId}
                        showUniqueViewers={true}
                        showRecentViewers={true}
                        animated={true}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Online Users */}
            <div className="bg-white rounded-lg shadow p-6">
              <OnlineUsersList 
                maxUsers={10}
                showUsernames={true}
                showActivity={true}
              />
            </div>

            {/* Upload Progress */}
            <UploadProgressList 
              position="relative"
              maxItems={3}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Example 2: Enhanced Pitch Detail Page with Real-time Features
export function EnhancedPitchDetail({ pitchId }: { pitchId: number }) {
  const [comment, setComment] = useState('');

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Pitch Header with Live Data */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Pitch Title</h1>
            <div className="flex items-center space-x-4">
              <LiveViewBadge pitchId={pitchId} />
              <LiveViewCounter 
                pitchId={pitchId}
                size="lg"
                showUniqueViewers={true}
                showRecentViewers={true}
              />
            </div>
          </div>
        </div>
        
        {/* Pitch Content */}
        <div className="p-6">
          <p className="text-gray-700 mb-6">
            This is the pitch description and content...
          </p>
          
          {/* View Analytics */}
          <ViewAnalytics pitchId={pitchId} />
        </div>
      </div>

      {/* Comments Section with Typing Indicators */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Comments</h2>
        </div>
        
        <div className="p-6">
          {/* Existing Comments */}
          <div className="space-y-4 mb-6">
            {[1, 2, 3].map((commentId) => (
              <div key={commentId} className="flex space-x-3">
                <div className="flex-shrink-0">
                  <PresenceIndicator userId={commentId} size="sm" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">User {commentId}</span>
                    <span className="text-sm text-gray-500">2 hours ago</span>
                  </div>
                  <p className="text-gray-700 mt-1">Great pitch! Really impressed with the concept.</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Typing Indicators */}
          <TypingIndicator 
            conversationId={pitchId}
            maxDisplayUsers={3}
            showAvatars={true}
          />
          
          {/* Comment Input */}
          <div className="mt-4">
            <TypingTextArea
              conversationId={pitchId}
              placeholder="Add a comment..."
              value={comment}
              onChange={setComment}
              rows={3}
            />
            <div className="mt-2 flex justify-end">
              <button
                disabled={!comment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Viewers */}
      <div className="mt-8">
        <ViewerList 
          pitchId={pitchId}
          maxViewers={10}
          showTimestamps={true}
        />
      </div>
    </div>
  );
}

// Example 3: Auto-sync Pitch Editor
export function AutoSyncPitchEditor({ pitchId }: { pitchId: number }) {
  const {
    content,
    isDirty,
    isSaving,
    isLoading,
    hasConflict,
    lastSaved,
    lastError,
    updateContent,
    save,
    discardChanges,
    resolveWithLocal,
    resolveWithRemote,
    syncStatus,
  } = useDraftSync({
    draftId: `pitch_${pitchId}`,
    draftType: 'pitch',
    autoSaveInterval: 5000,
    conflictResolution: 'ask',
    validateContent: (content) => content?.title && content?.description,
    onError: (error) => console.error('Draft sync error:', error),
  });

  const [formData, setFormData] = useState({
    title: content?.title || '',
    description: content?.description || '',
    category: content?.category || '',
  });

  // Update draft when form changes
  const handleFieldChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    updateContent(newFormData);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with Sync Status */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Edit Pitch</h1>
        <div className="flex items-center space-x-4">
          {/* Sync Status Indicator */}
          <div className={`flex items-center space-x-2 text-xs px-2 py-1 rounded-full ${
            syncStatus === 'saving' ? 'bg-blue-100 text-blue-800' :
            syncStatus === 'error' ? 'bg-red-100 text-red-800' :
            syncStatus === 'conflict' ? 'bg-yellow-100 text-yellow-800' :
            isDirty ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
          }`}>
            {syncStatus === 'saving' && (
              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            <span>
              {syncStatus === 'saving' ? 'Saving...' :
               syncStatus === 'error' ? 'Sync Error' :
               syncStatus === 'conflict' ? 'Conflict' :
               isDirty ? 'Unsaved Changes' : 'Saved'}
            </span>
          </div>
          
          {lastSaved && (
            <span className="text-xs text-gray-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          
          <button
            onClick={save}
            disabled={!isDirty || isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Save Now
          </button>
        </div>
      </div>

      {/* Conflict Resolution */}
      {hasConflict && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-yellow-800">Sync Conflict Detected</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Another user has made changes to this pitch. Choose how to resolve:
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={resolveWithLocal}
                className="px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
              >
                Keep My Changes
              </button>
              <button
                onClick={resolveWithRemote}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
              >
                Use Their Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {lastError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-red-800">Sync Error</h3>
              <p className="text-sm text-red-700 mt-1">{lastError}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter pitch title..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <TypingTextArea
              conversationId={pitchId}
              value={formData.description}
              onChange={(value) => handleFieldChange('description', value)}
              placeholder="Describe your pitch..."
              rows={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleFieldChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select category...</option>
              <option value="tech">Technology</option>
              <option value="health">Healthcare</option>
              <option value="finance">Finance</option>
              <option value="education">Education</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// Example 4: Messages Page with Real-time Features
export function EnhancedMessagesPage() {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  return (
    <div className="h-screen bg-gray-50 flex">
      {/* Conversations List */}
      <div className="w-1/3 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
        </div>
        
        <div className="divide-y divide-gray-200">
          {[1, 2, 3].map((conversationId) => (
            <div
              key={conversationId}
              onClick={() => setSelectedConversation(conversationId)}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                selectedConversation === conversationId ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center space-x-3">
                <PresenceIndicator userId={conversationId} size="md" showStatus={false} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">User {conversationId}</span>
                    <PresenceIndicator userId={conversationId} size="sm" showStatus={true} />
                  </div>
                  <p className="text-sm text-gray-500 truncate">Last message preview...</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <PresenceIndicator userId={selectedConversation} size="md" />
                <div>
                  <h3 className="font-medium text-gray-900">User {selectedConversation}</h3>
                  <PresenceIndicator 
                    userId={selectedConversation} 
                    size="sm" 
                    showStatus={true}
                    showActivity={true}
                  />
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {[1, 2, 3].map((messageId) => (
                <div key={messageId} className="flex space-x-3">
                  <PresenceIndicator userId={selectedConversation} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Message content here...</p>
                    <span className="text-xs text-gray-500">2 hours ago</span>
                  </div>
                </div>
              ))}
              
              {/* Typing Indicator */}
              <TypingIndicator 
                conversationId={selectedConversation}
                maxDisplayUsers={3}
                showAvatars={true}
              />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <TypingInput
                conversationId={selectedConversation}
                value={message}
                onChange={setMessage}
                onSubmit={(msg) => {
                  setMessage('');
                }}
                placeholder="Type a message..."
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}

export default {
  EnhancedCreatorDashboard,
  EnhancedPitchDetail,
  AutoSyncPitchEditor,
  EnhancedMessagesPage,
};