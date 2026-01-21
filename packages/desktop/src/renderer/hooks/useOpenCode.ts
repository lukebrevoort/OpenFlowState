/**
 * useOpenCode Hook - Manages OpenCode communication
 *
 * Provides:
 * - Send messages to OpenCode
 * - Subscribe to streaming responses
 * - Session management
 * - Status monitoring
 */

import { useEffect, useCallback } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useConfigStore } from '../stores/configStore';
import type { OpenCodeMessage, OpenCodeProgress, OpenCodeError, TimelineEvent } from '../types/electron';

let listenersInitialized = false;

export function useOpenCode() {
  const {
    addUserMessage,
    addAssistantMessage,
    addTimelineEvent,
    setHandoffTaskFromTimeline,
    updateActiveTask,
    setStatus,
    setError,
    setCurrentSessionId,
    setSessions,
    loadMessages,
    isLoading,
    status,
    error,
    currentSessionId,
    sessions,
    timeline,
    activeTask,
  } = useChatStore();

  const { setOpenCodeStatus, refreshStatus } = useConfigStore();

  /**
   * Set up event listeners for OpenCode responses
   */
  useEffect(() => {
    if (listenersInitialized) return;
    listenersInitialized = true;

    console.log('Setting up OpenCode event listeners');

    // Handle incoming messages
    const removeMessageListener = window.flowstate.opencode.onMessage((message: OpenCodeMessage) => {
      console.log('[Renderer] Received message:', message.id, 'role:', message.role, 'content length:', message.content?.length);
      console.log('[Renderer] Message parts:', message.parts?.length);
      addAssistantMessage(message);
    });

    // Handle progress updates
    const removeProgressListener = window.flowstate.opencode.onProgress((progress: OpenCodeProgress) => {
      console.log('Progress update:', progress);
      setStatus(progress.status);
      if (progress.sessionId) {
        setCurrentSessionId(progress.sessionId);
      }
    });

    // Handle errors
    const removeErrorListener = window.flowstate.opencode.onError((err: OpenCodeError) => {
      console.error('[Renderer] OpenCode error:', err);
      setError(err.error);
    });

    // Handle general events
    const removeEventListener = window.flowstate.opencode.onEvent((event) => {
      console.log('OpenCode event:', event);
    });

    const removeTimelineListener = window.flowstate.opencode.onTimelineEvent((event: TimelineEvent) => {
      addTimelineEvent(event);
      if (event.kind === 'status' && event.title === 'Task promoted') {
        setHandoffTaskFromTimeline(event);
      }

      if (event.kind === 'approval_request') {
        updateActiveTask({ status: 'waiting_approval' });
      }

      if (event.kind === 'approval_response') {
        updateActiveTask({ status: 'running' });
      }

      if (event.kind === 'error') {
        updateActiveTask({ status: 'failed' });
      }

      if (event.kind === 'status' && event.title === 'Task completed') {
        updateActiveTask({ status: 'completed' });
      }

      if (event.kind === 'status' && event.title === 'Task summary' && event.detail) {
        updateActiveTask({ summary: event.detail, summarySent: false });
      }
    });

    // Initial status check
    refreshStatus();

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up OpenCode event listeners');
      removeMessageListener();
      removeProgressListener();
      removeErrorListener();
      removeEventListener();
      removeTimelineListener();
      listenersInitialized = false;
    };
  }, [addAssistantMessage, addTimelineEvent, setHandoffTaskFromTimeline, updateActiveTask, setStatus, setError, setCurrentSessionId, refreshStatus]);

  useEffect(() => {
    if (activeTask?.status === 'completed' && activeTask.summary && !activeTask.summarySent) {
      addAssistantMessage({
        id: `summary-${Date.now()}`,
        role: 'assistant',
        content: activeTask.summary,
        timestamp: new Date().toISOString(),
      });
      updateActiveTask({ summarySent: true });
    }
  }, [activeTask, addAssistantMessage, updateActiveTask]);

  /**
   * Send a message to OpenCode
   */
  const sendMessage = useCallback(async (content: string) => {
    console.log('[Renderer] sendMessage called with content length:', content.length);
    if (!content.trim()) return;

    if (activeTask && activeTask.status === 'running') {
      console.log('[Renderer] Task already running, blocking message');
      setError('Another task is already running for this conversation.');
      return { success: false, error: 'Task already running' };
    }

    // Add user message to store immediately
    console.log('[Renderer] Adding user message to store');
    addUserMessage(content);

    try {
      // Send to OpenCode (response comes via events)
      console.log('[Renderer] Calling window.flowstate.opencode.send()...');
      const result = await window.flowstate.opencode.send(content);
      console.log('[Renderer] opencode.send() returned:', result.success ? 'success' : 'error');

      if (result.error) {
        console.error('[Renderer] OpenCode returned error:', result.error);
        setError(result.error);
        // Add error message as assistant response
        addAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: result.content || `Error: ${result.error}`,
          timestamp: new Date().toISOString(),
        });
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return { success: false, error: err instanceof Error ? err.message : 'Failed to send message' };
    }
  }, [activeTask, addUserMessage, setError, addAssistantMessage]);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (title?: string) => {
    try {
      const result = await window.flowstate.opencode.newSession(title);
      setCurrentSessionId(result.sessionId);
      // Clear messages for new session
      useChatStore.getState().clearMessages();
      useChatStore.getState().clearTimeline();
      useChatStore.getState().setActiveTask(null);
      return result.sessionId;
    } catch (err) {
      console.error('Failed to create session:', err);
      throw err;
    }
  }, [setCurrentSessionId]);

  /**
   * Switch to a different session
   */
  const switchSession = useCallback(async (sessionId: string) => {
    try {
      await window.flowstate.opencode.switchSession(sessionId);
      setCurrentSessionId(sessionId);
      
      // Load messages for the session
      const messages = await window.flowstate.opencode.getMessages();
      loadMessages(messages);

      const timeline = await window.flowstate.timeline.list(sessionId, 100, 0);
      useChatStore.getState().loadTimelineEvents(timeline);
    } catch (err) {
      console.error('Failed to switch session:', err);
      throw err;
    }
  }, [setCurrentSessionId, loadMessages]);

  /**
   * Refresh session list
   */
  const refreshSessions = useCallback(async () => {
    try {
      const sessionList = await window.flowstate.opencode.listSessions();
      setSessions(sessionList);
    } catch (err) {
      console.error('Failed to list sessions:', err);
    }
  }, [setSessions]);

  const refreshTimeline = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      const timeline = await window.flowstate.timeline.list(currentSessionId, 100, 0);
      useChatStore.getState().loadTimelineEvents(timeline);
    } catch (err) {
      console.error('Failed to refresh timeline:', err);
    }
  }, [currentSessionId]);

  /**
   * Check OpenCode status
   */
  const checkStatus = useCallback(async () => {
    try {
      const status = await window.flowstate.opencode.status();
      setOpenCodeStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to check status:', err);
      return null;
    }
  }, [setOpenCodeStatus]);

  return {
    // State
    isLoading,
    status,
    error,
    currentSessionId,
    sessions,

    // Actions
    sendMessage,
    createSession,
    switchSession,
    refreshSessions,
    refreshTimeline,
    checkStatus,
  };
}

export default useOpenCode;
