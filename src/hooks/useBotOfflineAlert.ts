import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

/**
 * Subscribes to ig_accounts Realtime changes.
 * When bot_online flips to false, fires a toast with a link to /extension.
 */
export function useBotOfflineAlert(user: User | null) {
  // Track previous bot_online state per account to detect the transition true→false
  const prevOnline = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;

    // Seed initial states so we don't false-fire on first load
    supabase
      .from("ig_accounts")
      .select("id, ig_username, last_heartbeat")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        (data ?? []).forEach((acc) => {
          const diff = acc.last_heartbeat ? Date.now() - new Date(acc.last_heartbeat).getTime() : Infinity;
          prevOnline.current[acc.id] = diff < 10 * 60 * 1000;
        });
      });

    const channel = supabase
      .channel(`bot-offline-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ig_accounts",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            ig_username: string;
            last_heartbeat: string | null;
          };

          const wasOnline = prevOnline.current[row.id] ?? false;
          const diff = row.last_heartbeat ? Date.now() - new Date(row.last_heartbeat).getTime() : Infinity;
          const isNowOnline = diff < 10 * 60 * 1000;
          const isNowOffline = !isNowOnline;

          if (wasOnline && isNowOffline) {
            toast.warning(`@${row.ig_username} — Bot ficou offline`, {
              description: "A extensão parou de enviar heartbeat.",
              duration: 8000,
              action: {
                label: "Ver extensão →",
                onClick: () => {
                  window.location.href = "/extension";
                },
              },
            });
          }

          if (!wasOnline && isNowOnline) {
            toast.success(`@${row.ig_username} — Bot voltou online ✓`, {
              description: "A extensão está enviando heartbeat novamente.",
              duration: 5000,
            });
          }

          // Update tracked state
          prevOnline.current[row.id] = isNowOnline;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
