import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Send, Sparkles, AlertCircle, RefreshCw, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { useChatStore } from "../stores/chatStore";
import type { Message } from "../stores/chatStore";
import { useOpenCode } from "../hooks/useOpenCode";
import { useConfigStore } from "../stores/configStore";
import type { McpServerStatus, TimelineEvent } from "../types/electron";
import { TaskHandoffCard } from "../components/TaskHandoffCard";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { ApprovalCard } from "../components/ApprovalCard";
import {
  errorActivityStep,
  initialActivitySteps,
  mergeActivityStep,
  stepFromOpenCodeEvent,
} from "../lib/opencodeActivity";

type ApprovalPayloadInline = {
  requestId?: string;
  title?: string;
  summary?: string;
  body?: string;
  approveLabel?: string;
  alwaysApproveLabel?: string;
  denyLabel?: string;
};

const isApprovalPayloadInline = (
  payload: unknown,
): payload is ApprovalPayloadInline => {
  return (
    Boolean(payload) && typeof payload === "object" && !Array.isArray(payload)
  );
};

const approvalPayloadForEvent = (event: TimelineEvent) =>
  isApprovalPayloadInline(event.payloadInline)
    ? event.payloadInline
    : undefined;

const requestIdForEvent = (event: TimelineEvent) => {
  const payload = approvalPayloadForEvent(event);
  return typeof payload?.requestId === "string" &&
    payload.requestId.trim().length > 0
    ? payload.requestId
    : null;
};

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

const assistantMarkdownComponents: Components = {
  p: ({ children }) => (
    <p className="text-foreground whitespace-pre-wrap break-words mb-2 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-5 list-disc space-y-1 marker:text-primary">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 marker:text-primary">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-foreground">{children}</li>,
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:opacity-90"
      onClick={(event) => {
        if (!href) return;
        event.preventDefault();
        window.flowstate?.app?.openExternal?.(href).catch(() => {});
      }}
      {...props}
    >
      {children}
    </a>
  ),
};

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
              {part.text.length > 40 ? `${part.text.slice(0, 40)}…` : part.text}
            </span>
          )}
        </span>
      ))}
    </div>
  );
};

const assistantMarkdownClassName =
  "break-words " +
  "[&_pre]:bg-accent/30 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre]:font-mono " +
  "[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:rounded [&_code]:bg-muted/60 [&_code]:px-1.5 [&_code]:py-0.5 " +
  "[&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:rounded-none [&_pre_code]:text-sm";

const normalizeAssistantMarkdown = (content: string) => {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part) => {
      if (part.startsWith("```")) return part;

      // Preserve existing chat look when the model uses bullet glyphs.
      return part.replace(/^\s*•\s+/gm, "- ");
    })
    .join("");
};

