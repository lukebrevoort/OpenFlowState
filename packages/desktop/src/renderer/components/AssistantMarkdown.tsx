import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

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

export default AssistantMarkdown;

