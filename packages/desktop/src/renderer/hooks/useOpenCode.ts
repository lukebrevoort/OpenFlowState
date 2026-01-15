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
import type { OpenCodeMessage, OpenCodeProgress, OpenCodeError } from '../types/electron';

let listenersInitialized = false;

export function useOpenCode() {
  const {
    addUserMessage,
    addAssistantMessage,
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
      console.log('Received message:', message);
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
      console.error('OpenCode error:', err);
      setError(err.error);
    });

    // Handle general events
    const removeEventListener = window.flowstate.opencode.onEvent((event) => {
      console.log('OpenCode event:', event);
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
      listenersInitialized = false;
    };
  }, [addAssistantMessage, setStatus, setError, setCurrentSessionId, refreshStatus]);

  /**
   * Send a message to OpenCode
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message to store immediately
    addUserMessage(content);

    try {
      // Send to OpenCode (response comes via events)
      const result = await window.flowstate.opencode.send(content);

      if (result.error) {
        setError(result.error);
        // Add error message as assistant response
        addAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: result.content || `Error: ${result.error}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }, [addUserMessage, setError, addAssistantMessage]);

  /**
   * Create a new session
   */
  const createSession = useCallback(async (title?: string) => {
    try {
      const result = await window.flowstate.opencode.newSession(title);
      setCurrentSessionId(result.sessionId);
      // Clear messages for new session
      useChatStore.getState().clearMessages();
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
    checkStatus,
  };
}

export default useOpenCode;
