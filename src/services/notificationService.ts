import { supabase } from "@/lib/supabase";

export type SystemNotificationType = "warranty_expiring" | "lifespan_expiring";

export type SystemNotification = {
  id: string;
  type: SystemNotificationType;
  inventory_item_id: string | null;
  inventory_items?: {
    property_number: string;
    description: string | null;
  } | null;
  title: string;
  message: string;
  due_date: string;
  read_at: string | null;
  emailed_at: string | null;
  created_at: string;
};

export const notificationService = {
  async listUnread(limit = 10): Promise<SystemNotification[]> {
    const { data, error } = await supabase
      .from("system_notifications")
      .select("*, inventory_items(property_number, description)")
      .is("read_at", null)
      .order("due_date", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []) as SystemNotification[];
  },

  async listRecent(limit = 20): Promise<SystemNotification[]> {
    const { data, error } = await supabase
      .from("system_notifications")
      .select("*, inventory_items(property_number, description)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as SystemNotification[];
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from("system_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async markAllRead(): Promise<void> {
    const { error } = await supabase
      .from("system_notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) throw error;
  },

  async generate(daysBefore = 60): Promise<number> {
    const { data, error } = await supabase.rpc("generate_lifecycle_notifications", {
      days_before: daysBefore,
    });
    if (error) throw error;
    return Number(data || 0);
  },

  async sendEmails(): Promise<{ sent: number }> {
    // Requires a deployed Supabase Edge Function: send-lifecycle-notifications
    const { data, error } = await supabase.functions.invoke("send-lifecycle-notifications", {
      body: {},
    });
    if (error) throw error;
    return (data || { sent: 0 }) as { sent: number };
  },
};


