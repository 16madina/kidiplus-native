// Stripe exige un return_url HTTPS. kidiplus.com/vendeur/stripe/* n'existe pas (404).
// Cette page renvoie dans l'app via kidiplus://connect-return.

const APP_LINK = "kidiplus://connect-return";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }
  const url = new URL(req.url);
  const refresh = url.searchParams.get("next") === "refresh";
  const title = refresh ? "Lien Stripe expiré" : "Compte Stripe enregistré";
  const lead = refresh
    ? "Le lien a expiré. Rouvre KiDi+ pour reprendre."
    : "C'est bon. On te ramène dans KiDi+.";
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${APP_LINK}" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0B1220; color: #F8FAFC; margin: 0;
      min-height: 100vh; display: grid; place-items: center; padding: 24px; text-align: center; }
    a { display: inline-block; margin-top: 20px; background: #E8C36A; color: #1A1408;
      text-decoration: none; font-weight: 800; padding: 14px 22px; border-radius: 16px; }
    p { line-height: 1.45; color: #CBD5E1; }
  </style>
  <script>location.replace(${JSON.stringify(APP_LINK)});</script>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${lead}</p>
    <a href="${APP_LINK}">Ouvrir KiDi+</a>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
