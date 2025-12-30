import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Paperclip, Smile, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import apiClient from '../../lib/api-client';
import { toast } from 'react-hot-toast';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  read: boolean;
  delivered: boolean;
  attachments?: any[];
  replyTo?: string;
}

interface Conversation {
  id: string;
  participants: Array<{
    id: string;
    name: string;
    avatar?: string;
    online?: boolean;
  }>;
  lastMessage?: Message;
  unreadCount: number;
  type: 'direct' | 'group';
}

interface MessagingIntegrationProps {
  userId: string;
  userName: string;
  userAvatar?: string;
}

export function MessagingIntegration({ 
  userId, 
  userName,
  userAvatar
}: MessagingIntegrationProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // WebSocket connection for real-time updates
  const { sendMessage: sendWsMessage, isConnected } = useWebSocket({
    onMessage: handleWebSocketMessage,
    reconnect: true,
  });

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [userId]);

  // Subscribe to selected conversation
  useEffect(() => {
    if (selectedConversation && isConnected) {
      sendWsMessage({
        type: 'subscribe',
        payload: { conversationId: selectedConversation.id }
      });

      loadMessages(selectedConversation.id);

      return () => {
        sendWsMessage({
          type: 'unsubscribe',
          payload: { conversationId: selectedConversation.id }
        });
      };
    }
  }, [selectedConversation, isConnected]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await apiClient.get('/api/messages/conversations');
      if (response.data?.conversations) {
        setConversations(response.data.conversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      
      // Fallback to mock data for demonstration
      setConversations([
        {
          id: '1',
          participants: [
            { id: '2', name: 'John Producer', online: true },
          ],
          lastMessage: {
            id: '1',
            conversationId: '1',
            senderId: '2',
            senderName: 'John Producer',
            content: 'Great pitch! Let\'s discuss further.',
            timestamp: new Date().toISOString(),
            read: false,
            delivered: true,
          },
          unreadCount: 1,
          type: 'direct',
        },
        {
          id: '2',
          participants: [
            { id: '3', name: 'Sarah Investor', online: false },
          ],
          lastMessage: {
            id: '2',
            conversationId: '2',
            senderId: '3',
            senderName: 'Sarah Investor',
            content: 'I\'m interested in your project.',
            timestamp: new Date().toISOString(),
            read: true,
            delivered: true,
          },
          unreadCount: 0,
          type: 'direct',
        },
      ]);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/messages/conversation/${conversationId}`);
      if (response.data?.messages) {
        setMessages(response.data.messages);
        markAsRead(conversationId);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      
      // Fallback to mock messages
      setMessages([
        {
          id: '1',
          conversationId,
          senderId: '2',
          senderName: 'John Producer',
          content: 'Hi! I just reviewed your pitch.',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          read: true,
          delivered: true,
        },
        {
          id: '2',
          conversationId,
          senderId: userId,
          senderName: userName,
          content: 'Thank you for taking the time to review it!',
          timestamp: new Date(Date.now() - 3000000).toISOString(),
          read: true,
          delivered: true,
        },
        {
          id: '3',
          conversationId,
          senderId: '2',
          senderName: 'John Producer',
          content: 'Great pitch! Let\'s discuss further.',
          timestamp: new Date().toISOString(),
          read: false,
          delivered: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'new_message':
        handleNewMessage(data.payload);
        break;
      case 'typing_indicator':
        handleTypingIndicator(data.payload);
        break;
      case 'read_receipt':
        handleReadReceipt(data.payload);
        break;
      case 'presence_update':
        handlePresenceUpdate(data.payload);
        break;
    }
  }, []);

  const handleNewMessage = (payload: any) => {
    const newMessage: Message = {
      id: payload.messageId,
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      senderName: payload.senderName || 'Unknown',
      content: payload.content,
      timestamp: new Date().toISOString(),
      read: false,
      delivered: true,
    };

    // Add to messages if in current conversation
    if (selectedConversation?.id === payload.conversationId) {
      setMessages(prev => [...prev, newMessage]);
    }

    // Update conversation list
    setConversations(prev => prev.map(conv => {
      if (conv.id === payload.conversationId) {
        return {
          ...conv,
          lastMessage: newMessage,
          unreadCount: conv.id !== selectedConversation?.id ? conv.unreadCount + 1 : 0,
        };
      }
      return conv;
    }));

    // Show notification if not in current conversation
    if (selectedConversation?.id !== payload.conversationId) {
      toast(`New message from ${payload.senderName}`);
    }
  };

  const handleTypingIndicator = (payload: any) => {
    if (payload.isTyping) {
      setTypingUsers(prev => new Set(prev).add(payload.userId));
      
      // Clear typing after 3 seconds
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(payload.userId);
          return newSet;
        });
      }, 3000);
    } else {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(payload.userId);
        return newSet;
      });
    }
  };

  const handleReadReceipt = (payload: any) => {
    setMessages(prev => prev.map(msg => {
      if (payload.messageIds.includes(msg.id)) {
        return { ...msg, read: true };
      }
      return msg;
    }));
  };

  const handlePresenceUpdate = (payload: any) => {
    setConversations(prev => prev.map(conv => ({
      ...conv,
      participants: conv.participants.map(p => 
        p.id === payload.userId 
          ? { ...p, online: payload.status === 'online' }
          : p
      ),
    })));
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      conversationId: selectedConversation.id,
      senderId: userId,
      senderName: userName,
      senderAvatar: userAvatar,
      content: message,
      timestamp: new Date().toISOString(),
      read: false,
      delivered: false,
    };

    // Optimistically add message
    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    try {
      // Send via API
      const response = await apiClient.post('/api/messages/send', {
        conversationId: selectedConversation.id,
        content: newMessage.content,
      });

      // Send via WebSocket for real-time delivery
      if (isConnected) {
        sendWsMessage({
          type: 'message',
          payload: {
            conversationId: selectedConversation.id,
            messageId: response.data?.messageId || newMessage.id,
            content: newMessage.content,
          },
        });
      }

      // Update message with server response
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id 
          ? { ...msg, id: response.data?.messageId || msg.id, delivered: true }
          : msg
      ));
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
      setMessage(newMessage.content); // Restore message text
    }
  };

  const handleTyping = () => {
    if (isConnected && selectedConversation) {
      sendWsMessage({
        type: 'typing',
        payload: {
          conversationId: selectedConversation.id,
          isTyping: true,
        },
      });

      // Stop typing indicator after pause
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendWsMessage({
          type: 'typing',
          payload: {
            conversationId: selectedConversation.id,
            isTyping: false,
          },
        });
      }, 1000);
    }
  };

  const markAsRead = async (conversationId: string) => {
    const unreadMessages = messages.filter(msg => !msg.read && msg.senderId !== userId);
    if (unreadMessages.length === 0) return;

    try {
      await apiClient.post('/api/messages/read', {
        conversationId,
        messageIds: unreadMessages.map(msg => msg.id),
      });

      if (isConnected) {
        sendWsMessage({
          type: 'read',
          payload: {
            conversationId,
            messageIds: unreadMessages.map(msg => msg.id),
          },
        });
      }

      // Update local state
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  return (
    <div className="flex h-[600px] bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Conversations List */}
      <div className="w-1/3 border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Messages</h3>
        </div>
        <div className="overflow-y-auto h-[calc(100%-60px)]">
          {conversations.map((conv) => {
            const otherParticipant = conv.participants[0];
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                      {otherParticipant?.avatar ? (
                        <img 
                          src={otherParticipant.avatar} 
                          alt={otherParticipant.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600 font-medium">
                          {otherParticipant?.name?.[0] || '?'}
                        </span>
                      )}
                    </div>
                    {otherParticipant?.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>

                  {/* Conversation Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-medium text-gray-900 truncate">
                        {otherParticipant?.name || 'Unknown'}
                      </h4>
                      {conv.lastMessage && (
                        <span className="text-xs text-gray-500">
                          {formatTime(conv.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {conv.lastMessage.senderId === userId ? 'You: ' : ''}
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>

                  {/* Unread Badge */}
                  {conv.unreadCount > 0 && (
                    <div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                {selectedConversation.participants[0]?.avatar ? (
                  <img 
                    src={selectedConversation.participants[0].avatar} 
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-gray-600 text-sm font-medium">
                    {selectedConversation.participants[0]?.name?.[0] || '?'}
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-medium text-gray-900">
                  {selectedConversation.participants[0]?.name || 'Unknown'}
                </h4>
                {selectedConversation.participants[0]?.online && (
                  <span className="text-xs text-green-500">Online</span>
                )}
              </div>
            </div>
            <button className="text-gray-500 hover:text-gray-700">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="text-center text-gray-500">Loading messages...</div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        msg.senderId === userId
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${
                        msg.senderId === userId ? 'justify-end' : 'justify-start'
                      }`}>
                        <span className={`text-xs ${
                          msg.senderId === userId ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.senderId === userId && (
                          msg.read ? (
                            <CheckCheck className="w-3 h-3 text-blue-100" />
                          ) : msg.delivered ? (
                            <Check className="w-3 h-3 text-blue-100" />
                          ) : null
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span>typing...</span>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <button className="text-gray-500 hover:text-gray-700">
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  handleTyping();
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="text-gray-500 hover:text-gray-700">
                <Smile className="w-5 h-5" />
              </button>
              <button
                onClick={sendMessage}
                disabled={!message.trim()}
                className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Select a conversation to start messaging
        </div>
      )}
    </div>
  );
}