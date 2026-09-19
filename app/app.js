/* YueStudio — logique de l'interface (JavaScript vanilla, sans dépendance) */
'use strict';

// ---------------------------------------------------------------------------
// Petits utilitaires
// ---------------------------------------------------------------------------

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const STATE = {
  state: null,          // /api/state
  history: [],          // entrées d'historique
  view: 'create',
  search: '',
  favOnly: false,
  job: null,            // { id, timer, startedAt }
  polling: null,
  lastResult: null,
  status: null,         // { kind, text } : état du moteur, rafraîchi au changement de langue
};

function toast(message, kind = '', ms = 4200) {
  message = t(message);   // traduction centralisée : tous les messages passent ici
  const host = $('#toast-host');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(12px)';
    setTimeout(() => el.remove(), 320);
  }, ms);
}

async function api(path, options = {}) {
  const resp = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let data = null;
  try { data = await resp.json(); } catch { /* réponse non JSON */ }
  if (!resp.ok) {
    const message = (data && data.error && data.error.message) || `Erreur HTTP ${resp.status}`;
    const err = new Error(message);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function copyText(text, label = 'Texte') {
  if (!text) { toast('Rien à copier.', 'warn'); return; }
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('execCommand refusé');
    }
    toast(tf('{label} copié dans le presse-papiers.', { label }), 'ok', 2200);
  } catch (e) {
    // Repli ultime : on affiche le texte dans une boîte de dialogue, déjà sélectionné.
    try {
      window.prompt(t('Copie automatique indisponible — copiez avec Ctrl+C :'), text);
      toast('Sélectionnez le texte puis Ctrl+C.', 'warn', 6000);
    } catch {
      toast(tf('Copie impossible ({err}). Sélectionnez le texte manuellement.', { err: e.message }), 'err', 6000);
    }
  }
}

