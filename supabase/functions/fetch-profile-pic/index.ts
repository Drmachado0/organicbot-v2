import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: validate JWT and extract user ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { ig_account_id, username } = await req.json();
    if (!ig_account_id || !username) {
      return new Response(JSON.stringify({ error: "ig_account_id and username required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Ownership check: verify user owns this ig_account ──
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: account } = await supabaseAdmin
      .from("ig_accounts")
      .select("id")
      .eq("id", ig_account_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ error: "Account not found or not owned by user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try multiple methods to fetch profile pic
    let profilePicUrl: string | null = null;

    // Method 1: i.instagram.com mobile API (less restrictive)
    try {
      const igRes1 = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
        headers: {
          "User-Agent": "Instagram 275.0.0.27.98 Android (33/13; 420dpi; 1080x2400; samsung; SM-G991B; o1s; exynos2100)",
          "X-IG-App-ID": "936619743392459",
        },
      });
      console.log("Method 1 (i.instagram.com mobile):", igRes1.status);
      if (igRes1.ok) {
        const d1 = await igRes1.json();
        profilePicUrl = d1?.data?.user?.profile_pic_url_hd || d1?.data?.user?.profile_pic_url || null;
      }
    } catch (e) { console.log("Method 1 error:", e); }

    // Method 2: Scrape HTML page with Googlebot UA for og:image
    if (!profilePicUrl) {
      try {
        const igRes2 = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        });
        console.log("Method 2 (Googlebot HTML):", igRes2.status);
        if (igRes2.ok) {
          const html = await igRes2.text();
          // Try og:image
          const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i) 
            || html.match(/content="([^"]+)"\s+(?:property|name)="og:image"/i);
          if (ogMatch?.[1]) {
            profilePicUrl = ogMatch[1].replace(/&amp;/g, "&");
          }
          // Try profile_pic_url in embedded JSON
          if (!profilePicUrl) {
            const jsonMatch = html.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/);
            if (jsonMatch?.[1]) {
              profilePicUrl = jsonMatch[1].replace(/\\u0026/g, "&");
            }
          }
          if (!profilePicUrl) {
            const jsonMatch2 = html.match(/"profile_pic_url"\s*:\s*"([^"]+)"/);
            if (jsonMatch2?.[1]) {
              profilePicUrl = jsonMatch2[1].replace(/\\u0026/g, "&");
            }
          }
        }
      } catch (e) { console.log("Method 2 error:", e); }
    }

    // Method 3: Try www endpoint with browser UA
    if (!profilePicUrl) {
      try {
        const igRes3 = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "*/*",
          },
        });
        console.log("Method 3 (www API):", igRes3.status);
        if (igRes3.ok) {
          const d3 = await igRes3.json();
          profilePicUrl = d3?.data?.user?.profile_pic_url_hd || d3?.data?.user?.profile_pic_url || null;
        }
      } catch (e) { console.log("Method 3 error:", e); }
    }

    console.log("Final profilePicUrl:", profilePicUrl ? "found" : "null");

    if (!profilePicUrl) {
      return new Response(JSON.stringify({ error: "Could not extract profile pic URL from any method. Instagram may be blocking server requests." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the database
    const { error } = await supabaseAdmin
      .from("ig_accounts")
      .update({ profile_pic_url: profilePicUrl })
      .eq("id", ig_account_id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, profile_pic_url: profilePicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
