import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Search, Filter, MessageSquare, Paperclip, MoreVertical, RefreshCw, Users, Circle } from 'lucide-react';
import { useMessaging } from '../hooks/useWebSocket';
import { getUserId } from '../lib/apiServices';
import { messagingService, type Message as ServiceMessage, type Conversation as ServiceConversation } from '../services/messaging.service';

// Map service types to component's expected format
interface Message extends Omit<ServiceMessage, 'content' | 'createdAt'> {
  senderName: string;
  senderType: 'investor' | 'production' | 'creator';
  subject?: string;
  message: string;
  content?: string; // Add content field for compatibility
  pitchTitle?: string;
  timestamp: string;
  isRead: boolean;
  hasAttachment: boolean;
  priority: 'normal' | 'high';
  delivered?: boolean;
}

interface Conversation extends ServiceConversation {
  participantName: string;
  participantType: 'investor' | 'production' | 'creator';
  lastMessageText?: string;
  timestamp: string;
}

export default function Messages() {
  const navigate = useNavigate();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notifications, setNotifications] = useState<{message: string, type: 'success' | 'error', id: number}[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Use the new messaging hook
  const {
    conversations,
    setConversations,
    currentMessages,
    setCurrentMessages,
    typingUsers,
    onlineUsers,
    unreadCounts,
    isConnected,
    sendChatMessage,
    markMessageAsRead,
    startTyping,
    stopTyping,
    joinConversation,
    markConversationAsRead,
  } = useMessaging();

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      // Only join conversation if WebSocket is connected
      if (isConnected) {
        joinConversation(selectedConversation);
      }
      markConversationAsRead(selectedConversation);
    }
  }, [selectedConversation, isConnected]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addNotification = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { message, type, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const fetchConversations = async (silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }
    
    try {
      const { conversations } = await messagingService.getConversations();
      
      // Map service conversations to component format
      const mappedConversations = conversations.map(conv => ({
        ...conv,
        participantName: conv.participantDetails?.[0]?.name || conv.participantDetails?.[0]?.companyName || conv.participantDetails?.[0]?.username || 'Unknown',
        participantType: (conv.participantDetails?.[0]?.userType || 'creator') as 'investor' | 'production' | 'creator',
        lastMessageText: conv.lastMessage?.content || '',
        timestamp: conv.lastMessage?.createdAt || conv.updatedAt,
        unreadCount: conv.unreadCount || 0
      }));
      
      setConversations(mappedConversations);
      setLastUpdated(new Date());
      
      if (silent) {
        const unreadCount = mappedConversations.reduce((sum: number, conv: Conversation) => sum + (conv.unreadCount || 0), 0);
        if (unreadCount > 0) {
          addNotification(`${unreadCount} new message${unreadCount > 1 ? 's' : ''}`, 'success');
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch conversations:', error);
      if (!silent) {
        addNotification(error.message || 'Failed to refresh conversations', 'error');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchConversations(false);
  };

  const fetchMessages = async (conversationId: number, silent = false) => {
    try {
      const { messages } = await messagingService.getMessages({ conversationId });
      
      // Map service messages to component format
      const mappedMessages = messages.map(msg => ({
        ...msg,
        senderName: msg.sender?.name || msg.sender?.companyName || msg.sender?.username || 'Unknown',
        senderType: (msg.sender?.userType || 'creator') as 'investor' | 'production' | 'creator',
        message: msg.content,
        timestamp: msg.createdAt,
        isRead: !!msg.readAt,
        hasAttachment: msg.attachments && msg.attachments.length > 0,
        priority: 'normal' as 'normal' | 'high',
        pitchTitle: undefined // Will be set from conversation if needed
      }));
      
      // Check for new messages
      if (silent && currentMessages.length > 0 && mappedMessages.length > currentMessages.length) {
        const newCount = mappedMessages.length - currentMessages.length;
        addNotification(`${newCount} new message${newCount > 1 ? 's' : ''} received`, 'success');
      }
        
      setCurrentMessages(mappedMessages);
        
      // Mark unread messages as read via WebSocket
      if (!silent) {
        const currentUserId = getUserId();
        mappedMessages
          .filter(msg => !msg.isRead && msg.recipientId === currentUserId)
          .forEach(msg => markMessageAsRead(msg.id));
      }
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
      addNotification(error.message || 'Failed to fetch messages', 'error');
    }
  };

  // getCurrentUserId function removed - now using centralized getUserId from apiServices

  const markAsRead = async (conversationId: number) => {
    try {
      await messagingService.markConversationAsRead(conversationId);
      
      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error: any) {
      console.error('Failed to mark as read:', error);
      addNotification(error.message || 'Failed to mark as read', 'error');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    setSendingMessage(true);

    try {
      if (isConnected) {
        // Send via WebSocket if connected
        const messageContent = newMessage.trim();
        sendChatMessage(selectedConversation, messageContent);
        
        // Immediately add the message to the UI (optimistic update)
        const currentUserId = getUserId();
        const tempMessage: Message = {
          id: Date.now(), // Temporary ID
          conversationId: selectedConversation,
          senderId: parseInt(currentUserId || '0'),
          recipientId: 0, // Will be updated when confirmed
          senderName: 'You',
          senderType: 'creator' as 'investor' | 'production' | 'creator',
          message: messageContent,
          content: messageContent, // Add content field as well for compatibility
          timestamp: new Date().toISOString(),
          isRead: false,
          hasAttachment: false,
          priority: 'normal' as 'normal' | 'high',
          delivered: false // Mark as pending until confirmed
        };
        
        setCurrentMessages(prev => [...prev, tempMessage]);
        setNewMessage('');
        addNotification('Message sent successfully', 'success');
        
        // Stop typing indicator
        stopTyping(selectedConversation);
      } else {
        // Fallback to messaging service
        const message = await messagingService.sendMessage({
          conversationId: selectedConversation,
          content: newMessage.trim()
        });
        
        // Map and add message to current view
        const mappedMessage: Message = {
          ...message,
          senderName: message.sender?.name || message.sender?.companyName || message.sender?.username || 'You',
          senderType: (message.sender?.userType || 'creator') as 'investor' | 'production' | 'creator',
          message: message.content,
          timestamp: message.createdAt,
          isRead: !!message.readAt,
          hasAttachment: message.attachments && message.attachments.length > 0,
          priority: 'normal' as 'normal' | 'high'
        };
        
        setCurrentMessages(prev => [...prev, mappedMessage]);
        setNewMessage('');
        addNotification('Message sent successfully', 'success');
        
        // Stop typing indicator
        if (selectedConversation) {
          stopTyping(selectedConversation);
        }
        
        // Update conversation list
        fetchConversations(true);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      addNotification(error.message || 'Failed to send message', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  // Handle typing indicators
  const handleTyping = () => {
    if (selectedConversation && isConnected) {
      startTyping(selectedConversation);
      
      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (selectedConversation) {
          stopTyping(selectedConversation);
        }
      }, 3000);
    }
  };

  const getParticipantBadgeColor = (type: string) => {
    switch (type) {
      case 'investor':
        return 'bg-blue-100 text-blue-700';
      case 'production':
        return 'bg-green-100 text-green-700';
      case 'creator':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (conv.pitchTitle && conv.pitchTitle.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'unread') return matchesSearch && conv.unreadCount > 0;
    if (filter === 'investors') return matchesSearch && conv.participantType === 'investor';
    if (filter === 'production') return matchesSearch && conv.participantType === 'production';
    
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/creator/dashboard')}
              className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
              <p className="text-sm text-gray-500">Communicate with investors and production companies</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Notifications */}
        <div className="fixed top-4 right-4 space-y-2 z-50">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
                notification.type === 'success'
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-sm font-medium">{notification.message}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Real-time status */}
        <div className="flex items-center justify-between bg-white rounded-lg p-3 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>
                {isConnected ? 'Real-time connected' : 'Real-time disconnected'} • 
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`flex items-center gap-2 px-3 py-1 border rounded text-xs transition ${
                  isRefreshing 
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                title="Refresh messages"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Users className="w-3 h-3" />
                <span>{Object.values(onlineUsers).filter(Boolean).length} online</span>
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {isConnected ? 'Real-time messaging active' : 'Reconnecting...'}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <div className="flex h-full">
            {/* Conversations List */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
              {/* Search and Filter */}
              <div className="p-4 border-b border-gray-200">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Messages</option>
                    <option value="unread">Unread</option>
                    <option value="investors">Investors</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>

              {/* Conversations */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-4 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">No conversations found</p>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const unreadCount = unreadCounts[conversation.id] || conversation.unreadCount || 0;
                    const participant = conversation.participantDetails?.[0];
                    const isParticipantOnline = participant && onlineUsers[participant.id];
                    
                    return (
                      <div
                        key={conversation.id}
                        onClick={() => setSelectedConversation(conversation.id)}
                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                          selectedConversation === conversation.id ? 'bg-purple-50 border-purple-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <h3 className="font-medium text-gray-900 text-sm">
                                {conversation.participantName || participant?.name || participant?.companyName || 'Unknown User'}
                              </h3>
                              {isParticipantOnline && (
                                <Circle className="w-2 h-2 fill-green-500 text-green-500 absolute -top-1 -right-1" />
                              )}
                            </div>
                            {conversation.participantType && (
                              <span className={`px-2 py-1 text-xs rounded-full ${getParticipantBadgeColor(conversation.participantType)}`}>
                                {conversation.participantType}
                              </span>
                            )}
                          </div>
                          {unreadCount > 0 && (
                            <span className="bg-purple-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        
                        {conversation.pitchTitle && (
                          <p className="text-xs text-purple-600 mb-1">Re: {conversation.pitchTitle}</p>
                        )}
                        
                        <p className="text-sm text-gray-600 truncate mb-1">
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-400">
                            {conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : ''}
                          </p>
                          {typingUsers[conversation.id]?.length > 0 && (
                            <p className="text-xs text-purple-600 italic">
                              {typingUsers[conversation.id].join(', ')} typing...
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Message View */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Message Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        {(() => {
                          const conv = conversations.find(c => c.id === selectedConversation);
                          return conv ? (
                            <div>
                              <h2 className="font-semibold text-gray-900">{conv.participantName}</h2>
                              {conv.pitchTitle && (
                                <p className="text-sm text-gray-500">About: {conv.pitchTitle}</p>
                              )}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      {currentMessages.map((message) => {
                        const currentUserId = getUserId();
                        const isCurrentUser = message.senderId === parseInt(currentUserId || '0');
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              isCurrentUser
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              {message.subject && (
                                <p className="font-medium text-sm mb-1">{message.subject}</p>
                              )}
                              <p className="text-sm">{message.content || message.message}</p>
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="flex items-center gap-1 mt-2 text-xs opacity-75">
                                  <Paperclip className="w-3 h-3" />
                                  {message.attachments.length} attachment{message.attachments.length > 1 ? 's' : ''}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-1">
                                <p className={`text-xs ${
                                  isCurrentUser ? 'text-purple-200' : 'text-gray-500'
                                }`}>
                                  {new Date(message.sentAt || message.timestamp).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {isCurrentUser && message.readReceipts && message.readReceipts.length > 0 && (
                                  <p className="text-xs text-purple-200">
                                    ✓✓ Read
                                  </p>
                                )}
                                {isCurrentUser && message.delivered && (
                                  <p className="text-xs text-purple-200">
                                    ✓ Delivered
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Typing indicators */}
                      {selectedConversation && typingUsers[selectedConversation]?.length > 0 && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg max-w-xs">
                            <div className="flex items-center gap-2">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              </div>
                              <span className="text-xs text-gray-500">
                                {typingUsers[selectedConversation].join(', ')} typing...
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200">
                    <div className="flex items-end gap-3">
                      <button className="p-2 text-gray-400 hover:text-gray-600">
                        <Paperclip className="w-5 h-5" />
                      </button>
                      <div className="flex-1">
                        <textarea
                          value={newMessage}
                          onChange={(e) => {
                            setNewMessage(e.target.value);
                            handleTyping();
                          }}
                          placeholder="Type your message..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-sm"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendMessage();
                            }
                          }}
                          onBlur={() => {
                            if (selectedConversation) {
                              stopTyping(selectedConversation);
                            }
                          }}
                        />
                      </div>
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || sendingMessage}
                        className={`p-3 rounded-lg transition min-w-[60px] flex items-center justify-center ${
                          sendingMessage
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700'
                        } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {sendingMessage ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                    <p className="text-gray-500">Choose a conversation from the left to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}