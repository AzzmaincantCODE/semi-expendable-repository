// Supabase Edge Function: send-lifecycle-notifications
// Sends email notifications for unread system_notifications that have not been emailed yet.
//
// Required secrets (Supabase Dashboard → Project Settings → Functions → Secrets):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - RESEND_API_KEY
// - NOTIFICATION_EMAIL_TO (comma-separated list)
// - NOTIFICATION_EMAIL_FROM (e.g. "Semi-Expendable Inventory <no-reply@yourdomain.com>")

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2";

type DbNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  due_date: string;
  inventory_item_id: string | null;
  inventory_items?: { property_number: string; description: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const NOTIFICATION_EMAIL_TO = Deno.env.get("NOTIFICATION_EMAIL_TO");
  const NOTIFICATION_EMAIL_FROM = Deno.env.get("NOTIFICATION_EMAIL_FROM");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase env", { status: 500 });
  }
  if (!RESEND_API_KEY || !NOTIFICATION_EMAIL_TO || !NOTIFICATION_EMAIL_FROM) {
    return new Response("Missing email env (RESEND_API_KEY / NOTIFICATION_EMAIL_TO / NOTIFICATION_EMAIL_FROM)", {
      status: 500,
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const resend = new Resend(RESEND_API_KEY);

  // Pull up to 50 notifications that haven't been emailed yet.
  const { data: notifications, error } = await supabase
    .from("system_notifications")
    .select("id, type, title, message, due_date, inventory_item_id, inventory_items(property_number, description)")
    .is("emailed_at", null)
    .order("due_date", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const to = NOTIFICATION_EMAIL_TO.split(",").map((s) => s.trim()).filter(Boolean);
  if (to.length === 0) {
    return new Response("NOTIFICATION_EMAIL_TO is empty", { status: 500 });
  }

  const rows = (notifications || []) as DbNotification[];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.4;">
      <h2>Lifecycle Notifications</h2>
      <p>Items with upcoming warranty/lifespan dates:</p>
      <ul>
        ${rows
          .map((n) => {
            const prop = n.inventory_items?.property_number || n.inventory_item_id || "Unknown item";
            const due = n.due_date;
            return `<li><strong>${n.title}</strong> — ${prop} — due ${due}<br/><span style="color:#555">${n.message}</span></li>`;
          })
          .join("")}
      </ul>
    </div>
  `;

  const emailResp = await resend.emails.send({
    from: NOTIFICATION_EMAIL_FROM,
    to,
    subject: `Semi-Expendable Inventory: ${rows.length} notification(s)`,
    html,
  });

  if (emailResp.error) {
    return new Response(JSON.stringify({ error: emailResp.error.message }), { status: 502 });
  }

  // Mark emailed_at for these rows
  const ids = rows.map((r) => r.id);
  const { error: updateError } = await supabase
    .from("system_notifications")
    .update({ emailed_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    return new Response(JSON.stringify({ sent: rows.length, warning: updateError.message }), { status: 200 });
  }

  return new Response(JSON.stringify({ sent: rows.length }), { status: 200 });
});


