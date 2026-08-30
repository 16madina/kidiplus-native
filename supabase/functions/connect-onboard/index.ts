// Crée (ou reprend) le compte Stripe Connect d'un vendeur KiDi+ avec
// préremplissage, puis renvoie l'account link.
//
// Le client envoie { businessType: "individual" | "company" }.
// Un champ prérempli n'est plus redemandé par Stripe.

import Stripe from "https://esm.sh/stripe@16.8.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { stripeClient } from "../_shared/stripe.ts";
import { isXofCurrency, pickConnectCountry } from "../_shared/connect-country.ts";
import { connectClearPatch, connectPendingPatch } from "../_shared/connect-profile.ts";

const stripe = stripeClient();

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
    const bounce = `${Deno.env.get("SUPABASE_URL") ?? SITE}/functions/v1/connect-bounce`;
    const returnUrl = bounceUrl(body.returnUrl, `${bounce}?next=return`);
    const refreshUrl = bounceUrl(body.refreshUrl, `${bounce}?next=refresh`);

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
    if (isXofCurrency(body.currency)) {
      return json(
        {
          error: "connect_currency_unsupported",
          message: "Stripe Connect n'est pas disponible en FCFA.",
        },
        400,
      );
    }

    const country = pickConnectCountry(
      body.country,
      profile?.country,
      body.currency,
    );

    let accountId = await usableAccountId(
      supabase,
      userId,
      (typeof profile?.stripe_account_id === "string" && profile.stripe_account_id) ||
        (typeof profile?.stripe_connect_id === "string" && profile.stripe_connect_id) ||
        null,
    );

    if (!accountId) {
      accountId = await createExpressAccount({
        supabase,
        userId,
        handle,
        storeUrl,
        email,
        displayName,
        names,
        country,
        businessType,
        category: typeof profile?.category === "string" ? profile.category : null,
      });
    }

    let link: Stripe.AccountLink;
    try {
      link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
        collection_options: { fields: "eventually_due" },
      });
    } catch (linkErr) {
      if (!isStaleAccountError(linkErr)) throw linkErr;
      await clearStaleAccount(supabase, userId);
      accountId = await createExpressAccount({
        supabase,
        userId,
        handle,
        storeUrl,
        email,
        displayName,
        names,
        country,
        businessType,
        category: typeof profile?.category === "string" ? profile.category : null,
      });
      link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
        collection_options: { fields: "eventually_due" },
      });
    }

    return json({ ok: true, url: link.url, account_id: accountId, country });
  } catch (e) {
    console.error("connect-onboard", e);
    const message = String(e);
    const lower = message.toLowerCase();
    if (lower.includes("country")) {
      return json({ error: "connect_country_unsupported", message }, 400);
    }
    return json({ error: "server_error", message }, 500);
  }
});

function isStaleAccountError(e: unknown): boolean {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
  return (
    msg.includes("not connected to your platform") ||
    msg.includes("no such account") ||
    msg.includes("resource_missing") ||
    (msg.includes("account") && msg.includes("does not exist"))
  );
}

async function clearStaleAccount(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  await supabase.from("profiles").update(connectClearPatch()).eq("id", userId);
}

async function usableAccountId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  stored: string | null,
): Promise<string | null> {
  if (!stored) return null;
  try {
    await stripe.accounts.retrieve(stored);
    return stored;
  } catch (e) {
    if (isStaleAccountError(e)) {
      await clearStaleAccount(supabase, userId);
      return null;
    }
    throw e;
  }
}

async function createExpressAccount(input: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  handle: string;
  storeUrl: string;
  email: string | undefined;
  displayName: string;
  names: { first: string; last: string };
  country: string;
  businessType: "individual" | "company";
  category?: string | null;
}): Promise<string> {
  const account = await stripe.accounts.create({
    type: "express",
    country: input.country,
    email: input.email,
    business_type: input.businessType,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      url: input.storeUrl,
      product_description: buildDescription({
        category: input.category ?? null,
        display_name: input.displayName,
      }),
      support_email: input.email,
      support_url: input.storeUrl,
      mcc: "5399",
    },
    ...(input.businessType === "individual"
      ? {
          individual: {
            first_name: input.names.first || undefined,
            last_name: input.names.last || undefined,
            email: input.email,
          },
        }
      : {
          company: { name: input.displayName || undefined },
        }),
    metadata: { kidi_user_id: input.userId, kidi_handle: input.handle },
  });

  if (input.businessType === "company") {
    await stripe.accounts.createPerson(account.id, {
      first_name: input.names.first || undefined,
      last_name: input.names.last || undefined,
      email: input.email,
      relationship: {
        representative: true,
        owner: true,
        title: "Propriétaire",
      },
    });
  }

  await input.supabase
    .from("profiles")
    .update({
      ...connectPendingPatch(account.id),
      stripe_business_type: input.businessType,
    })
    .eq("id", input.userId);

  return account.id;
}

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

function bounceUrl(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.startsWith("https://") && raw.includes("connect-bounce")
    ? raw
    : fallback;
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
