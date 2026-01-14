/**
 * Chat Store - Manages chat state using Zustand
 *
 * Handles:
 * - Message history
 * - Loading/thinking state
 * - Session management
 * - Error state
 */

import { create } from 'zustand';
import type { OpenCodeMessage, OpenCodeProgress, Session } from '../types/electron';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parts?: Array<{ type: string; text?: string }>;
}

interface ChatState {
  // Messages
  messages: Message[];
  
  // Loading state
  isLoading: boolean;
  status: 'idle' | 'thinking' | 'error';
  
  // Session
  currentSessionId: string | null;
  sessions: Session[];
  
  // Error
  error: string | null;
  
  // Actions
  addMessage: (message: Message) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (message: OpenCodeMessage) => void;
  setLoading: (loading: boolean) => void;
  setStatus: (status: 'idle' | 'thinking' | 'error') => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setSessions: (sessions: Session[]) => void;
  loadMessages: (messages: OpenCodeMessage[]) => void;
}

// Welcome message shown on first load
const welcomeMessage: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `Welcome to FlowState! 👋

I'm your AI-powered productivity assistant. I can help you:

• **Organize your inbox** - Summarize emails, draft replies, create tasks
• **Manage your calendar** - Find conflicts, schedule meetings, prep for events  
• **Work with Notion** - Search pages, create tasks, update databases
• **Automate your desktop** - Organize files, open apps, run workflows

Try asking me something like:
- "What can you help me with?"
- "Tell me a joke"
- "Help me write a Python function"`,
  timestamp: new Date(),
};

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  messages: [welcomeMessage],
  isLoading: false,
  status: 'idle',
  currentSessionId: null,
  sessions: [],
  error: null,

  // Actions
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  addUserMessage: (content) => {
    const message: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, message],
      isLoading: true,
      status: 'thinking',
      error: null,
    }));
  },

  addAssistantMessage: (openCodeMessage) => {
    const message: Message = {
      id: openCodeMessage.id || `assistant-${Date.now()}`,
      role: 'assistant',
      content: openCodeMessage.content,
      timestamp: new Date(openCodeMessage.timestamp),
      parts: openCodeMessage.parts,
    };
    set((state) => ({
      messages: [...state.messages, message],
      isLoading: false,
      status: 'idle',
    }));
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setStatus: (status) => {
    set({ 
      status,
      isLoading: status === 'thinking',
    });
  },

  setError: (error) => {
    set({ 
      error,
      status: error ? 'error' : 'idle',
      isLoading: false,
    });
  },

  clearMessages: () => {
    set({ 
      messages: [welcomeMessage],
      error: null,
    });
  },

  setCurrentSessionId: (sessionId) => {
    set({ currentSessionId: sessionId });
  },

  setSessions: (sessions) => {
    set({ sessions });
  },

  loadMessages: (openCodeMessages) => {
    const messages: Message[] = openCodeMessages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      parts: msg.parts,
    }));
    
    // Keep welcome message if no messages loaded
    if (messages.length === 0) {
      set({ messages: [welcomeMessage] });
    } else {
      set({ messages });
    }
  },
}));

export default useChatStore;