function fmtDuration(ms) {
  if (!ms || ms <= 0) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtBytes(n) {
  if (!n) return '—';
  const en = typeof I18N !== 'undefined' && I18N.lang === 'en';
  const ko = en ? 'KB' : 'Ko';
  const mo = en ? 'MB' : 'Mo';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} ${ko}`;
  return `${(n / (1024 * 1024)).toFixed(1)} ${mo}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtSeconds(s) {
  if (!s && s !== 0) return '—';
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(Math.round(s % 60)).padStart(2, '0')}`;
}

function audioUrl(name) {
  return `/audio/${encodeURIComponent(name)}`;
}

// ---------------------------------------------------------------------------
// État du moteur
// ---------------------------------------------------------------------------

const QUALITY_ORDER = ['q8', 'q4', 'bf16'];

async function loadState() {
  try {
    STATE.state = await api('/api/state');
  } catch (e) {
    STATE.state = null;
    setEngineStatus('err', 'serveur inaccessible');
    return;
  }
  const eng = STATE.state.engine || {};
  const models = STATE.state.models || {};
  const quals = models.qualities || {};

  if (!eng.installed) {
    setEngineStatus('err', 'moteur non installé');
  } else if (!eng.ready) {
    setEngineStatus('err', 'moteur arrêté');
  } else {
    const backend = (eng.backend || '?').toUpperCase();
    setEngineStatus('ok', 'prêt · {backend}', { backend });
  }

  renderQualityOptions();

  if (!models.sidecars_ok) {
    toast('Fichiers « sidecars » du modèle manquants : relancez 1-INSTALLER.bat.', 'warn', 9000);
  }
}

/** (Re)construit le sélecteur de qualité — rappelé lors d'un changement de langue. */
function renderQualityOptions() {
  const models = (STATE.state && STATE.state.models) || {};
  const quals = models.qualities || {};
  const sel = $('#f-quality');
  if (!sel) return;
  const previous = sel.value;
  sel.innerHTML = '';
  const ids = QUALITY_ORDER.filter((id) => quals[id]).concat(
    Object.keys(quals).filter((id) => !QUALITY_ORDER.includes(id))
  );
  ids.forEach((id) => {
    const q = quals[id];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = q.installed ? t(q.label) : tf('{label} — non téléchargé', { label: t(q.label) });
    opt.disabled = !q.installed;
    sel.appendChild(opt);
  });
  const stored = (() => { try { return localStorage.getItem('yuestudio.quality'); } catch { return null; } })();
  const wanted = (previous && quals[previous] && quals[previous].installed)
    ? previous
    : (stored && quals[stored] && quals[stored].installed)
      ? stored
      : (models.default_quality && quals[models.default_quality] && quals[models.default_quality].installed
        ? models.default_quality
        : ids.find((id) => quals[id].installed));
  if (wanted) sel.value = wanted;
  updateQualityHint();
}

function setEngineStatus(kind, text, vars) {
  // On stocke le texte NON traduit (+ ses variables) : c'est ce qui permet de le
  // re-traduire correctement quand l'utilisateur change de langue.
  STATE.status = { kind, text, vars: vars || null };
  const el = $('#engine-status');
  if (!el) return;
  el.className = `status status-${kind}`;
  $('.status-text', el).textContent = vars ? tf(text, vars) : t(text);
}

/** Rafraîchit les textes construits dynamiquement (appelé au changement de langue). */
function refreshDynamicStrings() {
  if (STATE.status) {
    const el = $('#engine-status');
    if (el) {
      $('.status-text', el).textContent = STATE.status.vars
        ? tf(STATE.status.text, STATE.status.vars)
        : t(STATE.status.text);
    }
  }
  if (typeof updateQualityHint === 'function') updateQualityHint();
  if (typeof updateMaxDurationHint === 'function') updateMaxDurationHint();
  if (typeof renderHistorySummary === 'function') renderHistorySummary();
  if (typeof renderStyleChips === 'function') renderStyleChips();
  if (typeof renderRanges === 'function') renderRanges();
  if (typeof renderQueue === 'function') renderQueue();
  const hint = document.getElementById('ai-hint');
  if (hint) {
    hint.textContent = t('Le prompt sera complété avec votre style et votre sujet.');
  }
}

/**
 * Plages réelles de chaque réglage : valeur par défaut, bornes acceptées par le
 * serveur (ou par le modèle) et plage conseillée. Les bornes affichées ici sont
 * celles vraiment appliquées côté serveur — pas des indications approximatives.
 */
const PARAM_RANGES = {
  seed: {
    def: 'aucune (aléatoire à chaque génération)',
    minMax: '0 – 4 611 686 018 427 387 904',
    ideal: 'toute valeur ; 🎲 pour la figer',
  },
  steps: {
    def: '8 (bon rendu, rapide)',
    minMax: '1 – 64',
    ideal: '8 – 16 (16 : plus fin, 2× plus lent)',
  },
  guidance: {
    def: '0 = le modèle décide',
    minMax: '0 – 20',
    ideal: '1.5 – 3 (au-delà : voix moins naturelle)',
  },
  maxduration: {
    def: 'aucune (la durée suit les paroles)',
    minMax: '0.2 – 6 min (50 – 9000 codes à 25/s)',
    ideal: '2 – 4 min pour une chanson',
  },
  temperature: {
    def: '1.0 côté modèle',
    minMax: '0.1 – 2',
    ideal: '0.8 – 1.0 (mots mieux articulés)',
  },
};

/** Fabrique le bloc « défaut · min–max · conseillé » d'un réglage. */
function makeRangeEl(nom) {
  const cfg = PARAM_RANGES[nom];
  const el = document.createElement('span');
  if (!cfg) return el;
  el.className = 'range';
  el.textContent = `${t('Par défaut')} ${t(cfg.def)}  ·  ${t('min–max')} ${t(cfg.minMax)}`
    + `  ·  ${t('conseillé')} ${t(cfg.ideal)}`;
  return el;
}

/** (Re)pose toutes les plages — rappelé au changement de langue. */
function renderRanges() {
  for (const nom of Object.keys(PARAM_RANGES)) {
    const cible = document.querySelector(`.range[data-range="${nom}"]`);
    if (!cible || !cible.parentElement) continue;
    const neuf = makeRangeEl(nom);
    neuf.dataset.range = nom;       // indispensable : sinon la plage est introuvable au prochain rendu
    cible.parentElement.replaceChild(neuf, cible);
  }
}

function updateMaxDurationHint() {
  const minutes = parseFloat($('#f-max-duration').value || '0');
  const hint = $('#max-duration-hint');
  const duree = minutes > 0
    ? tf('Plafond : {tokens} codes musicaux ({sec}). 6 min = maximum du modèle (9000 codes).',
        { tokens: Math.round(minutes * 60 * 25), sec: t('25 par seconde') })
    : t('Plafond dur : la chanson s\'arrête là même si les paroles continuent. 6 min = maximum du modèle (9000 codes).');
  hint.textContent = duree;
  hint.appendChild(document.createTextNode(' '));
  const plage = makeRangeEl('maxduration');
  plage.dataset.range = 'maxduration';
  hint.appendChild(plage);
}

function updateQualityHint() {
  const quals = (STATE.state && STATE.state.models && STATE.state.models.qualities) || {};
  const chosen = $('#f-quality').value;
  try { if (chosen) localStorage.setItem('yuestudio.quality', chosen); } catch { /* navigation privée */ }
  const q = quals[chosen];
  const hint = $('#quality-hint');
  hint.textContent = q
    ? tf('Fichiers : {model} + {vae} · VRAM {vram}. Changer de qualité recharge le modèle (≈ 30 s).',
        { model: q.model_gguf, vae: t(q.vae), vram: q.vram })
    : '';
}

// ---------------------------------------------------------------------------
// Formulaire de création
// ---------------------------------------------------------------------------

const STYLE_PRESETS = [
  'French pop, synthés chaleureux, batterie douce, voix féminine',
  'Chanson française, piano-voix, cordes légères, émotion',
  'Rock alternatif, guitares saturées, batterie puissante, voix masculine',
  'Synthwave années 80, basse analogique, nappes, rythme entraînant',
  'Lo-fi hip-hop, piano feutré, vinyle, batterie lente, instrumental',
  'Folk acoustique, guitare fingerpicking, harmonica, voix douce',
  'Electro house, synthés lumineux, drop énergique, club',
  'Jazz funk, Rhodes, basse ronde, cuivres, batterie souple',
  'Metal mélodique, double pédale, riffs lourds, chant puissant',
  'Ambient cinématique, nappes, percussions épiques, instrumental',
];

const EXAMPLE_LYRICS = `[Verse]
Les néons s'allument au bout du boulevard
La ville respire encore, il n'est pas trop tard
Je garde tes mots pliés dans ma poche
Comme un ticket de train pour une autre époque

[Chorus]
On ira voir la mer au petit matin
On dira que c'est nous, on dira que c'est bien
Et si la nuit nous rattrape en chemin
On allumera nos propres matins

[Verse]
Le périphérique déroule ses lumières
On compte les sorties comme des prières
Tu chantes faux et ça me fait du bien
Je retiens l'instant, je ne retiens rien

[Chorus]
On ira voir la mer au petit matin
On dira que c'est nous, on dira que c'est bien
Et si la nuit nous rattrape en chemin
On allumera nos propres matins

[Bridge]
Et quand le jour se lèvera sur l'eau
On n'aura plus besoin de dire un mot

[Outro]
On ira voir la mer, on ira voir la mer
`;

/** Découpe un champ Style en tags normalisés (minuscules, sans espace superflu). */
function styleTags(value) {
  return String(value || '')
    .split(',')
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

/**
 * Ajoute un préréglage À LA SUITE du style existant, sans jamais l'effacer.
 * Les tags déjà présents (comparaison insensible à la casse) ne sont pas doublés.
 * Renvoie { ajoutes, ignores }.
 */
function appendStyle(preset) {
  const champ = $('#f-style');
  const existants = styleTags(champ.value);
  const vus = new Set(existants.map((x) => x.toLowerCase()));
  const ajoutes = [];
  const ignores = [];

  for (const tag of styleTags(preset)) {
    if (vus.has(tag.toLowerCase())) { ignores.push(tag); continue; }
    vus.add(tag.toLowerCase());
    existants.push(tag);
    ajoutes.push(tag);
  }

  if (ajoutes.length) {
    champ.value = existants.join(', ');
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  }
  return { ajoutes, ignores };
}

/** (Re)construit les puces de style — rappelé lors d'un changement de langue. */
function renderStyleChips() {
  const host = $('#style-chips');
  if (!host) return;
  host.innerHTML = '';
  STYLE_PRESETS.forEach((preset) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = t(preset.split(',')[0]);
    // L'infobulle précise le comportement : ajout à la suite, pas remplacement.
    b.title = tf('Ajouter à la suite : {style}', { style: t(preset) });
    b.dataset.preset = preset;      // la valeur envoyée au modèle reste celle d'origine
    host.appendChild(b);
    b.addEventListener('click', () => {
      const { ajoutes, ignores } = appendStyle(preset);
      if (ajoutes.length) {
        toast(tf('Ajouté au style : « {tag} »', { tag: ajoutes.join(', ') }), 'ok', 2600);
      } else {
        toast(tf('Style inchangé : « {tag} » était déjà présent.', { tag: ignores.join(', ') }), 'warn', 3200);
      }
      $('#f-style').focus();
      updateCounters();
    });
  });
}

/** Remet les réglages avancés à leurs valeurs par défaut (sans toucher aux paroles). */
function resetAdvancedSettings() {
  $('#f-steps').value = 8;
  $('#f-guidance').value = 0;
  $('#f-max-duration').value = 0;
  $('#f-semantic-temperature').value = 0;
  const q8 = $('#f-quality').querySelector('option[value="q8"]');
  if (q8 && !q8.disabled) $('#f-quality').value = 'q8';
  $('#f-cot').value = 'full';
  // La graine redevient aléatoire : on vide le champ et on retire le verrou.
  $('#f-seed').value = '';
  const lock = $('#f-seed-lock');
  if (lock) lock.classList.remove('on');
  updateQualityHint();
  updateMaxDurationHint();
  updateCounters();
  toast(t('Réglages remis aux valeurs par défaut.'), 'ok', 2600);
}

/* Le même exemple de chanson, en anglais : inséré par ✨ Example quand
   l'interface est en anglais (le texte français reste la référence). */
const EXAMPLE_LYRICS_EN = `[Verse]
The neons light up at the end of the boulevard
The city still breathes, it isn't too late
I keep your words folded in my pocket
Like a train ticket for another time

[Chorus]
We'll go see the sea at first light
We'll say it's us, we'll say it's good
And if the night catches up on the way
We'll light up our own mornings

[Verse]
The ring road unrolls all of its lights
We count the exits like prayers
You sing off-key and I don't mind at all
I hold on to the moment, I hold on to nothing

[Chorus]
We'll go see the sea at first light
We'll say it's us, we'll say it's good
And if the night catches up on the way
We'll light up our own mornings

[Bridge]
And when the day rises over the water
We won't need to say a single word

[Outro]
We'll go see the sea, we'll go see the sea
`;

function initForm() {
  renderStyleChips();
  renderRanges();

  const resetBtn = $('#btn-reset-advanced');
  if (resetBtn) {
    // Un clic sur le bouton ne doit pas ouvrir/fermer le <details>.
    resetBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      resetAdvancedSettings();
    });
  }

  // Tags de structure
  $$('#tagbar .chip[data-tag]').forEach((btn) => {
    btn.addEventListener('click', () => insertTag(btn.dataset.tag));
  });

  $('#btn-example').addEventListener('click', () => {
    const en = typeof I18N !== 'undefined' && I18N.lang === 'en';
    $('#f-lyrics').value = en ? EXAMPLE_LYRICS_EN : EXAMPLE_LYRICS;
    if (!$('#f-style').value.trim()) {
      // Le préréglage proposé suit la langue affichée.
      $('#f-style').value = en ? t(STYLE_PRESETS[0]) : STYLE_PRESETS[0];
    }
    updateCounters();
    toast('Exemple chargé. Modifiez-le librement !', 'ok', 2600);
  });

  $('#btn-clear-lyrics').addEventListener('click', () => {
    $('#f-lyrics').value = '';
    updateCounters();
    $('#f-lyrics').focus();
  });

  $('#f-seed-lock').addEventListener('click', () => {
    $('#f-seed').value = Math.floor(Math.random() * 100000000);
    toast('Graine fixée : la même demande donnera la même chanson.', '', 3000);
  });

  $('#f-quality').addEventListener('change', updateQualityHint);
  $('#f-max-duration').addEventListener('input', updateMaxDurationHint);
  $('#f-lyrics').addEventListener('input', updateCounters);
  $('#f-style').addEventListener('input', updateCounters);
  $('#btn-cancel').addEventListener('click', cancelJob);
  $('#form-generate').addEventListener('submit', onSubmitGenerate);
  updateCounters();
}

function insertTag(tag) {
  const ta = $('#f-lyrics');
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  const before = ta.value.slice(0, start);
  const after = ta.value.slice(end);
  const needBreak = before.length && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  ta.value = before + needBreak + tag + '\n' + after;
  const pos = start + needBreak.length + tag.length + 1;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  updateCounters();
}

function updateCounters() {
  const lyrics = $('#f-lyrics').value;
  const words = lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0;
  const lines = lyrics.trim() ? lyrics.trim().split('\n').length : 0;
  $('#lyrics-words').textContent = words;
  $('#lyrics-lines').textContent = lines;
}

// ---------------------------------------------------------------------------
// Génération
// ---------------------------------------------------------------------------

const STEP_TIMES = [
  { step: 'send', at: 0 },
  { step: 'load', at: 4 },
  { step: 'plan', at: 45 },
  { step: 'render', at: 130 },
  { step: 'save', at: 250 },
];

function setGenerating(on) {
  $('#btn-generate').disabled = on;
  $('.btn-label', $('#btn-generate')).textContent = on ? '⏳ Génération en cours…' : '🎵 Générer la musique';
  $('#progress').classList.toggle('hidden', !on);
  if (on) {
    $$('#progress-steps li').forEach((li) => li.classList.remove('done', 'active'));
  }
}

function startProgressTicker() {
  const startedAt = Date.now();
  clearInterval(STATE.polling);
  const tick = () => {
    const elapsed = (Date.now() - startedAt) / 1000;
    $('#progress-time').textContent = fmtSeconds(elapsed);
    let activeIndex = 0;
    STEP_TIMES.forEach((s, i) => { if (elapsed >= s.at) activeIndex = i; });
    $$('#progress-steps li').forEach((li, i) => {
      li.classList.toggle('done', i < activeIndex);
      li.classList.toggle('active', i === activeIndex);
    });
    const pct = Math.min(95, 4 + (elapsed / 300) * 91);
    $('#progress-fill').style.width = `${pct}%`;
  };
  tick();
  STATE.polling = setInterval(tick, 1000);
}

function stopProgressTicker() {
  clearInterval(STATE.polling);
  STATE.polling = null;
  $('#progress-fill').style.width = '100%';
}

function readForm() {
  return {
    title: $('#f-title').value.trim(),
    style: $('#f-style').value.trim(),
    lyrics: $('#f-lyrics').value.trim(),
    quality: $('#f-quality').value,
    cot: $('#f-cot').value,
    steps: parseInt($('#f-steps').value || '8', 10),
    guidance: parseFloat($('#f-guidance').value || '0'),
    max_duration_min: parseFloat($('#f-max-duration').value || '0'),
    semantic_temperature: parseFloat($('#f-semantic-temperature').value || '0'),
    seed: $('#f-seed').value.trim() === '' ? null : $('#f-seed').value.trim(),
  };
}

async function onSubmitGenerate(event) {
  event.preventDefault();
  if (QUEUE.running) {
    toast(t('Une file est en cours d\u2019exécution : attendez la fin, ou ajoutez à la file.'), 'warn', 6000);
    return;
  }
  const payload = readForm();

  const msg = $('#form-message');
  msg.className = 'form-message';
  msg.textContent = '';

  if (!payload.style) { toast('Le champ « Style » est obligatoire.', 'err'); $('#f-style').focus(); return; }
  if (!payload.lyrics) { toast('Le champ « Paroles » est obligatoire.', 'err'); $('#f-lyrics').focus(); return; }
  if (!payload.title) {
    payload.title = payload.lyrics.split('\n').find((l) => l.trim() && !l.trim().startsWith('['))?.trim().slice(0, 40) || 'Sans titre';
    $('#f-title').value = payload.title;
  }

  if (STATE.state && !STATE.state.engine.ready) {
    toast('Le moteur audio.cpp ne répond pas. Relancez 2-LANCER.bat.', 'err', 7000);
  }

  setGenerating(true);
  startProgressTicker();

  try {
    const res = await api('/api/generate', { method: 'POST', body: JSON.stringify(payload) });
    STATE.job = { id: res.job_id, startedAt: Date.now() };
    pollJob(res.job_id);
  } catch (e) {
    stopProgressTicker();
    setGenerating(false);
    msg.className = 'form-message err';
    msg.textContent = e.message;
    toast(e.message, 'err', 8000);
  }
}

async function pollJob(jobId) {
  const check = async () => {
    let data;
    try {
      data = await api(`/api/pending/${jobId}`);
    } catch (e) {
      if (e.status === 404) {
        // travail terminé puis oublié : on recharge l'historique
        stopProgressTicker();
        setGenerating(false);
        await refreshHistory();
        return;
      }
      setTimeout(check, 3000);
      return;
    }
    if (data.status === 'running') {
      setTimeout(check, 2500);
      return;
    }
    stopProgressTicker();
    setGenerating(false);
    STATE.job = null;
    if (data.status === 'done' && data.entry) {
      await refreshHistory();
      showResult(data.entry, data.audio_url);
      setView('history');
      toast(tf('« {titre} » est prête !', { titre: data.entry.title }), 'ok', 5000);
    } else {
      const message = (data.error && data.error.message) || 'La génération a échoué.';
      const msg = $('#form-message');
      msg.className = 'form-message err';
      msg.textContent = message;
      toast(message, 'err', 12000);
    }
  };
  setTimeout(check, 1200);
}

function cancelJob() {
  stopProgressTicker();
  setGenerating(false);
  STATE.job = null;
  const msg = $('#form-message');
  msg.className = 'form-message';
  msg.textContent = 'Attente annulée côté interface — le moteur termine tout de même la chanson, elle apparaîtra dans l’historique.';
  toast('Suivi annulé. La génération continue en arrière-plan.', 'warn', 7000);
}

// ---------------------------------------------------------------------------
// File d'attente (côté interface) : plusieurs morceaux d'affilée
// ---------------------------------------------------------------------------

const QUEUE = { items: [], running: false, seq: 0 };

const QUEUE_ICONS = { pending: '⏳', running: '🎬', done: '✅', error: '❌' };

function queueAutoTitle(payload) {
  if (payload.title) return payload.title;
  return payload.lyrics.split('\n').find((l) => l.trim() && !l.trim().startsWith('['))?.trim().slice(0, 40) || t('Sans titre');
}

/** Ajoute un payload (formulaire ou resynthèse) à la file et lance le traitement. */
function addToQueuePayload(payload) {
  payload.title = queueAutoTitle(payload);
  QUEUE.items.push({ id: 'q' + (++QUEUE.seq), payload, status: 'pending', message: '' });
  renderQueue();
  toast(tf('« {titre} » ajoutée à la file.', { titre: payload.title }), 'ok');
  processQueue();
}

function addToQueueFromForm() {
  const payload = readForm();
  if (!payload.style) { toast(t('Le champ « Style » est obligatoire.'), 'err'); $('#f-style').focus(); return; }
  if (!payload.lyrics) { toast(t('Le champ « Paroles » est obligatoire.'), 'err'); $('#f-lyrics').focus(); return; }
  addToQueuePayload(payload);
}

function renderQueue() {
  const list = $('#queue-list');
  if (!list) return;
  list.classList.toggle('hidden', QUEUE.items.length === 0);
  $('#btn-queue-clear').classList.toggle('hidden', QUEUE.items.length === 0);
  list.innerHTML = '';
  QUEUE.items.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className = 'queue-item ' + item.status;
    const st = document.createElement('span');
    st.className = 'q-status';
    st.textContent = QUEUE_ICONS[item.status] || '⏳';
    st.title = t({ pending: 'en attente', running: 'en cours…', done: 'terminée', error: 'échec' }[item.status]);
    const body = document.createElement('div');
    body.className = 'q-body';
    const ti = document.createElement('div');
    ti.className = 'q-title';
    ti.textContent = `${idx + 1}. ${item.payload.title || t('Sans titre')}`;
    const sty = document.createElement('div');
    sty.className = 'q-style';
    sty.textContent = item.payload.style || '';
    body.append(ti, sty);
    if (item.message) {
      const msg = document.createElement('div');
      msg.className = 'q-msg';
      msg.textContent = item.message;
      body.append(msg);
    }
    li.append(st, body);
    if (item.status === 'pending') {
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'btn btn-mini q-remove';
      rm.textContent = '✖';
      rm.title = t('Retirer de la file');
      rm.addEventListener('click', () => {
        QUEUE.items = QUEUE.items.filter((i) => i.id !== item.id);
        renderQueue();
      });
      li.append(rm);
    }
    list.appendChild(li);
  });
  const pending = QUEUE.items.filter((i) => i.status === 'pending').length;
  const done = QUEUE.items.filter((i) => i.status === 'done').length;
  const errs = QUEUE.items.filter((i) => i.status === 'error').length;
  $('#queue-summary').textContent = QUEUE.items.length
    ? tf('{p} en attente · {d} terminée(s) · {e} échec(s)', { p: pending, d: done, e: errs })
    : '';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Traite la file séquentiellement : un seul moteur, un morceau à la fois. */
async function processQueue() {
  if (QUEUE.running) return;
  if (!QUEUE.items.some((i) => i.status === 'pending')) return;
  QUEUE.running = true;
  let current = QUEUE.items.find((i) => i.status === 'pending');
  while (current) {
    // une génération « solo » lancée avant la file ? on attend qu'elle rende la main
    while (STATE.job) await sleep(2000);
    current.status = 'running';
    current.message = '';
    renderQueue();
    setGenerating(true);
    startProgressTicker();
    try {
      const res = await api('/api/generate', { method: 'POST', body: JSON.stringify(current.payload) });
      const data = await waitJob(res.job_id);
      if (data.status === 'done' && data.entry) {
        current.status = 'done';
        await refreshHistory();
        toast(tf('File : « {titre} » est prête.', { titre: data.entry.title }), 'ok', 5000);
      } else if (data.status === 'gone') {
        current.status = 'done';
        await refreshHistory();
      } else {
        current.status = 'error';
        current.message = (data.error && data.error.message) || t('La génération a échoué.');
        toast(current.message, 'err', 9000);
      }
    } catch (e) {
      current.status = 'error';
      current.message = e.message;
      toast(e.message, 'err', 9000);
    }
    stopProgressTicker();
    setGenerating(false);
    renderQueue();
    current = QUEUE.items.find((i) => i.status === 'pending');
  }
  QUEUE.running = false;
  const done = QUEUE.items.filter((i) => i.status === 'done').length;
  if (done) toast(tf('File terminée : {n} chanson(s) générée(s).', { n: done }), 'ok', 6000);
  renderQueue();
}

function clearQueue() {
  QUEUE.items = QUEUE.items.filter((i) => i.status === 'running');
  renderQueue();
}

/** Attente passive d'un travail serveur (partagée par la file et la resynthèse). */
function waitJob(jobId) {
  return new Promise((resolve) => {
    const check = async () => {
      let data;
      try {
        data = await api(`/api/pending/${jobId}`);
      } catch (e) {
        if (e.status === 404) { resolve({ status: 'gone' }); return; }
        setTimeout(check, 3000);
        return;
      }
      if (data.status === 'running') { setTimeout(check, 2500); return; }
      resolve(data);
    };
    setTimeout(check, 1200);
  });
}

// ---------------------------------------------------------------------------
// Resynthèse : rejouer une partition ABC éditée (cot = melody / full)
// ---------------------------------------------------------------------------

function buildResynthPayload(entry, card) {
  const abc = ($('.h-score-edit', card).value || '').trim();
  if (!abc) { toast(t('La partition est vide : rien à resynthétiser.'), 'err'); return null; }
  return {
    title: entry.title || '',
    style: entry.style || '',
    lyrics: entry.lyrics || '',
    quality: entry.quality || 'q8',
    cot: $('.h-resynth-cot', card).value,
    steps: entry.steps || 8,
    guidance: entry.guidance || 0,
    max_duration_min: entry.max_duration_min || 0,
    semantic_temperature: entry.semantic_temperature || 0,
    seed: null,
    abc,
    resynth_of: { id: entry.id, title: entry.title },
  };
}

async function resynthFromScore(entry, card) {
  if (QUEUE.running || STATE.job) {
    toast(t('Une génération est en cours : ajoutez plutôt la resynthèse à la file.'), 'warn', 7000);
    return;
  }
  const payload = buildResynthPayload(entry, card);
  if (!payload) return;
  setGenerating(true);
  startProgressTicker();
  try {
    const res = await api('/api/generate', { method: 'POST', body: JSON.stringify(payload) });
    STATE.job = { id: res.job_id, startedAt: Date.now() };
    const data = await waitJob(res.job_id);
    STATE.job = null;
    stopProgressTicker();
    setGenerating(false);
    if (data.status === 'done' && data.entry) {
      await refreshHistory();
      showResult(data.entry, data.audio_url);
      setView('history');
      toast(tf('♻️ Resynthèse terminée : « {titre} »', { titre: data.entry.title }), 'ok', 6000);
    } else if (data.status !== 'gone') {
      const message = (data.error && data.error.message) || t('La génération a échoué.');
      toast(message, 'err', 10000);
    } else {
      await refreshHistory();
    }
  } catch (e) {
    STATE.job = null;
    stopProgressTicker();
    setGenerating(false);
    toast(e.message, 'err', 8000);
  }
}

// ---------------------------------------------------------------------------
// Résultat
// ---------------------------------------------------------------------------

function showResult(entry, url) {
  STATE.lastResult = entry;
  $('#result-empty').classList.add('hidden');
  $('#result-body').classList.remove('hidden');
  $('#result-title').textContent = entry.title || 'Sans titre';
  const audio = $('#result-audio');
  audio.src = url || audioUrl(entry.audio_file);
  audio.load();

  const meta = $('#result-meta');
  meta.innerHTML = '';
  const rows = [
    ['Durée', fmtDuration(entry.duration_ms)],
    ['Style', entry.style],
    ['Qualité', `${entry.quality} · ${entry.steps} ${t('étapes')} · seed ${entry.seed}` +
      (entry.max_duration_min ? ` · max ${entry.max_duration_min} min` : '')],
    ['Généré en', `${fmtSeconds(entry.gen_seconds)} (RTF ${entry.rtf ? entry.rtf.toFixed(2) : '—'})`],
    ['Fichier', `${entry.audio_file} · ${fmtBytes(entry.audio_bytes)}`],   // fmtBytes suit la langue
    ['Date', fmtDate(entry.created_at)],
  ];
  rows.forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = t(k);
    const dd = document.createElement('dd'); dd.textContent = v;
    meta.append(dt, dd);
  });

  const dl = $('#result-download');
  dl.href = url || audioUrl(entry.audio_file);
  dl.setAttribute('download', entry.audio_file || 'chanson.wav');

  const scoreWrap = $('#result-score-wrap');
  if (entry.score_abc) {
    $('#result-score').textContent = entry.score_abc;
    scoreWrap.classList.remove('hidden');
  } else {
    scoreWrap.classList.add('hidden');
  }

  $('#result-copy-style').onclick = () => copyText(entry.style, t('Style'));
  $('#result-copy-lyrics').onclick = () => copyText(entry.lyrics, t('Paroles'));
  $('#result-copy-score').onclick = () => copyText(entry.score_abc, t('Partition ABC'));

  applyI18n(document.getElementById('result-card'));   // libellés dynamiques
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

async function refreshHistory() {
  try {
    const data = await api('/api/history');
    STATE.history = data.entries || [];
  } catch (e) {
    STATE.history = [];
    toast(tf('Historique illisible : {err}', { err: e.message }), 'err');
  }
  renderHistory();
}

function filteredHistory() {
  const q = STATE.search.trim().toLowerCase();
  return STATE.history.filter((e) => {
    if (STATE.favOnly && !e.favori) return false;
    if (!q) return true;
    return [e.title, e.style, e.lyrics, e.note, e.quality]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });
}

/** Ligne de synthèse de l'historique — rappelée au changement de langue. */
function renderHistorySummary(entries) {
  const shown = entries || filteredHistory();
  const totalDur = STATE.history.reduce((acc, e) => acc + (e.duration_ms || 0), 0);
  const totalBytes = STATE.history.reduce((acc, e) => acc + (e.audio_bytes || 0), 0);
  const el = $('#history-summary');
  if (!el) return;
  el.textContent = STATE.history.length
    ? tf(STATE.history.length > 1
        ? '{n} chansons · {musique} de musique · {taille} sur le disque'
        : '{n} chanson · {musique} de musique · {taille} sur le disque',
      { n: STATE.history.length, musique: fmtDuration(totalDur), taille: fmtBytes(totalBytes) })
      + (shown.length !== STATE.history.length ? tf(' · {n} affichée(s)', { n: shown.length }) : '')
    : '';
}

function renderHistory() {
  const list = $('#history-list');
  list.innerHTML = '';
  const entries = filteredHistory();

  $('#history-count').textContent = STATE.history.length;
  renderHistorySummary(entries);

  $('#history-empty').classList.toggle('hidden', entries.length > 0);

  const tpl = $('#tpl-history-card');
  entries.forEach((entry) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    fillCard(node, entry);
    list.appendChild(node);
  });

  applyI18n(document);   // les cartes viennent d'être créées : on les traduit
}

function fillCard(card, entry) {
  $('.h-title', card).textContent = entry.title || t('Sans titre');

  const fav = $('.fav', card);
  fav.textContent = entry.favori ? '★' : '☆';
  fav.classList.toggle('on', !!entry.favori);
  fav.addEventListener('click', async () => {
    entry.favori = !entry.favori;
    fav.textContent = entry.favori ? '★' : '☆';
    fav.classList.toggle('on', entry.favori);
    try {
      await api('/api/update', {
        method: 'POST',
        body: JSON.stringify({ id: entry.id, changes: { favori: entry.favori } }),
      });
    } catch (e) { toast(e.message, 'err'); }
    if (STATE.favOnly) renderHistory();
  });

  $('.h-date', card).textContent = fmtDate(entry.created_at);
  $('.h-duration', card).textContent = `⏱ ${fmtDuration(entry.duration_ms)}`;
  $('.h-quality', card).textContent = `${entry.quality || '?'} · seed ${entry.seed ?? '?'}`;
  $('.h-gentime', card).textContent = tf('généré en {dur}', { dur: fmtSeconds(entry.gen_seconds) });

  const audio = $('.h-audio', card);
  audio.src = audioUrl(entry.audio_file);

  $('.h-style', card).textContent = entry.style || '';
  const lyricsEl = $('.h-lyrics', card);
  lyricsEl.textContent = entry.lyrics || '';

  $('.copy-style', card).addEventListener('click', () => copyText(entry.style, 'Style'));
  $('.copy-lyrics', card).addEventListener('click', () => copyText(entry.lyrics, 'Paroles'));
  $('.toggle-lyrics', card).addEventListener('click', (ev) => {
    const clipped = lyricsEl.classList.toggle('clipped');
    ev.currentTarget.textContent = clipped ? t('👁 Déplier') : t('👁 Replier');
  });

  const scoreBlock = $('.h-score', card);
  if (entry.score_abc) {
    scoreBlock.classList.remove('hidden');
    $('.h-score-text', card).textContent = entry.score_abc;
    $('.copy-score', card).addEventListener('click', () => copyText(entry.score_abc, 'Partition ABC'));

    const editBox = $('.score-edit', card);
    const openBtn = $('.h-score-edit-open', card);
    openBtn.addEventListener('click', () => {
      $('.h-score-edit', card).value = entry.score_abc || '';
      editBox.classList.remove('hidden');
      openBtn.classList.add('hidden');
    });
    $('.h-score-edit-cancel', card).addEventListener('click', () => {
      editBox.classList.add('hidden');
      openBtn.classList.remove('hidden');
    });
    $('.h-resynth', card).addEventListener('click', () => resynthFromScore(entry, card));
    $('.h-resynth-queue', card).addEventListener('click', () => {
      const payload = buildResynthPayload(entry, card);
      if (payload) addToQueuePayload(payload);
    });
  }

  const resynthPill = $('.h-resynth-pill', card);
  if (entry.resynth_of) {
    resynthPill.classList.remove('hidden');
    resynthPill.textContent = tf('♻️ resynthèse de {titre}', { titre: entry.resynth_of.title || '?' });
    resynthPill.title = t('Partition ABC éditée puis rejouée (cot = melody ou full)');
  }

  const meta = $('.h-meta', card);
  meta.innerHTML = '';
  [
    ['Fichier', `${entry.audio_file} · ${fmtBytes(entry.audio_bytes)}`],
    ['Qualité', entry.quality],
    ['Planification (cot)', entry.cot],
    ['Partition ABC', entry.abc_external ? 'fournie (resynthèse)' : 'planifiée par le modèle'],
    ['Étapes NAR', entry.steps],
    ['Durée max demandée', entry.max_duration_min ? `${entry.max_duration_min} min (${entry.semantic_max_tokens} ${t('codes')})` : 'aucune'],
    ['Température chant', entry.semantic_temperature || 'défaut (1.0)'],
    ['Guidance', entry.guidance || 'défaut'],
    ['Graine', entry.seed],
    ['Durée audio', fmtDuration(entry.duration_ms)],
    ['Temps de calcul', fmtSeconds(entry.gen_seconds)],
    ['RTF', entry.rtf ? Number(entry.rtf).toFixed(3) : '—'],
    ['Fréquence', entry.sample_rate ? `${entry.sample_rate} Hz · ${entry.channels || 2} ${t('canaux')}` : '—'],
    ['Identifiant', entry.id],
  ].forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = t(k);
    const dd = document.createElement('dd'); dd.textContent = v == null ? '—' : t(String(v));
    meta.append(dt, dd);
  });

  const dl = $('.h-download', card);
  dl.href = audioUrl(entry.audio_file);
  dl.setAttribute('download', entry.audio_file || 'chanson.wav');

  $('.h-reuse', card).addEventListener('click', () => reuseEntry(entry, false));
  $('.h-regen', card).addEventListener('click', () => reuseEntry(entry, true));
  $('.h-rename', card).addEventListener('click', () => renameEntry(entry));
  $('.h-note', card).addEventListener('click', () => noteEntry(entry, card));
  $('.h-delete', card).addEventListener('click', () => deleteEntry(entry, card));

  const noteEl = $('.h-note-text', card);
  if (entry.note) {
    noteEl.textContent = `📝 ${entry.note}`;
    noteEl.classList.remove('hidden');
  }
}

function reuseEntry(entry, autoGenerate) {
  $('#f-title').value = entry.title || '';
  $('#f-style').value = entry.style || '';
  $('#f-lyrics').value = entry.lyrics || '';
  if (entry.quality) {
    const sel = $('#f-quality');
    const opt = Array.from(sel.options).find((o) => o.value === entry.quality && !o.disabled);
    if (opt) sel.value = entry.quality;
    updateQualityHint();
  }
  if (entry.cot) $('#f-cot').value = entry.cot;
  if (entry.steps) $('#f-steps').value = entry.steps;
  if (entry.guidance) $('#f-guidance').value = entry.guidance;
  $('#f-max-duration').value = entry.max_duration_min || '';
  $('#f-semantic-temperature').value = entry.semantic_temperature || '';
  $('#f-seed').value = autoGenerate ? '' : (entry.seed ?? '');
  if (entry.score_abc) $('#advanced').open = false;
  updateCounters();
  setView('create');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(autoGenerate
    ? 'Paramètres rechargés avec une nouvelle graine : génération lancée.'
    : 'Paramètres rechargés dans le formulaire.', 'ok', 3500);
  if (autoGenerate) {
    $('#form-generate').requestSubmit
      ? $('#form-generate').requestSubmit()
      : $('#form-generate').dispatchEvent(new Event('submit', { cancelable: true }));
  }
}

async function renameEntry(entry) {
  const value = window.prompt(t('Nouveau titre :'), entry.title || '');
  if (value === null) return;
  const title = value.trim();
  if (!title) { toast('Titre vide ignoré.', 'warn'); return; }
  try {
    await api('/api/update', { method: 'POST', body: JSON.stringify({ id: entry.id, changes: { title } }) });
    entry.title = title;
    renderHistory();
    toast('Titre mis à jour.', 'ok', 2200);
  } catch (e) { toast(e.message, 'err'); }
}

async function noteEntry(entry, card) {
  const value = window.prompt(t('Note personnelle (vide pour effacer) :'), entry.note || '');
  if (value === null) return;
  const note = value.trim();
  try {
    await api('/api/update', { method: 'POST', body: JSON.stringify({ id: entry.id, changes: { note } }) });
    entry.note = note;
    const noteEl = $('.h-note-text', card);
    noteEl.textContent = note ? `📝 ${note}` : '';
    noteEl.classList.toggle('hidden', !note);
    toast(note ? 'Note enregistrée.' : 'Note effacée.', 'ok', 2200);
  } catch (e) { toast(e.message, 'err'); }
}

async function deleteEntry(entry, card) {
  const ok = window.confirm(tf('Supprimer « {titre} » ?\nLe fichier audio sera aussi effacé du disque.',
      { titre: entry.title || t('Sans titre') }));
  if (!ok) return;
  try {
    await api(`/api/history/${entry.id}`, { method: 'DELETE' });
    STATE.history = STATE.history.filter((e) => e.id !== entry.id);
    card.remove();
    renderHistory();
    toast('Génération supprimée.', 'ok', 2500);
  } catch (e) { toast(e.message, 'err'); }
}

async function clearHistory() {
  if (!STATE.history.length) { toast('L’historique est déjà vide.', 'warn'); return; }
  const ok = window.confirm(
    tf("Effacer les {n} entrées de l'historique ?\n\nLes fichiers audio restent dans « Mes chansons ».", { n: STATE.history.length })
  );
  if (!ok) return;
  try {
    for (const entry of STATE.history) {
      await api(`/api/history/${entry.id}`, { method: 'DELETE' });
    }
  } catch (e) {
    toast(tf('Effacement partiel : {err}', { err: e.message }), 'warn');
  }
  await refreshHistory();
  toast('Historique effacé (les fichiers WAV ont été supprimés du dossier).', 'ok', 5000);
}

// ---------------------------------------------------------------------------
// Fermeture de l'onglet : on libere la VRAM (le moteur reste disponible)
// ---------------------------------------------------------------------------

function initUnloadOnClose() {
  window.addEventListener('pagehide', (event) => {
    if (event.persisted) return;            // simple mise en cache, on reste
    try {
      if (navigator.sendBeacon) {
        // application/json et non text/plain : le serveur n'accepte plus que ce
        // type (un site tiers ne peut pas l'envoyer sans preflight CORS).
        navigator.sendBeacon('/api/bye', new Blob(['{}'], { type: 'application/json' }));
      }
    } catch (e) { /* jamais bloquant */ }
  });
}

// ---------------------------------------------------------------------------
// Preparation du prompt pour un LLM externe
// ---------------------------------------------------------------------------

function buildAiPrompt() {
  const id = (typeof I18N !== 'undefined' && I18N.lang === 'en')
    ? '#ai-prompt-template-en'
    : '#ai-prompt-template';
  const tpl = $(id) || $('#ai-prompt-template');
  if (!tpl) return '';
  const style = $('#ai-style').value.trim() || '(a preciser : genre, ambiance, instruments, type de voix)';
  const subject = $('#ai-subject').value.trim() || '(a preciser : situation, personnage, emotion, lieu)';
  const duration = $('#ai-duration').value;
  return tpl.textContent
    .replace(/^\n+/, '')
    .replace(/\{\{STYLE\}\}/g, style)
    .replace(/\{\{SUJET\}\}/g, subject)
    .replace(/\{\{DUREE\}\}/g, duration);
}

function initAiCard() {
  const preview = $('#ai-preview');
  const refresh = () => { if (preview) preview.textContent = buildAiPrompt(); };

  $('#btn-ai-copy').addEventListener('click', async () => {
    const prompt = buildAiPrompt();
    if (!$('#ai-style').value.trim() && !$('#ai-subject').value.trim()) {
      toast('Indiquez au moins un style ou un sujet : le prompt sera bien plus utile.', 'warn', 6000);
    }
    await copyText(prompt, 'Prompt pour le LLM');
    $('#ai-hint').textContent = tf(
      'Prompt copié ({n} caractères). Collez-le dans ChatGPT / Claude / Gemini / Mistral, puis recopiez ici les blocs STYLE et PAROLES.',
      { n: prompt.length.toLocaleString(I18N.lang === 'en' ? 'en-US' : 'fr-FR') });
  });

  ['input', 'change'].forEach((evt) => {
    $('#ai-style').addEventListener(evt, refresh);
    $('#ai-subject').addEventListener(evt, refresh);
    $('#ai-duration').addEventListener(evt, refresh);
  });

  const details = $('.ai-details');
  if (details) details.addEventListener('toggle', () => { if (details.open) refresh(); });
  refresh();
}

// ---------------------------------------------------------------------------
// Navigation / divers
// ---------------------------------------------------------------------------

function setView(view) {
  STATE.view = view;
  $$('.tab').forEach((t) => {
    const on = t.dataset.view === view;
    t.classList.toggle('tab-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $('#view-create').classList.toggle('view-active', view === 'create');
  $('#view-history').classList.toggle('view-active', view === 'history');
}

async function checkPendingOnLoad() {
  try {
    const data = await api('/api/pending');
    const running = (data.jobs || []).filter((j) => j.status === 'running');
    if (running.length) {
      setGenerating(true);
      startProgressTicker();
      STATE.job = { id: running[0].job_id, startedAt: Date.now() };
      toast('Une génération est déjà en cours : reprise du suivi.', '', 5000);
      pollJob(running[0].job_id);
      return;
    }
    const done = (data.jobs || []).filter((j) => j.status === 'done' && j.entry);
    if (done.length) {
      const last = done[done.length - 1];
      showResult(last.entry, last.audio_url);
    }
  } catch { /* rien en cours */ }
}

function initUi() {
  $$('.tab').forEach((tab) => tab.addEventListener('click', () => setView(tab.dataset.view)));

  $('#btn-open-folder').addEventListener('click', async () => {
    try { await api('/api/open-songs', { method: 'POST', body: '{}' }); }
    catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-unload').addEventListener('click', async () => {
    try {
      const res = await api('/api/unload', { method: 'POST', body: '{}' });
      toast(res.message || 'VRAM libérée.', res.ok ? 'ok' : 'warn');
    } catch (e) { toast(e.message, 'err'); }
  });

  $('#btn-refresh').addEventListener('click', async () => {
    await loadState();
    await refreshHistory();
    toast('Actualisé.', 'ok', 1600);
  });

  $('#btn-clear-history').addEventListener('click', clearHistory);

  $('#btn-queue-add').addEventListener('click', addToQueueFromForm);
  $('#btn-queue-clear').addEventListener('click', clearQueue);

  let searchTimer = null;
  $('#h-search').addEventListener('input', (ev) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      STATE.search = ev.target.value;
      renderHistory();
    }, 160);
  });

  $('#h-fav-only').addEventListener('change', (ev) => {
    STATE.favOnly = ev.target.checked;
    renderHistory();
  });

  $('#btn-import').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const entries = Array.isArray(data) ? data : data.entries;
      if (!Array.isArray(entries)) throw new Error('format non reconnu');
      const res = await api('/api/import', { method: 'POST', body: JSON.stringify({ entries }) });
      toast(tf('{n} entrée(s) importée(s). Les fichiers audio doivent être copiés dans « Mes chansons ».', { n: res.added }), 'ok', 7000);
      await refreshHistory();
    } catch (e) {
      toast(tf('Import impossible : {err}', { err: e.message }), 'err', 7000);
    } finally {
      ev.target.value = '';
    }
  });

  // Raccourcis clavier
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
      ev.preventDefault();
      if (STATE.view === 'create') $('#form-generate').requestSubmit();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'h') {
      ev.preventDefault();
      setView(STATE.view === 'history' ? 'create' : 'history');
    }
  });

  window.addEventListener('beforeunload', (ev) => {
    // On avertit aussi quand la file d'attente n'est pas vide : elle vit en
    // memoire du navigateur, un rechargement la perdrait.
    const busy = STATE.job
      || QUEUE.running
      || QUEUE.items.some((item) => item.status === 'pending');
    if (busy) {
      ev.preventDefault();
      ev.returnValue = '';
    }
  });
}

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

(async function main() {
  initI18n();          // thème + langue, avant tout rendu
  initUi();
  initForm();
  initAiCard();
  initUnloadOnClose();
  setView('create');
  await loadState();
  await refreshHistory();
  await checkPendingOnLoad();

  // Vérification périodique de l'état du moteur (toutes les 30 s)
  setInterval(() => { if (!STATE.job) loadState(); }, 30000);

  // Premier rendu terminé : on autorise les transitions de thème.
  requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'));
})();
