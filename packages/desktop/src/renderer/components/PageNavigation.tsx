import { MessageSquare, ListTodo, Workflow, Plug } from "lucide-react";

interface PageNavigationProps {
  currentPage: "chat" | "tasks" | "workflows" | "integrations";
  onNavigate: (page: "chat" | "tasks" | "workflows" | "integrations") => void;
}

export function PageNavigation({
  currentPage,
  onNavigate,
}: PageNavigationProps) {
  const pages = [
    { id: "chat" as const, icon: MessageSquare, label: "Chat" },
    { id: "tasks" as const, icon: ListTodo, label: "Tasks" },
    { id: "workflows" as const, icon: Workflow, label: "Workflows" },
    { id: "integrations" as const, icon: Plug, label: "Integrations" },
  ];

  return (
    <div className="relative flex items-center gap-2 px-3 py-1.5 bg-card/70 backdrop-blur-2xl border border-border rounded-2xl shadow-lg">
      {pages.map((page) => {
        const Icon = page.icon;
        const isActive = currentPage === page.id;

        return (
          <button
            key={page.id}
            onClick={() => onNavigate(page.id)}
            className={`relative px-3 py-1.5 rounded-xl text-xs transition-all duration-300 ease-linear flex items-center gap-2 ${
              isActive
                ? "bg-[#404040] text-[#fffdfb] shadow-md"
                : "text-foreground/70 hover:bg-[#a5b574]/30"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="font-medium">{page.label}</span>
            {isActive && (
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[rgb(255,137,0)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
