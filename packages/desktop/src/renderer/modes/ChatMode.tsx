import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import type { Message } from '../stores/chatStore';
import { useOpenCode } from '../hooks/useOpenCode';
import { useConfigStore } from '../stores/configStore';
import type { McpServerStatus } from '../types/electron';
import ActivityCarousel from '../components/ActivityCarousel';
import {
  completionActivityStep,
  errorActivityStep,
  initialActivitySteps,
  mergeActivityStep,
  stepFromOpenCodeEvent,
} from '../lib/opencodeActivity';

const thinkingHighlights = [
  'Gathering Gmail & Calendar context',
  'Summarizing Notion notes and tasks',
  'Mapping workflows and desktop automations',
  'Checking MCP tool readiness and health',
];

const statusDescriptions: Record<'idle' | 'thinking' | 'error', string> = {
  idle: 'FlowState is ready for your next question.',
  thinking: 'Collecting context from Gmail, Calendar, Notion, and your system.',
  error: 'Something interrupted the connection; try refreshing or checking your tokens.',
};

const formatMcpName = (name: string) =>
  name
    .replace(/mcp[-_]?/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || name;

const getTypingStepSize = (contentLength: number) => {
  if (contentLength < 120) return 3;
  if (contentLength < 300) return 6;
  if (contentLength < 700) return 10;
  return 14;
};
/**
 * ChatMode - Primary chat interface for natural language interaction with OpenCode
 */
function ChatMode() {
  const [input, setInput] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [mcpStatus, setMcpStatus] = useState<Record<string, McpServerStatus> | null>(null);
  const [activitySteps, setActivitySteps] = useState(initialActivitySteps());
  const [showCarousel, setShowCarousel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef<'idle' | 'thinking' | 'error'>('idle');
  const fadeTimeoutRef = useRef<number | null>(null);
  const animatedMessagesRef = useRef(new Set<string>());

  const { messages, isLoading, status, error, currentSessionId } = useChatStore();
  const { sendMessage, checkStatus } = useOpenCode();
  const { openCodeStatus, config, isLoaded, loadConfig } = useConfigStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (!isLoaded) {
      loadConfig().catch(() => {});
    }
  }, [isLoaded, loadConfig]);

  useEffect(() => {
    if (!window.flowstate?.mcp?.status) return undefined;
    let active = true;

    const fetchStatus = async () => {
      try {
        const status = await window.flowstate.mcp.status();
        if (active) {
          setMcpStatus(status);
        }
      } catch (err) {
        console.error('Failed to fetch MCP status', err);
        if (active) setMcpStatus(null);
      }
    };

    fetchStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!window.flowstate?.opencode?.onEvent) return undefined;

    const removeEvent = window.flowstate.opencode.onEvent((event) => {
      const step = stepFromOpenCodeEvent(event);
      if (!step) return;
      setActivitySteps((prev) => mergeActivityStep(prev, step));
    });

    return removeEvent;
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setHighlightIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setHighlightIndex((prev) => (prev + 1) % thinkingHighlights.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    if (fadeTimeoutRef.current) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    if (status === 'thinking') {
      if (previousStatus !== 'thinking') {
        setActivitySteps(initialActivitySteps());
      }
      setShowCarousel(true);
    }

    if (previousStatus === 'thinking' && status === 'idle') {
      setActivitySteps((prev) => mergeActivityStep(prev, completionActivityStep()));
      fadeTimeoutRef.current = window.setTimeout(() => {
        setShowCarousel(false);
      }, 700);
    }

    if (status === 'error') {
      setActivitySteps([errorActivityStep()]);
      setShowCarousel(true);
      fadeTimeoutRef.current = window.setTimeout(() => {
        setShowCarousel(false);
      }, 900);
    }

    if (status === 'idle' && !showCarousel) {
      setActivitySteps([]);
    }

    previousStatusRef.current = status;

    return () => {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
    };
  }, [status, showCarousel]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');

    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = () => {
    checkStatus();
  };

  const activityHint = thinkingHighlights[highlightIndex] ?? thinkingHighlights[0];
  const statusLabel = statusDescriptions[status] ?? statusDescriptions.idle;
  const statusDotClass =
    status === 'error'
      ? 'bg-flowstate-error'
      : status === 'thinking'
      ? 'bg-flowstate-primary'
      : 'bg-flowstate-success';

  const openCodeLabel = openCodeStatus?.running ? 'OpenCode is running' : 'OpenCode is offline';
  const sessionLabel = currentSessionId ? `Session ${currentSessionId}` : 'Session pending';
  const providerLabel = config ? `Provider: ${config.provider.default}` : 'Loading config...';

  const mcpEntries = mcpStatus ? Object.entries(mcpStatus) : [];
  const flowstateEntries = mcpEntries.filter(([name]) => name.startsWith('flowstate-'));
  const displayEntries = flowstateEntries.length > 0 ? flowstateEntries : mcpEntries;
  const connectedServices = displayEntries
    .filter(([, value]) => value.status === 'connected')
    .map(([name]) => formatMcpName(name));
  const connectedPreview = connectedServices.slice(0, 4);
  const additionalConnectedCount = Math.max(connectedServices.length - connectedPreview.length, 0);

  const renderMessageParts = (parts?: Message['parts']) => {
    if (!parts || parts.length === 0) return null;

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {parts.map((part, index) => (
          <span
            key={`${part.type}-${index}`}
            className="flex items-center gap-1 rounded-full border border-flowstate-border bg-flowstate-highlight/60 px-3 py-1 text-[11px] font-medium text-flowstate-secondary"
          >
            <span className="uppercase tracking-wide text-[10px] text-flowstate-text-muted">
              {part.type.replace(/_/g, ' ')}
            </span>
            {part.text && (
              <span className="text-[11px] opacity-80">
                {part.text.length > 40 ? `${part.text.slice(0, 40)}…` : part.text}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  };

  const AssistantMessageContent = ({ message }: { message: Message }) => {
    const shouldAnimate = !animatedMessagesRef.current.has(message.id);
    const [visibleText, setVisibleText] = useState(shouldAnimate ? '' : message.content);
    const [isComplete, setIsComplete] = useState(!shouldAnimate);

    useEffect(() => {
      if (!shouldAnimate) {
        setVisibleText(message.content);
        setIsComplete(true);
        return;
      }

      let currentIndex = 0;
      const step = getTypingStepSize(message.content.length);
      let timeoutId: number | null = null;

      const tick = () => {
        currentIndex = Math.min(message.content.length, currentIndex + step);
        setVisibleText(message.content.slice(0, currentIndex));

        if (currentIndex < message.content.length) {
          timeoutId = window.setTimeout(tick, 22);
        } else {
          setIsComplete(true);
          animatedMessagesRef.current.add(message.id);
        }
      };

      tick();

      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }, [message.content, message.id, shouldAnimate]);

    if (!isComplete) {
      return (
        <span className="whitespace-pre-wrap">
          {visibleText}
          <span className="inline-block w-2 animate-pulse text-flowstate-primary">▍</span>
        </span>
      );
    }

    return (
      <>
        {formatContent(message.content)}
        {renderMessageParts(message.parts)}
      </>
    );
  };

  const formatContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const code = part.replace(/```\w*\n?/g, '').replace(/```$/g, '');
        return (
          <pre
            key={index}
            className="bg-flowstate-accent/10 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono"
          >
            <code>{code}</code>
          </pre>
        );
      }

      const lines = part.split('\n');

      return (
        <span key={index}>
          {lines.map((line, lineIndex) => {
            if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
              return (
                <div key={lineIndex} className="flex gap-2 my-1">
                  <span className="text-flowstate-primary">•</span>
                  <span
                    className="text-flowstate-text"
                    dangerouslySetInnerHTML={{
                      __html: line.replace(/^[•-]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                    }}
                  />
                </div>
              );
            }

            return (
              <span key={lineIndex}>
                <span
                  className="text-flowstate-text"
                  dangerouslySetInnerHTML={{
                    __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                  }}
                />
                {lineIndex < lines.length - 1 && <br />}
              </span>
            );
          })}
        </span>
      );
    });
  };

  return (
    <div className="relative flex flex-col h-full">
      <ActivityCarousel steps={activitySteps} isVisible={showCarousel} />
      <div className="space-y-3 mb-4">
        <div className="bg-flowstate-surface/80 border border-flowstate-border rounded-2xl p-4 shadow-flowstate">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-flowstate-text">FlowState Pulse</p>
              <p className="text-xs text-flowstate-text-muted mt-1 max-w-xl">{statusLabel}</p>
            </div>
            <div className="flex flex-col items-end text-xs">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
                <span
                  className={`font-semibold uppercase tracking-widest ${
                    status === 'error' ? 'text-flowstate-error' : 'text-flowstate-text-muted'
                  }`}
                >
                  {status === 'thinking' ? 'Thinking' : status === 'idle' ? 'Ready' : 'Error'}
                </span>
              </div>
              <span className="text-[11px] text-flowstate-text-muted mt-1">{activityHint}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-flowstate-border px-3 py-1 text-flowstate-text-muted">
              {openCodeLabel}
            </span>
            <span className="rounded-full border border-flowstate-border px-3 py-1 text-flowstate-text-muted">
              {sessionLabel}
            </span>
            {openCodeStatus?.version && (
              <span className="rounded-full border border-flowstate-border px-3 py-1 text-flowstate-text-muted">
                v{openCodeStatus.version}
              </span>
            )}
            <span className="rounded-full border border-flowstate-border px-3 py-1 text-flowstate-text-muted">
              {providerLabel}
            </span>
          </div>
          <div className="mt-3">
            <p className="text-xs text-flowstate-text-muted">Connected MCPs</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {connectedServices.length > 0 ? (
                <>
                  {connectedPreview.map((service) => (
                    <span
                      key={service}
                      className="rounded-full border border-flowstate-border bg-flowstate-highlight/60 px-3 py-1 text-[11px] font-medium text-flowstate-secondary"
                    >
                      {service}
                    </span>
                  ))}
                  {additionalConnectedCount > 0 && (
                    <span className="rounded-full border border-flowstate-border px-3 py-1 text-[11px] text-flowstate-text-muted">
                      +{additionalConnectedCount} more
                    </span>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-flowstate-text-muted">
                  Checking MCP health...
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-flowstate-error/10 border border-flowstate-error/20 rounded-lg p-3 mb-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-flowstate-error flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-flowstate-error font-medium">Connection Error</p>
            <p className="text-xs text-flowstate-text-muted">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="p-2 hover:bg-flowstate-error/10 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-flowstate-error" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-4 scrollbar-hide">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-flowstate-primary text-white'
                    : 'bg-flowstate-surface'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-flowstate-border">
                    <Sparkles className="w-4 h-4 text-flowstate-primary" />
                    <span className="text-sm font-medium text-flowstate-primary">FlowState</span>
                  </div>
                )}
                <div className="text-sm">
                  {message.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  ) : (
                    <AssistantMessageContent message={message} />
                  )}
                </div>
                <div
                  className={`text-xs mt-2 ${
                    message.role === 'user'
                      ? 'text-white/70'
                      : 'text-flowstate-text-muted'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}


          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-flowstate-border pt-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              disabled={isLoading}
              className="fs-input resize-none pr-12 min-h-[44px] max-h-32 disabled:opacity-50"
              style={{ height: 'auto' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="fs-button-primary h-11 w-11 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-flowstate-text-muted mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default ChatMode;
