import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const PageHeader = ({ title, description, children, action, className }: PageHeaderProps) => {
  return (
    <div className={cn("flex flex-col space-y-4 pb-6 border-b border-border", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {(action || children) && (
          <div className="flex items-center space-x-2">
            {action || children}
          </div>
        )}
      </div>
    </div>
  );
};