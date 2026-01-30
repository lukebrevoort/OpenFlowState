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
    activeTask,
  } = useChatStore();

  const { setOpenCodeStatus, refreshStatus } = useConfigStore();

  const formatOpenCodeError = useCallback((err: OpenCodeError | string | null | undefined) => {
    if (!err) return 'OpenCode request failed.';
    if (typeof err === 'string') return err;

    const baseMessage = err.message ?? err.error ?? 'OpenCode request failed.';
    const normalizedMessage = baseMessage.toLowerCase();
    const code = err.code?.toLowerCase();
    const status = err.status;

    const isRateLimit =
      code === 'rate_limited' ||
      status === 429 ||
      normalizedMessage.includes('rate limit') ||
      normalizedMessage.includes('too many requests');
    const isModelUnavailable =
      code === 'model_not_found' ||
      code === 'model_unavailable' ||
      normalizedMessage.includes('model not found') ||
      normalizedMessage.includes('model unavailable') ||
      normalizedMessage.includes('no longer available');
    const isAuth =
      status === 401 ||
      normalizedMessage.includes('invalid api key') ||
      normalizedMessage.includes('unauthorized') ||
      normalizedMessage.includes('authentication');

    let title = 'Request failed';
    if (isModelUnavailable) title = 'Model unavailable';
    if (isRateLimit) title = 'Rate limited';
    if (isAuth) title = 'Authentication error';

    const detailParts: string[] = [];
    if (err.model) detailParts.push(`Model: ${err.model}`);
    if (err.provider && (!err.model || !err.model.startsWith(err.provider))) {
      detailParts.push(`Provider: ${err.provider}`);
    }
    if (err.retryAfter) detailParts.push(`Retry after ${err.retryAfter}s`);

    const suffix = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
    return `${title}: ${baseMessage}${suffix}`;
  }, []);

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
      setError(formatOpenCodeError(err));
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
  }, [addAssistantMessage, addTimelineEvent, setHandoffTaskFromTimeline, updateActiveTask, setStatus, setError, setCurrentSessionId, refreshStatus, formatOpenCodeError]);

  // Note: We intentionally do not auto-inject task summaries into chat.
  // The chat response already arrives via `opencode:message`, and injecting the
  // timeline-derived summary creates duplicate assistant messages.

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
        const formattedError = formatOpenCodeError(result.errorDetails ?? result.error);
        setError(formattedError);
        // Add error message as assistant response
        addAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: result.content || formattedError,
          timestamp: new Date().toISOString(),
        });
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (err) {
      console.error('Failed to send message:', err);
      const formattedError = formatOpenCodeError(
        err instanceof Error ? err.message : 'Failed to send message'
      );
      setError(formattedError);
      return { success: false, error: formattedError };
    }
  }, [activeTask, addUserMessage, setError, addAssistantMessage, formatOpenCodeError]);

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
