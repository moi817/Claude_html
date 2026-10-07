// SC//OS – robot d'alertes 24 h/24 (exécuté par GitHub Actions, voir workflows/sc-alerts.yml).
// Node 20+, aucune dépendance. Lit les réglages du tableau de bord dans le Gist de synchronisation
// (SC_DATA_URL) puis envoie des notifications ntfy pour : nouvelles promos RSI, nouveaux patchs,
// seuils de prix UEX. La déduplication s'appuie sur l'historique ntfy des 12 dernières heures
// (identifiants de séquence), donc le robot n'a besoin d'aucun état ni d'aucune écriture dans le dépôt.
//
// Variables d'environnement : SC_DATA_URL (obligatoire) · SC_APP_URL (lien cliquable, facultatif)
// Options : --dry-run (n'envoie rien, affiche ce qui serait envoyé)
// Surcharges de test : SC_WIKI_URL, SC_UEX_PRICES_URL, SC_ALLOW_HTTP=1, SC_MAX_AGE_H

const DRY = process.argv.includes('--dry-run') || process.env.SC_DRY === '1';
const DATA_URL = process.env.SC_DATA_URL;
const WIKI_URL = process.env.SC_WIKI_URL || 'https://api.star-citizen.wiki/api/v2/comm-links?page%5Bsize%5D=40';
const UEX_PRICES_URL = process.env.SC_UEX_PRICES_URL || 'https://api.uexcorp.uk/2.0/commodities_prices_all';
const MAX_AGE_H = Number(process.env.SC_MAX_AGE_H) || 8;     // ne signale que les annonces des 8 dernières heures
const APP_URL = process.env.SC_APP_URL || '';

const log = (...a) => console.log(...a);
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const ascii = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '?').slice(0, 250);

async function getJson(url, { tries = 3 } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'user-agent': 'sc-os-alerts' } });
      if (r.ok) return await r.json();
      err = new Error(`HTTP ${r.status} sur ${url.split('?')[0]}`);
    } catch (e) { err = e; }
    await new Promise(ok => setTimeout(ok, 1500 * (i + 1)));
  }
  throw err;
}

// Même classification que l'application (index.html)
const classify = t =>
  /subscriber promo|deals?\b|\bsale\b|warbond|referral|twitch drops|free fly|festival|pirate week|alien week|defensecon|invictus|\biae\b|citizencon|anniversary|ship showdown|concept sale|bonus/i.test(t) ? 'promo'
  : /alpha \d|release info|patch|ptu|tech preview/i.test(t) ? 'patch' : 'news';

