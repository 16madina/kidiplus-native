// Crée (ou reprend) le compte Stripe Connect d'un vendeur KiDi+ avec
// préremplissage, puis renvoie l'account link.
//
// Le client envoie { businessType: "individual" | "company" }.
// Un champ prérempli n'est plus redemandé par Stripe.

import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const SITE = "https://kidiplus.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;
    const authEmail = userData.user.email ?? undefined;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const businessType: "individual" | "company" =
      body.businessType === "company" ? "company" : "individual";
    const returnUrl = httpsOrFallback(body.returnUrl, `${SITE}/vendeur/stripe/retour`);
    const refreshUrl = httpsOrFallback(body.refreshUrl, `${SITE}/vendeur/stripe/refresh`);

    const profile = await loadProfile(supabase, userId);
    const handle = typeof profile?.handle === "string" ? profile.handle.trim() : "";
    if (!handle) {
      return json(
        {
          error: "handle_missing",
          message: "Choisis le nom de ta boutique avant de connecter Stripe.",
        },
        400,
      );
    }

    const storeUrl = `${SITE}/@${handle.replace(/^@/, "")}`;
    const email =
      (typeof profile?.email === "string" && profile.email.trim()) || authEmail;
    const displayName = typeof profile?.display_name === "string" ? profile.display_name : "";
    const names = splitName(
      typeof profile?.first_name === "string" ? profile.first_name : "",
      typeof profile?.last_name === "string" ? profile.last_name : "",
      displayName,
    );
    const country = twoLetterCountry(body.country) ||
      twoLetterCountry(profile?.country) ||
      "FR";

    let accountId =
      (typeof profile?.stripe_account_id === "string" && profile.stripe_account_id) ||
      (typeof profile?.stripe_connect_id === "string" && profile.stripe_connect_id) ||
      null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country,
        email,
        business_type: businessType,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          url: storeUrl,
          product_description: buildDescription({
            category: typeof profile?.category === "string" ? profile.category : null,
            display_name: displayName,
          }),
          support_email: email,
          support_url: storeUrl,
          mcc: "5399",
        },
        ...(businessType === "individual"
          ? {
              individual: {
                first_name: names.first || undefined,
                last_name: names.last || undefined,
                email,
                phone: typeof profile?.phone === "string" ? profile.phone : undefined,
              },
            }
          : {
              company: { name: displayName || undefined },
            }),
        metadata: { kidi_user_id: userId, kidi_handle: handle },
      });

      accountId = account.id;

      if (businessType === "company") {
        await stripe.accounts.createPerson(accountId, {
          first_name: names.first || undefined,
          last_name: names.last || undefined,
          email,
          phone: typeof profile?.phone === "string" ? profile.phone : undefined,
          relationship: {
            representative: true,
            owner: true,
            title: "Propriétaire",
          },
        });
      }

      await supabase
        .from("profiles")
        .update({
          stripe_account_id: accountId,
          stripe_connect_id: accountId,
          stripe_business_type: businessType,
        })
        .eq("id", userId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
      collection_options: { fields: "eventually_due" },
    });

    return json({ ok: true, url: link.url, account_id: accountId });
  } catch (e) {
    console.error("connect-onboard", e);
    return json({ error: "server_error", message: String(e) }, 500);
  }
});

async function loadProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const full =
    "id, handle, display_name, first_name, last_name, email, phone, country, category, stripe_account_id, stripe_connect_id";
  const safe =
    "id, handle, display_name, phone, country, stripe_account_id, stripe_connect_id";
  const first = await supabase.from("profiles").select(full).eq("id", userId).maybeSingle();
  if (!first.error && first.data) return first.data as Record<string, unknown>;
  const second = await supabase.from("profiles").select(safe).eq("id", userId).maybeSingle();
  return (second.data as Record<string, unknown> | null) ?? null;
}

function httpsOrFallback(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.startsWith("https://") ? raw : fallback;
}

function twoLetterCountry(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

function splitName(first: string, last: string, display: string): { first: string; last: string } {
  if (first.trim() || last.trim()) return { first: first.trim(), last: last.trim() };
  const parts = display.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function buildDescription(p: { category?: string | null; display_name?: string | null }) {
  const cat = p.category?.trim();
  const nom = p.display_name?.trim() ?? "Ce vendeur";
  return cat
    ? `${nom} vend des produits de la catégorie ${cat} en direct sur la marketplace KiDi+.`
    : `${nom} vend des produits en direct sur la marketplace KiDi+ (live shopping).`;
}

function cors(res: Response) {
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
  return new Response(res.body, { status: res.status, headers });
}

function json(body: unknown, status = 200) {
  return cors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}
