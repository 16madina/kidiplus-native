// Stripe exige un return_url HTTPS. On redirige tout de suite vers l'app.
// (Une page HTML brute s'affichait parfois : on privilegie le 302.)

const APP_LINK = "kidiplus://connect-return";

function page(refresh: boolean): string {
  const title = refresh ? "Lien Stripe expire" : "Compte Stripe enregistre";
  const lead = refresh
    ? "Le lien a expire. Touche le bouton pour revenir dans KiDi+."
    : "C'est bon. Touche le bouton pour revenir dans KiDi+.";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body{font-family:-apple-system,system-ui,sans-serif;background:#0B1220;color:#F8FAFC;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center}
a{display:inline-block;margin-top:20px;background:#E8C36A;color:#1A1408;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:16px}
p{line-height:1.45;color:#CBD5E1}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${lead}</p>
<p><a href="${APP_LINK}">Ouvrir KiDi+</a></p>
</main>
<script>window.location.href=${JSON.stringify(APP_LINK)};</script>
</body>
</html>`;
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  const refresh = new URL(req.url).searchParams.get("next") === "refresh";
  const html = page(refresh);
  const bytes = new TextEncoder().encode(html);
  return new Response(bytes, {
    status: 302,
    headers: {
      Location: APP_LINK,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
