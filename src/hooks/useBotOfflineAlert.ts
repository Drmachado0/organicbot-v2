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
      .select("id, ig_username, bot_online")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        (data ?? []).forEach((acc) => {
          prevOnline.current[acc.id] = acc.bot_online ?? false;
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
            bot_online: boolean | null;
          };

          const wasOnline = prevOnline.current[row.id] ?? false;
          const isNowOffline = !row.bot_online;

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

          // Update tracked state
          prevOnline.current[row.id] = row.bot_online ?? false;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
