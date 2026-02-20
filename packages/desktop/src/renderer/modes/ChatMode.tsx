import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  Send,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Plus,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { useChatStore } from "../stores/chatStore";
import type { Message } from "../stores/chatStore";
import { useOpenCode } from "../hooks/useOpenCode";
import { useConfigStore } from "../stores/configStore";
import type {
  McpServerStatus,
  SourceDocument,
  StudyMaterialRun,
  TimelineEvent,
} from "../types/electron";
import { parseResponseHeader } from "../lib/responseHeaders";
import { TaskHandoffCard } from "../components/TaskHandoffCard";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { ApprovalCard } from "../components/ApprovalCard";
import { StudyRunDiffCard } from "../components/StudyRunDiffCard";
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

const hasFileDragPayload = (event: React.DragEvent<HTMLDivElement>) => {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
};

const buildAttachedSourcesContext = (sources: SourceDocument[]) => {
  if (sources.length === 0) return "";

  const lines = [...sources]
    .sort((a, b) => b.ingestedAt - a.ingestedAt)
    .slice(0, 12)
    .map((source, index) => {
      return `${index + 1}. ${source.title} (${source.fileType})\n   path: ${source.sourceRef}\n   sourceId: ${source.id}\n   versionHash: ${source.versionHash}`;
    });

  return [
    "Attached local study sources for this session:",
    ...lines,
    "Use these files when answering study questions, creating guides, and generating practice material.",
  ].join("\n");
};

const ATTACHED_SOURCES_CONTEXT_PREFIX =
  "Attached local study sources for this session:";
const ATTACHED_SOURCES_CONTEXT_SUFFIX =
  "Use these files when answering study questions, creating guides, and generating practice material.";

const stripAttachedSourcesContextForDisplay = (content: string) => {
  const trimmedStart = content.trimStart();
  if (!trimmedStart.startsWith(ATTACHED_SOURCES_CONTEXT_PREFIX)) {
    return content;
  }

  const suffixIndex = trimmedStart.indexOf(ATTACHED_SOURCES_CONTEXT_SUFFIX);
  if (suffixIndex < 0) {
    return content;
  }

  const afterSuffix =
    suffixIndex + ATTACHED_SOURCES_CONTEXT_SUFFIX.length;
  const remainder = trimmedStart.slice(afterSuffix).trimStart();
  return remainder.length > 0 ? remainder : "";
};

type StudyDestinationType = "notion" | "obsidian" | "local";

type FallbackDecisionState = {
  classification: "auth_expired" | "external_host" | "inaccessible" | "timeout";
  recommendation: string;
};

type DestinationPromptState = {
  isOpen: boolean;
  pendingMessage: string;
  selectedDestination: StudyDestinationType;
};

const DEFAULT_DESTINATION: StudyDestinationType = "local";

const WRITE_INTENT_PATTERN =
  /\b(write|save|export|publish|sync|send\s+to|push\s+to|notion|obsidian|downloads?)\b/i;

const requiresDestinationConfirmation = (message: string) =>
  WRITE_INTENT_PATTERN.test(message);

const MAX_INPUT_HEIGHT = 128;
const MAX_TYPING_ANIMATION_CHARS = 12000;
const MAX_MARKDOWN_NORMALIZE_CHARS = 200000;

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
  if (!content) return "";
  if (content.length > MAX_MARKDOWN_NORMALIZE_CHARS) {
    return content;
  }

  if (!content.includes("```") && content.includes("•")) {
    return content.replace(/^\s*•\s+/gm, "- ");
  }

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
  const normalizedContent = useMemo(
    () => normalizeAssistantMarkdown(content),
    [content],
  );

  return (
    <ReactMarkdown
      className={assistantMarkdownClassName}
      remarkPlugins={[remarkGfm, remarkBreaks]}
      skipHtml
      disallowedElements={["img"]}
      components={assistantMarkdownComponents}
    >
      {normalizedContent}
    </ReactMarkdown>
  );
};