async function main() {
  if (!DATA_URL) { log('SC_DATA_URL non défini : rien à faire.'); return 0; }
  const sep = DATA_URL.includes('?') ? '&' : '?';
  const data = await getJson(`${DATA_URL}${sep}t=${Date.now()}`);

  const nt = data.ntfy;
  if (!nt || !nt.on || !nt.topic) { log('Notifications téléphone désactivées dans l\'application : rien à faire.'); return 0; }
  const server = String(nt.server || 'https://ntfy.sh').replace(/\/+$/, '');
  const okScheme = process.env.SC_ALLOW_HTTP === '1' ? /^https?:\/\//i : /^https:\/\//i;
  if (!okScheme.test(server)) throw new Error('Serveur ntfy invalide (https requis).');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(nt.topic)) throw new Error('Nom de sujet ntfy invalide.');
  const base = `${server}/${encodeURIComponent(nt.topic)}`;

  const al = data.alerts || {};
  const wantPromos = al.promos !== false, wantPatches = al.patches !== false;
  const rules = Array.isArray(al.prices) ? al.prices.filter(r => r && r.id && r.value > 0 && (r.dir === 'above' || r.dir === 'below')) : [];
  log(`Réglages : promos=${wantPromos} patchs=${wantPatches} règles de prix=${rules.length}`);

  // --- déjà envoyé dans les 12 dernières heures ? (déduplication via ntfy)
  const seen = new Set();
  try {
    const r = await fetch(`${base}/json?poll=1&since=12h`, { signal: AbortSignal.timeout(20000) });
    if (r.ok) for (const line of (await r.text()).split('\n')) {
      if (!line.trim()) continue;
      const m = JSON.parse(line);
      if (m.event === 'message' && m.sequence_id) seen.add(m.sequence_id);
      if (m.event === 'message_delete' && m.sequence_id) seen.delete(m.sequence_id);
    }
  } catch (e) { log('Historique ntfy indisponible (déduplication limitée) :', e.message); }

  const queue = [];

  // --- promos et patchs (Comm-Link RSI via le Wiki)
  if (wantPromos || wantPatches) {
    try {
      const j = await getJson(WIKI_URL);
      const ids = new Set();
      for (const c of j.data || []) {
        if (ids.has(c.id) || /^[A-Z0-9]+(-[A-Za-z0-9]+)+$/.test(c.title)) continue;
        ids.add(c.id);
        const ageH = (Date.now() - new Date(c.created_at)) / 36e5;
        if (!(ageH <= MAX_AGE_H)) continue;
        const cat = classify(c.title);
        const click = /^https:\/\//.test(c.rsi_url || '') ? c.rsi_url : '';
        if (cat === 'promo' && wantPromos) queue.push({ seq: `sc-promo-${c.id}`, title: 'Promo RSI', body: c.title, tags: 'tada', click });
        if (cat === 'patch' && wantPatches) queue.push({ seq: `sc-patch-${c.id}`, title: 'Patch Star Citizen', body: c.title, tags: 'rocket', click });
      }
    } catch (e) { log('Comm-Link indisponible :', e.message); }
  }

  // --- seuils de prix (UEX)
  if (rules.length) {
    try {
      const j = await getJson(UEX_PRICES_URL);
      const best = new Map();
      for (const p of j.data || []) {
        if (!(p.price_sell > 0)) continue;
        const b = best.get(p.id_commodity);
        if (!b || p.price_sell > b.price) best.set(p.id_commodity, { price: p.price_sell, terminal: p.terminal_name });
      }
      for (const r of rules) {
        const b = best.get(Number(r.id));
        if (!b) { log(`Prix introuvable pour « ${r.name || r.id} »`); continue; }
        const hit = r.dir === 'above' ? b.price >= r.value : b.price <= r.value;
        log(`Prix ${r.name || r.id} : ${fmt(b.price)} (${r.dir === 'above' ? '>=' : '<='} ${fmt(r.value)}) → ${hit ? 'ALERTE' : 'ok'}`);
        if (hit) queue.push({
          seq: `sc-price-${r.id}-${r.dir}-${Math.round(r.value)}`,
          title: `Prix ${r.name || r.id}`,
          body: `${r.name || r.id} : ${fmt(b.price)} aUEC/SCU (${r.dir === 'above' ? 'au-dessus de' : 'sous'} ${fmt(r.value)}) · ${b.terminal}`,
          tags: 'moneybag', priority: 4, click: APP_URL
        });
      }
    } catch (e) { log('Prix UEX indisponibles :', e.message); }
  }

  // --- envoi
  let sent = 0, skipped = 0, failed = 0;
  for (const n of queue) {
    if (seen.has(n.seq)) { skipped++; continue; }
    if (DRY) { log(`[dry-run] ${n.seq} → ${n.title} : ${n.body}`); sent++; continue; }
    const headers = { Title: ascii(n.title), Tags: n.tags };
    if (n.priority) headers.Priority = String(n.priority);
    if (n.click && /^https:\/\//.test(n.click)) headers.Click = n.click;
    try {
      const r = await fetch(`${base}/${encodeURIComponent(n.seq)}`, { method: 'POST', body: n.body, headers, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      sent++; log(`Envoyé : ${n.seq}`);
    } catch (e) { failed++; log(`Échec d'envoi ${n.seq} :`, e.message); }
  }
  log(`Terminé : ${sent} envoyée(s), ${skipped} déjà envoyée(s) il y a moins de 12 h, ${failed} échec(s).`);
  return failed ? 1 : 0;
}

main().then(c => process.exit(c), e => { console.error('Erreur :', e.message); process.exit(1); });
