import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { notificationService } from "@/services/notificationService";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export const NotificationsMenu = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: unread = [] } = useQuery({
    queryKey: ["system-notifications", "unread"],
    queryFn: () => notificationService.listUnread(8),
    staleTime: 15_000,
  });

  const unreadCount = unread.length;

  const markRead = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-notifications"] });
    },
  });

  const items = useMemo(() => unread.slice(0, 8), [unread]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10 relative"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1">
              <Badge className="px-1.5 py-0 text-[10px] leading-4 bg-red-600 text-white border-transparent">
                {unreadCount}
              </Badge>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => markAllRead.mutate()}
            disabled={unreadCount === 0 || markAllRead.isPending}
            title="Mark all as read"
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Mark all
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">No unread notifications.</div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="cursor-pointer flex flex-col items-start gap-1"
              onClick={async () => {
                await markRead.mutateAsync(n.id);
                const propNo = n.inventory_items?.property_number;
                if (propNo) {
                  navigate(`/inventory?search=${encodeURIComponent(propNo)}`);
                } else {
                  navigate(`/reports`);
                }
              }}
            >
              <div className="w-full flex items-center justify-between gap-3">
                <span className="font-medium">{n.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {n.due_date}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