const AssistantMessageContent = ({
  messageId,
  content,
  parts,
  animatedMessagesRef,
}: {
  messageId: string;
  content: string;
  parts?: Message["parts"];
  animatedMessagesRef: MutableRefObject<Set<string>>;
}) => {
  const shouldAnimate =
    !animatedMessagesRef.current.has(messageId) &&
    content.length <= MAX_TYPING_ANIMATION_CHARS;
  const [visibleText, setVisibleText] = useState(
    shouldAnimate ? "" : content,
  );
  const [isComplete, setIsComplete] = useState(!shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate) {
      setVisibleText(content);
      setIsComplete(true);
      animatedMessagesRef.current.add(messageId);
      return;
    }

    let currentIndex = 0;
    const step = getTypingStepSize(content.length);
    let timeoutId: number | null = null;

    const tick = () => {
      currentIndex = Math.min(content.length, currentIndex + step);
      setVisibleText(content.slice(0, currentIndex));

      if (currentIndex < content.length) {
        timeoutId = window.setTimeout(tick, 22);
      } else {
        setIsComplete(true);
        animatedMessagesRef.current.add(messageId);
      }
    };

    tick();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [content, messageId, shouldAnimate, animatedMessagesRef]);

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
      <AssistantMarkdown content={content} />
      {renderMessageParts(parts)}
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
  const [isDropzoneActive, setIsDropzoneActive] = useState(false);
  const [attachedSources, setAttachedSources] = useState<SourceDocument[]>([]);
  const [fallbackDecision, setFallbackDecision] =
    useState<FallbackDecisionState | null>(null);
  const [destinationPrompt, setDestinationPrompt] = useState<DestinationPromptState>({
    isOpen: false,
    pendingMessage: "",
    selectedDestination: DEFAULT_DESTINATION,
  });
  const [lastDestination, setLastDestination] =
    useState<StudyDestinationType>(DEFAULT_DESTINATION);
  const [latestStudyRunDiffSummary, setLatestStudyRunDiffSummary] = useState<string | null>(null);
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
  const activeTask = useChatStore((state) => state.activeTask);
  const { sendMessage, cancelGeneration, checkStatus, refreshTimeline, createSession, cancelActiveTask } =
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

  const renderedMessages = useMemo(
    () =>
      messages.map((message) => {
        if (message.role === "user") {
          return {
            ...message,
            renderedContent: stripAttachedSourcesContextForDisplay(
              message.content,
            ),
          };
        }

        if (message.role !== "assistant") {
          return {
            ...message,
            renderedContent: message.content,
          };
        }

        const parsed = parseResponseHeader(message.content);
        return {
          ...message,
          renderedContent: parsed.content || " ",
        };
      }),
    [messages],
  );

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

  useEffect(() => {
    const classifyFallback = window.flowstate?.studyMaterials?.classifyFallback;
    if (!error || !classifyFallback) {
      setFallbackDecision(null);
      return;
    }

    let active = true;

    const classify = async () => {
      try {
        const result = await classifyFallback({ message: error });
        if (!active || !result.ok) {
          return;
        }

        if (result.data.classification === "unknown") {
          setFallbackDecision(null);
          return;
        }

        setFallbackDecision({
          classification: result.data.classification,
          recommendation: result.data.recommendation,
        });
      } catch {
        if (active) {
          setFallbackDecision(null);
        }
      }
    };

    void classify();

    return () => {
      active = false;
    };
  }, [error]);

  const sendMessageWithContext = async (message: string) => {
    setInput("");

    // User intent: keep the latest messages in view after sending.
    shouldStickToBottomRef.current = true;
    scrollToBottom("auto");

    const result = await sendMessage(message, {
      contextPrefix: buildAttachedSourcesContext(attachedSources),
    });
    if (result?.success) {
      refreshTimeline();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();

    if (requiresDestinationConfirmation(message)) {
      setDestinationPrompt({
        isOpen: true,
        pendingMessage: message,
        selectedDestination: lastDestination,
      });
      return;
    }

    await sendMessageWithContext(message);
  };

  const handleConfirmDestination = async () => {
    const studyMaterialsApi = window.flowstate?.studyMaterials;
    const pendingMessage = destinationPrompt.pendingMessage.trim();
    if (!pendingMessage) {
      setDestinationPrompt((prev) => ({ ...prev, isOpen: false }));
      return;
    }

    const destinationType = destinationPrompt.selectedDestination;

    if (studyMaterialsApi) {
      const studyRunId =
        globalThis.crypto?.randomUUID?.() ??
        `study_run_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const courseId = currentSessionId
        ? `session-${currentSessionId}`
        : "chat-manual-upload";

      try {
        const createRunResult = await studyMaterialsApi.createRun({
          id: studyRunId,
          courseId,
          mode: "conservative",
          destinationType,
          status: "awaiting_destination",
        });

        if (createRunResult.ok) {
          await studyMaterialsApi.confirmDestination({
            studyRunId,
            destinationType,
            status: "queued",
          });

          const recentRunsResult = await studyMaterialsApi.listRuns({
            courseId,
            limit: 3,
            offset: 0,
          });

          if (recentRunsResult.ok) {
            const previousRun = recentRunsResult.data.find(
              (run: StudyMaterialRun) => run.id !== studyRunId,
            );
            if (previousRun) {
              const summary = `Run diff: destination ${previousRun.destinationType} -> ${destinationType}; status ${previousRun.status} -> queued.`;
              await studyMaterialsApi.createDiff({
                id:
                  globalThis.crypto?.randomUUID?.() ??
                  `study_diff_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                studyRunId,
                previousStudyRunId: previousRun.id,
                summary,
              });
              setLatestStudyRunDiffSummary(summary);
            }
          }
        }
      } catch {
        // Destination confirmation best-effort for now; do not block chat send.
      }
    }

    setLastDestination(destinationType);
    setDestinationPrompt({
      isOpen: false,
      pendingMessage: "",
      selectedDestination: destinationType,
    });
    await sendMessageWithContext(pendingMessage);
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

  const handleFallbackRetryCanvas = () => {
    setFallbackDecision(null);
    handleRetry();
  };

  const handleFallbackUploadLocal = async () => {
    setFallbackDecision(null);
    await handleBrowseFiles();
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

  const handleStopGeneration = async () => {
    await cancelGeneration();
  };

  const canStopActiveTask = Boolean(
    activeTask &&
      activeTask.sessionId === currentSessionId &&
      (activeTask.status === "running" || activeTask.status === "waiting_approval"),
  );

  const handleStopActiveTask = async () => {
    if (!canStopActiveTask) return;
    const result = await cancelActiveTask();
    if (!result.success) {
      console.error("Failed to cancel active task from ChatMode", result.error);
    }
  };

  const extractFilePathsFromDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const fromFileList = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((value): value is string =>
        typeof value === "string" && value.trim().length > 0,
      )
      .map((value) => value.trim());

    if (fromFileList.length > 0) {
      return Array.from(new Set(fromFileList));
    }

    const fromItems = Array.from(event.dataTransfer.items)
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .map((file) => (file as File & { path?: string }).path)
      .filter((value): value is string =>
        typeof value === "string" && value.trim().length > 0,
      )
      .map((value) => value.trim());

    return Array.from(new Set(fromItems));
  };

  const uploadStudySourceFiles = async (rawPaths: string[]) => {
    const studyMaterialsApi = window.flowstate?.studyMaterials;
    if (!studyMaterialsApi) {
      console.warn("Study materials API unavailable.");
      return;
    }

    const paths = Array.from(
      new Set(
        rawPaths
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );

    if (paths.length === 0) {
      console.warn("No file paths detected from drop event.");
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    const failureMessages: string[] = [];
    const courseId = currentSessionId
      ? `session-${currentSessionId}`
      : "chat-manual-upload";

    for (const filePath of paths) {
      try {
        const validateResult = await studyMaterialsApi.validateLocalSource({
          filePath,
        });

        if (!validateResult.ok) {
          failureCount += 1;
          failureMessages.push(
            `${filePath}: ${validateResult.error.message}`,
          );
          continue;
        }

        const validation = validateResult.data;
        if (
          !validation.ok ||
          !validation.fileType ||
          !validation.fileName ||
          !validation.normalizedPath ||
          !validation.versionHash
        ) {
          failureCount += 1;
          failureMessages.push(
            `${filePath}: ${validation.issue?.message ?? "Validation failed."}`,
          );
          continue;
        }

        const sourceId =
          globalThis.crypto?.randomUUID?.() ??
          `source_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

        const createResult = await studyMaterialsApi.createSource({
          id: sourceId,
          courseId,
          origin: "local",
          fileType: validation.fileType,
          title: validation.fileName,
          sourceRef: validation.normalizedPath,
          versionHash: validation.versionHash,
          ingestedAt: Date.now(),
        });

        if (!createResult.ok) {
          failureCount += 1;
          failureMessages.push(
            `${validation.fileName}: ${createResult.error.message}`,
          );
          continue;
        }

        successCount += 1;
      } catch (error) {
        failureCount += 1;
        failureMessages.push(
          `${filePath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (successCount === 0) {
      console.warn(
        failureMessages[0] ?? "No valid PDF/PPTX files were uploaded.",
      );
    }

    if (successCount > 0) {
      const courseId = currentSessionId
        ? `session-${currentSessionId}`
        : "chat-manual-upload";
      try {
        const listResult = await studyMaterialsApi.listSources({
          courseId,
          origin: "local",
          limit: 200,
          offset: 0,
        });
        if (listResult.ok) {
          setAttachedSources(listResult.data);
        } else {
          console.warn("Unable to refresh attached sources.");
        }
      } catch {
        console.warn("Unable to refresh attached sources.");
      }
    }

  };

  const handleDropzoneDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileDragPayload(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isDropzoneActive) {
      setIsDropzoneActive(true);
    }
  };

  const handleDropzoneDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileDragPayload(event)) return;
    event.preventDefault();
    setIsDropzoneActive(true);
  };

  const handleDropzoneDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsDropzoneActive(false);
  };

  const handleDropzoneDrop = async (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    if (!hasFileDragPayload(event)) return;
    event.preventDefault();
    setIsDropzoneActive(false);
    const filePaths = extractFilePathsFromDrop(event);
    await uploadStudySourceFiles(filePaths);
  };

  const handleBrowseFiles = async () => {
    const picker = window.flowstate?.app?.showOpenFilesDialog;
    if (!picker) return;

    const selectedPaths = await picker({
      title: "Attach study files",
      multiSelect: true,
      filters: [
        {
          name: "Study files",
          extensions: ["pdf", "pptx"],
        },
      ],
    });

    if (!selectedPaths || selectedPaths.length === 0) return;
    await uploadStudySourceFiles(selectedPaths);
  };

  useEffect(() => {
    const loadAttachedSources = async () => {
      const studyMaterialsApi = window.flowstate?.studyMaterials;
      if (!studyMaterialsApi || !currentSessionId) {
        setAttachedSources([]);
        return;
      }

      try {
        const listResult = await studyMaterialsApi.listSources({
          courseId: `session-${currentSessionId}`,
          origin: "local",
          limit: 200,
          offset: 0,
        });

        if (listResult.ok) {
          setAttachedSources(listResult.data);
        } else {
          setAttachedSources([]);
        }
      } catch {
        setAttachedSources([]);
      }
    };

    void loadAttachedSources();
  }, [currentSessionId]);

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
    <div
      className="h-full flex flex-col overflow-hidden"
      onDragEnter={handleDropzoneDragEnter}
      onDragOver={handleDropzoneDragOver}
      onDragLeave={handleDropzoneDragLeave}
      onDrop={(event) => {
        void handleDropzoneDrop(event);
      }}
    >
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
                <div className="flex items-center gap-2">
                  {canStopActiveTask && (
                    <button
                      type="button"
                      onClick={handleStopActiveTask}
                      className="inline-flex items-center gap-2 rounded-full border border-destructive/40 px-3 py-1 text-[11px] text-destructive transition-all hover:bg-destructive/10"
                    >
                      <Square className="h-3.5 w-3.5" />
                      Stop task
                    </button>
                  )}
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

      {fallbackDecision && (
        <div className="mx-6 mt-3 rounded-xl border border-amber-300/50 bg-amber-100/40 p-3 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide">
            Canvas source fallback available
          </p>
          <p className="mt-1 text-xs">
            {fallbackDecision.recommendation}
          </p>
          <p className="mt-1 text-[11px] opacity-80">
            Classification: {fallbackDecision.classification}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleFallbackRetryCanvas}
              className="rounded-full border border-amber-500/60 bg-transparent px-3 py-1 text-[11px] font-medium transition-colors hover:bg-amber-100"
            >
              Retry Canvas now
            </button>
            <button
              type="button"
              onClick={() => {
                void handleFallbackUploadLocal();
              }}
              className="rounded-full border border-amber-500/60 bg-amber-200/70 px-3 py-1 text-[11px] font-medium transition-colors hover:bg-amber-200"
            >
              Upload local file instead
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 px-6 py-4 flex flex-col">
        <div
          ref={messagesScrollRef}
          onScroll={updateStickToBottom}
          className="w-full max-w-4xl mx-auto flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-4 pb-24 scroll-pb-24 scrollbar-hide"
        >
          {renderedMessages.map((message) => (
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
                      messageId={message.id}
                      content={message.renderedContent}
                      parts={message.parts}
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
          {attachedSources.length > 0 && (
            <p className="mb-1 text-center text-[11px] text-muted-foreground">
              {attachedSources.length} {attachedSources.length === 1 ? "file" : "files"} uploaded
            </p>
          )}
            <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl shadow-lg p-4">
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void handleBrowseFiles();
                  }}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center self-center rounded-full border border-border bg-background/70 text-muted-foreground transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                  aria-label="Browse files to attach"
                >
                  <Plus className="h-4 w-4" />
                </button>
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
              {showThinking ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="flex-shrink-0 w-10 h-10 rounded-xl border border-destructive/80 bg-destructive hover:bg-destructive/90 text-destructive-foreground flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 shadow-md"
                  aria-label="Stop generation"
                >
                  <Square className="w-4 h-4" fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-muted disabled:opacity-50 flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-105 active:scale-95 shadow-md"
                >
                  <Send className="w-5 h-5 text-primary-foreground" />
                </button>
              )}
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
          {latestStudyRunDiffSummary && (
            <div className="mt-2">
              <StudyRunDiffCard summary={latestStudyRunDiffSummary} />
            </div>
          )}
        </div>
      </div>

      {destinationPrompt.isOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <p className="text-sm font-semibold text-foreground">
              Confirm destination for this run
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose where FlowState should write outputs for this request.
              External writes always require explicit confirmation.
            </p>

            <div className="mt-4 grid gap-2">
              {([
                ["local", "Local (Downloads)", "Recommended default"],
                ["notion", "Notion", "Creates external workspace content"],
                ["obsidian", "Obsidian", "Writes into selected vault path"],
              ] as Array<[StudyDestinationType, string, string]>).map(
                ([value, label, hint]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setDestinationPrompt((prev) => ({
                        ...prev,
                        selectedDestination: value,
                      }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      destinationPrompt.selectedDestination === value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{hint}</p>
                  </button>
                ),
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setDestinationPrompt({
                    isOpen: false,
                    pendingMessage: "",
                    selectedDestination: lastDestination,
                  })
                }
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmDestination();
                }}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Confirm and continue
              </button>
            </div>
          </div>
        </div>
      )}

      {isDropzoneActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center bg-background/40 pb-8">
          <div className="pointer-events-none rounded-full border border-primary/40 bg-card/95 px-4 py-2 text-xs text-foreground shadow-lg">
            Drop PDF/PPTX to upload
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatMode;
