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
import type { OpenCodeMessage, Session, TimelineEvent } from '../types/electron';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  parts?: Array<{ type: string; text?: string }>;
}

export interface TaskRun {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  status: 'running' | 'waiting_approval' | 'completed' | 'failed';
  startedAt: number;
  updatedAt: number;
  progress: number;
  summary?: string;
  summarySent?: boolean;
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

  // Timeline
  timeline: TimelineEvent[];

  // Task
  activeTask: TaskRun | null;

  // Error
  error: string | null;

  // Actions
  addMessage: (message: Message) => void;
  addUserMessage: (content: string) => void;
  addAssistantMessage: (message: OpenCodeMessage) => void;
  addTimelineEvent: (event: TimelineEvent) => void;
  loadTimelineEvents: (events: TimelineEvent[]) => void;
  setLoading: (loading: boolean) => void;
  setStatus: (status: 'idle' | 'thinking' | 'error') => void;
  setError: (error: string | null) => void;
  clearMessages: () => void;
  clearTimeline: () => void;
  setCurrentSessionId: (sessionId: string | null) => void;
  setHandoffTask: (task: { id: string; title: string; description: string } | null) => void;
  setHandoffTaskFromTimeline: (event: TimelineEvent) => void;
  setActiveTask: (task: TaskRun | null) => void;
  updateActiveTask: (updates: Partial<TaskRun>) => void;
  setSessions: (sessions: Session[]) => void;
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
  timeline: [],
  activeTask: null,
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

    set((state) => {
      if (state.messages.some((existing) => existing.id === message.id)) {
        return {
          isLoading: false,
          status: 'idle',
        };
      }

      return {
        messages: [...state.messages, message],
        isLoading: false,
        status: 'idle',
      };
    });
  },

  addTimelineEvent: (event) => {
    set((state) => {
      const timeline = [...state.timeline, event].slice(-200);
      if (!state.activeTask) {
        return { timeline };
      }

      const completed = timeline.filter((item) =>
        ['tool_result', 'approval_response'].includes(item.kind),
      ).length;
      const progress = timeline.length > 0
        ? Math.min(100, Math.round((completed / timeline.length) * 100))
        : 0;

      return {
        timeline,
        activeTask: {
          ...state.activeTask,
          progress,
          updatedAt: Date.now(),
        },
      };
    });
  },

  loadTimelineEvents: (events) => {
    const promotedEvent = [...events]
      .filter((event) => event.kind === 'status' && event.title === 'Task promoted')
      .pop();
    const completedEvent = [...events]
      .filter((event) => event.kind === 'status' && event.title === 'Task completed')
      .pop();
    const summaryEvent = [...events]
      .filter((event) => event.kind === 'status' && event.title === 'Task summary')
      .pop();

    if (promotedEvent) {
      const taskId = promotedEvent.taskId ?? promotedEvent.sessionId;
      const status = completedEvent ? 'completed' : 'running';
      const completed = events.filter((event) =>
        ['tool_result', 'approval_response'].includes(event.kind),
      ).length;
      const progress = events.length > 0
        ? Math.min(100, Math.round((completed / events.length) * 100))
        : 0;

      set({
        timeline: events,
        handoffTask: {
          id: taskId,
          title: promotedEvent.title,
          description: promotedEvent.detail ?? 'This request is now running as a Task.',
        },
        activeTask: {
          id: taskId,
          sessionId: promotedEvent.sessionId,
          title: promotedEvent.title,
          description: promotedEvent.detail ?? 'This request is now running as a Task.',
          status,
          startedAt: promotedEvent.timestamp,
          updatedAt: Date.now(),
          progress,
          summary: summaryEvent?.detail,
          summarySent: status === 'completed',
        },
      });
      return;
    }

    set({ timeline: events });
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

  clearTimeline: () => {
    set({ timeline: [] });
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

  setHandoffTaskFromTimeline: (event) => {
    const title = event.detail || event.title || 'Task promoted';
    const taskId = event.taskId ?? event.sessionId;
    set((state) => {
      if (state.activeTask && state.activeTask.status === 'running') {
        return state;
      }
      return {
        handoffTask: {
          id: taskId,
          title,
          description: event.detail ?? 'This request is now running as a Task.',
        },
        activeTask: {
          id: taskId,
          sessionId: event.sessionId,
          title,
          description: event.detail ?? 'This request is now running as a Task.',
          status: 'running',
          startedAt: event.timestamp,
          updatedAt: event.timestamp,
          progress: 0,
        },
      };
    });
  },

  setActiveTask: (task) => {
    set({ activeTask: task });
  },

  updateActiveTask: (updates) => {
    set((state) => {
      if (!state.activeTask) return state;
      return {
        activeTask: {
          ...state.activeTask,
          ...updates,
          updatedAt: Date.now(),
        },
        handoffTask:
          updates.status === 'completed' || updates.summarySent
            ? null
            : state.handoffTask,
      };
    });
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
