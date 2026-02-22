import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface BotStatusSummary {
  online: number;
  offline: number;
  total: number;
}

export function useBotStatus(user: User | null): BotStatusSummary {
  const [statusMap, setStatusMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;

    // Seed initial states
    supabase
      .from("ig_accounts")
      .select("id, last_heartbeat")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        (data ?? []).forEach((acc) => {
          const diff = acc.last_heartbeat ? Date.now() - new Date(acc.last_heartbeat).getTime() : Infinity;
          map[acc.id] = diff < 6 * 60 * 1000;
        });
        setStatusMap(map);
      });

    // Realtime updates
    const channel = supabase
      .channel(`bot-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ig_accounts",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { id: string; last_heartbeat: string | null; is_active: boolean | null };
          if (row.is_active === false) {
            setStatusMap((prev) => {
              const next = { ...prev };
              delete next[row.id];
              return next;
            });
          } else {
            const diff = row.last_heartbeat ? Date.now() - new Date(row.last_heartbeat).getTime() : Infinity;
            setStatusMap((prev) => ({ ...prev, [row.id]: diff < 6 * 60 * 1000 }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const values = Object.values(statusMap);
  const online = values.filter(Boolean).length;
  return { online, offline: values.length - online, total: values.length };
}
