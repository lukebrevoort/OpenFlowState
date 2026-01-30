import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Send, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import { useChatStore } from "../stores/chatStore";
import type { Message } from "../stores/chatStore";
import { useOpenCode } from "../hooks/useOpenCode";
import { useConfigStore } from "../stores/configStore";
import type { McpServerStatus } from "../types/electron";
import { TaskHandoffCard } from "../components/TaskHandoffCard";
import { ActivityTimeline } from "../components/ActivityTimeline";
import {
  errorActivityStep,
  initialActivitySteps,
  mergeActivityStep,
  stepFromOpenCodeEvent,
} from "../lib/opencodeActivity";

const statusLabels: Record<"idle" | "thinking" | "error", string> = {
  idle: "Ready",
  thinking: "Thinking",
  error: "Needs attention",
};

const formatMcpName = (name: string) =>
  name
    .replace(/mcp[-_]?/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || name;

const getTypingStepSize = (contentLength: number) => {
  if (contentLength < 120) return 3;
  if (contentLength < 300) return 6;
  if (contentLength < 700) return 10;
  return 14;
};

const MAX_INPUT_HEIGHT = 128;

const renderMessageParts = (parts?: Message["parts"]) => {
  if (!parts || parts.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {parts.map((part, index) => (
        <span
          key={`${part.type}-${index}`}
          className="flex items-center gap-1 rounded-full border border-border bg-muted/60 px-3 py-1 text-[11px] font-medium text-secondary-foreground"
        >
          <span className="uppercase tracking-wide text-[10px] text-muted-foreground">
            {part.type.replace(/_/g, " ")}
          </span>
          {part.text && (
            <span className="text-[11px] opacity-80">
              {part.text.length > 40
                ? `${part.text.slice(0, 40)}…`
                : part.text}
            </span>
          )}
        </span>
      ))}
    </div>
  );
};

const formatContent = (content: string) => {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```")) {
      const code = part.replace(/```\w*\n?/g, "").replace(/```$/g, "");
      return (
        <pre
          key={index}
          className="bg-accent/30 rounded-lg p-3 my-2 overflow-x-auto text-sm font-mono"
        >
          <code>{code}</code>
        </pre>
      );
    }

    const lines = part.split("\n");

    return (
      <span key={index}>
        {lines.map((line, lineIndex) => {
          if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
            return (
              <div key={lineIndex} className="flex gap-2 my-1">
                <span className="text-primary">•</span>
                <span
                  className="text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: line
                      .replace(/^[•-]\s*/, "")
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
                  }}
                />
              </div>
            );
          }

          return (
            <span key={lineIndex}>
              <span
                className="text-foreground"
                dangerouslySetInnerHTML={{
                  __html: line.replace(
                    /\*\*(.*?)\*\*/g,
                    "<strong>$1</strong>",
                  ),
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

const AssistantMessageContent = ({
  message,
  animatedMessagesRef,
}: {
  message: Message;
  animatedMessagesRef: MutableRefObject<Set<string>>;
}) => {
  const shouldAnimate = !animatedMessagesRef.current.has(message.id);
  const [visibleText, setVisibleText] = useState(
    shouldAnimate ? "" : message.content,
  );
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
  }, [message.content, message.id, shouldAnimate, animatedMessagesRef]);

  if (!isComplete) {
    return (
      <span className="whitespace-pre-wrap">
        {visibleText}
        <span className="inline-block w-2 animate-pulse text-primary">▍</span>
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
/**
 * ChatMode - Primary chat interface for natural language interaction with OpenCode
 */
function ChatMode({ onViewTask }: { onViewTask?: () => void }) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mcpStatus, setMcpStatus] = useState<Record<
    string,
    McpServerStatus
  > | null>(null);
  const [activitySteps, setActivitySteps] = useState<
    ReturnType<typeof initialActivitySteps>
  >([]);
  const [activityIndex, setActivityIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousStatusRef = useRef<"idle" | "thinking" | "error">("idle");
  const animatedMessagesRef = useRef(new Set<string>());
  const initialMessagesRef = useRef(false);

  const messages = useChatStore((state) => state.messages);
  const isLoading = useChatStore((state) => state.isLoading);
  const status = useChatStore((state) => state.status);
  const error = useChatStore((state) => state.error);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const handoffTask = useChatStore((state) => state.handoffTask);
  const timeline = useChatStore((state) => state.timeline);
  const { sendMessage, checkStatus, refreshTimeline } = useOpenCode();
  const { openCodeStatus, config, isLoaded, loadConfig } = useConfigStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialMessagesRef.current) return;
    messages.forEach((message) => animatedMessagesRef.current.add(message.id));
    initialMessagesRef.current = true;
  }, [messages]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_INPUT_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [input]);

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
        console.error("Failed to fetch MCP status", err);
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
      if (status !== "thinking") return;
      const step = stepFromOpenCodeEvent(event);
      if (!step) return;
      setActivitySteps((prev) => mergeActivityStep(prev, step));
    });

    return removeEvent;
  }, [status]);

  useEffect(() => {
    if (status !== "thinking" || activitySteps.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setActivityIndex((prev) => (prev + 1) % activitySteps.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [status, activitySteps]);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;

    if (status === "thinking" && previousStatus !== "thinking") {
      setActivitySteps(initialActivitySteps());
      setActivityIndex(0);
    }

    if (status === "error") {
      setActivitySteps([errorActivityStep()]);
      setActivityIndex(0);
    }

    if (status === "idle" && previousStatus === "thinking") {
      setActivitySteps([]);
      setActivityIndex(0);
    }

    previousStatusRef.current = status;
  }, [status]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput("");

    const result = await sendMessage(message);
    if (result?.success) {
      refreshTimeline();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = () => {
    checkStatus();
  };

  const statusLabel = statusLabels[status] ?? statusLabels.idle;
  const sessionLabel = currentSessionId
    ? `Session ${currentSessionId}`
    : "Session pending";
  const providerLabel = config
    ? `Provider: ${config.provider.default}`
    : "Loading config...";

  const currentActivity =
    activitySteps[activityIndex] ?? activitySteps[activitySteps.length - 1];
  const activityTitle =
    currentActivity?.title ??
    (status === "thinking"
      ? "Working through your request"
      : "Ready for your next prompt");
  const activityDetail = currentActivity?.detail;

  const mcpEntries = mcpStatus ? Object.entries(mcpStatus) : [];
  const flowstateEntries = mcpEntries.filter(([name]) =>
    name.startsWith("flowstate-"),
  );
  const displayEntries =
    flowstateEntries.length > 0 ? flowstateEntries : mcpEntries;
  const connectedServices = displayEntries
    .filter(([, value]) => value.status === "connected")
    .map(([name]) => formatMcpName(name));
  const connectedPreview = connectedServices.slice(0, 4);
  const additionalConnectedCount = Math.max(
    connectedServices.length - connectedPreview.length,
    0,
  );

  const showThinking = status === "thinking" || isLoading;

  const ThinkingIndicator = () => (
    <div className="w-full flex justify-start">
      <div className="max-w-[70%] rounded-2xl px-4 py-3 bg-card border border-border text-foreground backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">FlowState</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="sr-only">Thinking</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.2s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.1s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/80 animate-bounce" />
          </span>
        </div>
      </div>
    </div>
  );


  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-4">
        <div className="w-full max-w-4xl mx-auto">
          <div className="bg-card/80 border border-border rounded-2xl p-5 shadow-[0_18px_40px_rgba(62,47,39,0.16)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-[#A5B574]/25 pulse-ring" />
                  <div className="absolute inset-[-8px] rounded-full bg-[#A5B574]/15 pulse-ring" />
                  <div
                    className={`relative h-10 w-10 rounded-full bg-gradient-to-br from-[#A5B574] to-[#C87137] shadow-lg flex items-center justify-center ${status === "thinking" ? "animate-pulse-gentle" : ""}`}
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {statusLabel}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activityTitle}
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                <p>{providerLabel}</p>
              </div>
            </div>
            {activityDetail && (
              <p className="mt-2 text-xs text-muted-foreground">
                {activityDetail}
              </p>
            )}
            {timeline.length > 0 && (
              <div className="mt-2">
                <ActivityTimeline
                  events={timeline}
                  title="Activity"
                  collapsed
                  maxItems={1}
                  variant="compact"
                />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                {sessionLabel}
              </span>
              {openCodeStatus?.version && (
                <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                  v{openCodeStatus.version}
                </span>
              )}
              {connectedServices.length > 0 && (
                <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                  {connectedServices.length} MCPs connected
                </span>
              )}
            </div>
            {connectedServices.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {connectedPreview.map((service) => (
                  <span
                    key={service}
                    className="rounded-full border border-border bg-muted/60 px-3 py-1 text-[11px] font-medium text-secondary-foreground"
                  >
                    {service}
                  </span>
                ))}
                {additionalConnectedCount > 0 && (
                  <span className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground">
                    +{additionalConnectedCount} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mx-6 mt-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-destructive font-medium">
                Assistant Error
              </p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={handleRetry}
            className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-destructive" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
        <div className="w-full max-w-4xl mx-auto flex-1 min-h-0 overflow-y-auto space-y-4 pb-24 scroll-pb-24 scrollbar-hide">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`w-full flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-card border border-border text-foreground shadow-sm"
                      : "bg-card border border-border text-foreground backdrop-blur-xl"
                  }`}
                >
                {message.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">
                      FlowState
                    </span>
                  </div>
                )}
                <div className="text-sm leading-relaxed">
                  {message.role === "user" ? (
                    <span className="whitespace-pre-wrap break-words text-foreground">
                      {message.content}
                    </span>
                  ) : (
                    <AssistantMessageContent
                      message={message}
                      animatedMessagesRef={animatedMessagesRef}
                    />
                  )}
                </div>
                <div
                  className={`text-xs mt-2 ${
                    message.role === "user"
                      ? "text-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}

          {showThinking && <ThinkingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {handoffTask && (
        <div className="px-6 pb-4">
          <div className="w-full max-w-4xl mx-auto">
            <TaskHandoffCard
              title={handoffTask.title}
              description={handoffTask.description}
              onViewTask={onViewTask}
            />
          </div>
        </div>
      )}

      <div className="flex-shrink-0 px-6 pb-6">
        <div className="w-full max-w-4xl mx-auto">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-lg p-4">
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                disabled={isLoading}
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-32 overflow-y-auto disabled:opacity-50"
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-muted disabled:opacity-50 flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 shadow-md"
              >
                <Send className="w-5 h-5 text-primary-foreground" />
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatMode;
