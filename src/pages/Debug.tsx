import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PingResult = {
  step: string;
  ok: boolean;
  info?: string;
  error?: string;
};

export default function Debug() {
  const [results, setResults] = useState<PingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const runChecks = async () => {
      const r: PingResult[] = [];
      try {
        r.push({ step: "env:VITE_SUPABASE_URL", ok: !!import.meta.env.VITE_SUPABASE_URL, info: String(import.meta.env.VITE_SUPABASE_URL || "<missing>") });
        r.push({ step: "env:VITE_SUPABASE_ANON_KEY", ok: !!import.meta.env.VITE_SUPABASE_ANON_KEY, info: import.meta.env.VITE_SUPABASE_ANON_KEY ? "<present>" : "<missing>" });

        const { data: ver, error: verErr } = await supabase.from("property_cards").select("id").limit(1);
        if (verErr) {
          r.push({ step: "db:select property_cards", ok: false, error: verErr.message });
        } else {
          r.push({ step: "db:select property_cards", ok: true, info: `${ver?.length || 0} rows accessible` });
        }

        const session = (await supabase.auth.getSession()).data.session;
        r.push({ step: "auth:session", ok: !!session, info: session ? `user ${session.user.id}` : "no session" });

        // Attempt an insert in a safe throwaway way using a ROLLBACK-able transaction surrogate: we just try and then delete if successful
        const testPayload = {
          entity_name: "Debug Entity",
          fund_cluster: "101",
          semi_expendable_property: "Debug Item",
          property_number: `DBG-${Date.now()}`,
          description: "Debug connectivity",
          date_acquired: new Date().toISOString().slice(0, 10),
          remarks: "debug",
        };

        const insertRes = await supabase.from("property_cards").insert(testPayload).select("id").single();
        if (insertRes.error) {
          r.push({ step: "db:insert property_cards", ok: false, error: insertRes.error.message });
        } else {
          r.push({ step: "db:insert property_cards", ok: true, info: `id ${insertRes.data.id}` });
          // cleanup
          await supabase.from("property_cards").delete().eq("id", insertRes.data.id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        r.push({ step: "unexpected", ok: false, error: msg });
      } finally {
        setResults(r);
        setLoading(false);
      }
  };

  useEffect(() => {
    runChecks();
  }, []);

  const handleSignIn = async () => {
    setAuthMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthMsg(error ? error.message : "Signed in");
    await runChecks();
  };

  const handleSignOut = async () => {
    setAuthMsg(null);
    setLoading(true);
    await supabase.auth.signOut();
    setAuthMsg("Signed out");
    await runChecks();
  };

  const batchDeleteAll = async (table: string) => {
    const batchSize = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .range(offset, offset + batchSize - 1);
      if (error) throw error;
      const ids = (data || []).map((r: { id: string }) => r.id);
      if (!ids.length) break;
      const del = await supabase.from(table).delete().in('id', ids);
      if (del.error) throw del.error;
      if (ids.length < batchSize) break;
      offset += batchSize;
    }
  };

  const resetTransfers = async () => {
    setResetMsg(null);
    setResetBusy(true);
    try {
      await batchDeleteAll('transfer_items');
      await batchDeleteAll('property_transfers');
      setResetMsg("Transfers reset completed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResetMsg(msg);
    } finally {
      setResetBusy(false);
    }
  };

  const resetPropertyCards = async () => {
    setResetMsg(null);
    setResetBusy(true);
    try {
      await batchDeleteAll('property_card_entries');
      await batchDeleteAll('property_cards');
      setResetMsg("Property cards reset completed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResetMsg(msg);
    } finally {
      setResetBusy(false);
    }
  };

  const resetInventorySafe = async () => {
    setResetMsg(null);
    setResetBusy(true);
    try {
      const { data: referenced } = await supabase
        .from("custodian_slip_items")
        .select("inventory_item_id")
        .not("inventory_item_id", "is", null);
      const refRows = (referenced ?? []) as { inventory_item_id: string | null }[];
      const referencedIds = Array.from(new Set(refRows.map((x) => x.inventory_item_id))).filter((id): id is string => !!id);

      if (referencedIds.length > 0) {
        const delUnref = await supabase
          .from("inventory_items")
          .delete()
          .not("id", "in", referencedIds);
        if (delUnref.error && delUnref.error.code !== "PGRST204") throw delUnref.error;
      } else {
        await batchDeleteAll('inventory_items');
      }

      if (referencedIds.length > 0) {
        const updRef = await supabase
          .from("inventory_items")
          .update({
            custodian: null,
            custodian_position: null,
            assignment_status: "Available",
            assigned_date: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", referencedIds);
        if (updRef.error && updRef.error.code !== "PGRST204") throw updRef.error;
      }

      setResetMsg("Inventory reset completed (safe mode)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResetMsg(msg);
    } finally {
      setResetBusy(false);
    }
  };

  const resetAll = async () => {
    setResetMsg(null);
    setResetBusy(true);
    try {
      await batchDeleteAll('property_card_entries');
      await batchDeleteAll('property_cards');
      await batchDeleteAll('transfer_items');
      await batchDeleteAll('property_transfers');

      const { data: referenced } = await supabase
        .from("custodian_slip_items")
        .select("inventory_item_id")
        .not("inventory_item_id", "is", null);
      const refRows = (referenced ?? []) as { inventory_item_id: string | null }[];
      const referencedIds = Array.from(new Set(refRows.map((x) => x.inventory_item_id))).filter((id): id is string => !!id);

      if (referencedIds.length > 0) {
        const delUnref = await supabase
          .from("inventory_items")
          .delete()
          .not("id", "in", referencedIds);
        if (delUnref.error && delUnref.error.code !== "PGRST204") throw delUnref.error;
      } else {
        await batchDeleteAll('inventory_items');
      }

      if (referencedIds.length > 0) {
        const updRef = await supabase
          .from("inventory_items")
          .update({
            custodian: null,
            custodian_position: null,
            assignment_status: "Available",
            assigned_date: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", referencedIds);
        if (updRef.error && updRef.error.code !== "PGRST204") throw updRef.error;
      }

      setResetMsg("All resets completed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResetMsg(msg);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Supabase Debug</h1>
      <div className="text-sm text-muted-foreground">Visit this page to verify environment, connectivity, auth session, and RLS inserts.</div>
      <div className="rounded border p-4 space-y-3">
        <div className="font-medium">Auth test</div>
        <div className="flex gap-2 flex-wrap items-center">
          <input className="border rounded px-2 py-1" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="border rounded px-2 py-1" placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button className="border rounded px-3 py-1" onClick={handleSignIn}>Sign in</button>
          <button className="border rounded px-3 py-1" onClick={handleSignOut}>Sign out</button>
        </div>
        {authMsg && <div className="text-xs text-muted-foreground">{authMsg}</div>}
      </div>
      <div className="rounded border p-4 space-y-3">
        <div className="font-medium">Reset data</div>
        <div className="text-xs text-muted-foreground">Destructive actions. Ensure correct environment.</div>
        <div className="flex flex-wrap gap-2">
          <button className="border rounded px-3 py-1 bg-red-600 text-white" disabled={resetBusy} onClick={resetTransfers}>Clean Transfers</button>
          <button className="border rounded px-3 py-1 bg-red-600 text-white" disabled={resetBusy} onClick={resetPropertyCards}>Clean Property Cards</button>
          <button className="border rounded px-3 py-1 bg-red-600 text-white" disabled={resetBusy} onClick={resetInventorySafe}>Clean Inventory (safe)</button>
          <button className="border rounded px-3 py-1 bg-red-700 text-white" disabled={resetBusy} onClick={resetAll}>Clean All</button>
        </div>
        {resetMsg && <div className="text-xs text-muted-foreground">{resetMsg}</div>}
      </div>
      {loading ? (
        <div>Running checks…</div>
      ) : (
        <div className="space-y-2">
          {results.map((x, idx) => (
            <div key={idx} className={`rounded border p-3 ${x.ok ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"}`}>
              <div className="font-medium">{x.step}</div>
              {x.info && <div className="text-xs mt-1">{x.info}</div>}
              {x.error && <div className="text-xs mt-1 text-red-600">{x.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


