import type { ReactNode } from "react";
import { MessageSquare, CheckSquare, Workflow, Puzzle } from "lucide-react";

interface NavigationCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
  onClick: () => void;
}

function NavigationCard({
  icon,
  title,
  description,
  color,
  onClick,
}: NavigationCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl bg-card backdrop-blur-xl border border-border p-8 transition-all duration-300 ease-in-out hover:bg-card/90 hover:border-primary/20 hover:scale-[1.03] active:scale-100 shadow-sm"
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center transition-transform duration-300 ease-in-out group-hover:scale-110 shadow-md"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-xl text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-accent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none" />
    </button>
  );
}

export function HomeScreen({
  onNavigate,
}: {
  onNavigate: (page: "chat" | "tasks" | "workflows" | "integrations") => void;
}) {
  const navigationItems = [
    {
      icon: <MessageSquare className="w-8 h-8 text-white" />,
      title: "Chat",
      description: "Converse with AI agents",
      color: "#C87137",
      page: "chat" as const,
    },
    {
      icon: <CheckSquare className="w-8 h-8 text-white" />,
      title: "Tasks",
      description: "Manage your work items",
      color: "#3E2F27",
      page: "tasks" as const,
    },
    {
      icon: <Workflow className="w-8 h-8 text-white" />,
      title: "Workflows",
      description: "Automate your processes",
      color: "#A5B574",
      page: "workflows" as const,
    },
    {
      icon: <Puzzle className="w-8 h-8 text-white" />,
      title: "Integrations",
      description: "Connect your tools",
      color: "#E8BFA0",
      page: "integrations" as const,
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 pb-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl mb-3 text-foreground">Welcome to FlowState</h1>
        <p className="text-lg text-muted-foreground">
          Choose where to begin your journey
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 max-w-4xl w-full">
        {navigationItems.map((item) => (
          <NavigationCard
            key={item.title}
            icon={item.icon}
            title={item.title}
            description={item.description}
            color={item.color}
            onClick={() => onNavigate(item.page)}
          />
        ))}
      </div>
    </div>
  );
}