const AssistantMarkdown = ({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      className={assistantMarkdownClassName}
      remarkPlugins={[remarkGfm, remarkBreaks]}
      skipHtml
      disallowedElements={["img"]}
      components={assistantMarkdownComponents}
    >
      {normalizeAssistantMarkdown(content)}
    </ReactMarkdown>
  );
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
      <AssistantMarkdown content={message.content} />
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
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [approvalReplying, setApprovalReplying] = useState<
    null | "once" | "always" | "deny"
  >(null);
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
  const { sendMessage, checkStatus, refreshTimeline, createSession } =
    useOpenCode();
  const { openCodeStatus, config, isLoaded, loadConfig } = useConfigStore();
  const approvalsAvailable = Boolean(window.flowstate?.approvals?.reply);

  const pendingApprovals = useMemo(() => {
    if (!timeline || timeline.length === 0) {
      return { latest: null as null | TimelineEvent, count: 0 };
    }

    const responded = new Set<string>();
    for (const event of timeline) {
      if (event.kind !== "approval_response") continue;
      const requestId = requestIdForEvent(event);
      if (requestId) responded.add(requestId);
    }

    const pending: TimelineEvent[] = [];
    for (const event of timeline) {
      if (event.kind !== "approval_request") continue;
      const requestId = requestIdForEvent(event);
      if (requestId && responded.has(requestId)) continue;
      pending.push(event);
    }

    if (pending.length === 0) {
      return { latest: null as null | TimelineEvent, count: 0 };
    }

    let latest = pending[0]!;
    for (let i = 1; i < pending.length; i += 1) {
      if (pending[i]!.timestamp > latest.timestamp) {
        latest = pending[i]!;
      }
    }

    return { latest, count: pending.length };
  }, [timeline]);

  const replyToApproval = async (
    requestId: string,
    mode: "once" | "always" | "deny",
  ): Promise<void> => {
    if (!window.flowstate?.approvals?.reply) {
      throw new Error(
        "Approvals bridge unavailable — restart FlowState to reload the preload API.",
      );
    }
    if (approvalReplying) return;

    setApprovalReplying(mode);
    try {
      const result = await window.flowstate.approvals.reply(requestId, mode);
      if (!result.success) {
        throw new Error(result.error ?? "Approval failed");
      }
      await refreshTimeline();
    } finally {
      setApprovalReplying(null);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  const updateStickToBottom = () => {
    const el = messagesScrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 64;
  };

  useEffect(() => {
    // Avoid `scrollIntoView` which can scroll the window/body when content grows.
    // Only auto-scroll when the user is already near the bottom.
    if (!shouldStickToBottomRef.current) return;
    scrollToBottom(status === "thinking" || isLoading ? "auto" : "smooth");
  }, [messages, status, isLoading]);

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

    // User intent: keep the latest messages in view after sending.
    shouldStickToBottomRef.current = true;
    scrollToBottom("auto");

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

  const handleNewChat = async () => {
    try {
      await createSession();
      setInput("");
      shouldStickToBottomRef.current = true;
      scrollToBottom("auto");
      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to create new chat session", err);
    }
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
        <div className="flex justify-center items-center text-xs text-muted-foreground">
          <span className="sr-only">Thinking</span>

          <span
            className="flex items-center justify-center gap-1"
            aria-hidden="true"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.2s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.1s]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
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
              <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground text-right">
                <p>{providerLabel}</p>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-all hover:bg-muted/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New chat
                </button>
              </div>
            </div>
            {activityDetail && (
              <p className="mt-2 text-xs text-muted-foreground">
                {activityDetail}
              </p>
            )}
            {timeline.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    {activityExpanded ? (
                      <ActivityTimeline
                        events={timeline}
                        title="Activity"
                        collapsed={false}
                        maxItems={8}
                        maxItemsExpanded={200}
                        variant="default"
                        onApprove={(event) => {
                          const requestId = requestIdForEvent(event);
                          if (!requestId) {
                            console.warn(
                              "Approval request missing requestId",
                              event,
                            );
                            return;
                          }
                          return approvalsAvailable
                            ? replyToApproval(requestId, "once")
                            : undefined;
                        }}
                        onAlwaysApprove={(event) => {
                          const requestId = requestIdForEvent(event);
                          if (!requestId) {
                            console.warn(
                              "Approval request missing requestId",
                              event,
                            );
                            return;
                          }
                          return approvalsAvailable
                            ? replyToApproval(requestId, "always")
                            : undefined;
                        }}
                        onDeny={(event) => {
                          const requestId = requestIdForEvent(event);
                          if (!requestId) {
                            console.warn(
                              "Approval request missing requestId",
                              event,
                            );
                            return;
                          }
                          return approvalsAvailable
                            ? replyToApproval(requestId, "deny")
                            : undefined;
                        }}
                      />
                    ) : (
                      <ActivityTimeline
                        events={timeline}
                        title="Activity"
                        collapsed
                        maxItems={1}
                        variant="compact"
                      />
                    )}
                  </div>

                  {timeline.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setActivityExpanded((prev) => !prev)}
                      className="shrink-0 rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-all hover:bg-muted/50"
                      aria-expanded={activityExpanded}
                    >
                      {activityExpanded ? "Collapse" : "Expand"}
                    </button>
                  )}
                </div>
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
        <div
          ref={messagesScrollRef}
          onScroll={updateStickToBottom}
          className="w-full max-w-4xl mx-auto flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pb-24 scroll-pb-24 scrollbar-hide"
        >
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

          {pendingApprovals.latest && (
            <div className="w-full flex justify-start">
              <div className="w-full max-w-[70%]">
                <ApprovalCard
                  title={
                    approvalPayloadForEvent(pendingApprovals.latest)?.title ??
                    pendingApprovals.latest.title
                  }
                  summary={
                    approvalPayloadForEvent(pendingApprovals.latest)?.summary ??
                    pendingApprovals.latest.detail ??
                    "This action requires your approval."
                  }
                  body={
                    approvalPayloadForEvent(pendingApprovals.latest)?.body ?? ""
                  }
                  primaryActionLabel={
                    approvalPayloadForEvent(pendingApprovals.latest)
                      ?.approveLabel
                  }
                  alwaysApproveLabel={
                    approvalPayloadForEvent(pendingApprovals.latest)
                      ?.alwaysApproveLabel
                  }
                  denyLabel={
                    approvalPayloadForEvent(pendingApprovals.latest)?.denyLabel
                  }
                  onApprove={() => {
                    const requestId = requestIdForEvent(
                      pendingApprovals.latest!,
                    );
                    if (!requestId) {
                      console.warn(
                        "Approval request missing requestId",
                        pendingApprovals.latest,
                      );
                      setActivityExpanded(true);
                      return;
                    }
                    return approvalsAvailable
                      ? replyToApproval(requestId, "once")
                      : undefined;
                  }}
                  onAlwaysApprove={() => {
                    const requestId = requestIdForEvent(
                      pendingApprovals.latest!,
                    );
                    if (!requestId) {
                      console.warn(
                        "Approval request missing requestId",
                        pendingApprovals.latest,
                      );
                      setActivityExpanded(true);
                      return;
                    }
                    return approvalsAvailable
                      ? replyToApproval(requestId, "always")
                      : undefined;
                  }}
                  onDeny={() => {
                    const requestId = requestIdForEvent(
                      pendingApprovals.latest!,
                    );
                    if (!requestId) {
                      console.warn(
                        "Approval request missing requestId",
                        pendingApprovals.latest,
                      );
                      setActivityExpanded(true);
                      return;
                    }
                    return approvalsAvailable
                      ? replyToApproval(requestId, "deny")
                      : undefined;
                  }}
                />

                {!approvalsAvailable && (
                  <p className="mt-2 text-[11px] text-destructive">
                    Approvals bridge unavailable — restart FlowState to reload
                    the preload API.
                  </p>
                )}

                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-muted-foreground">
                    {pendingApprovals.count > 1
                      ? `${pendingApprovals.count} approvals pending - showing latest.`
                      : "Approval pending."}
                  </span>
                  {timeline.length > 1 && !activityExpanded && (
                    <button
                      type="button"
                      onClick={() => setActivityExpanded(true)}
                      className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-all hover:bg-muted/50"
                    >
                      View activity
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {showThinking && <ThinkingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

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
          {handoffTask && (
            <div className="mt-2">
              <TaskHandoffCard
                title={handoffTask.title}
                description={handoffTask.description}
                onViewTask={onViewTask}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatMode;
