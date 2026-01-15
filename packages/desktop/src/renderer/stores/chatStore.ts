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
import type { OpenCodeMessage, Session } from '../types/electron';

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

  // Handoff
  handoffTask: { id: string; title: string; description: string } | null;

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
  setHandoffTask: (task: { id: string; title: string; description: string } | null) => void;
  loadMessages: (messages: OpenCodeMessage[]) => void;
}


export const useChatStore = create<ChatState>((set) => ({
  // Initial state
  messages: [],
  isLoading: false,
  status: 'idle',
  currentSessionId: null,
  sessions: [],
  handoffTask: null,
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
    const hasContent = openCodeMessage.content?.trim();
    const hasParts = openCodeMessage.parts && openCodeMessage.parts.length > 0;

    if (!hasContent && !hasParts) {
      set({
        isLoading: false,
        status: 'idle',
      });
      return;
    }

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
      messages: [],
      error: null,
    });
  },


  setCurrentSessionId: (sessionId) => {
    set({ currentSessionId: sessionId });
  },

  setSessions: (sessions) => {
    set({ sessions });
  },

  setHandoffTask: (task) => {
    set({ handoffTask: task });
  },

  loadMessages: (openCodeMessages) => {
    const messages: Message[] = openCodeMessages
      .filter((msg) => msg.content?.trim() || (msg.parts && msg.parts.length > 0))
      .map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        parts: msg.parts,
      }));

    set({ messages });
  },
}));

export default useChatStore;
