// ---------------------------------------------------------------------------
// YueStudio - Synthétiseur audio & Piano Roll ABC (Lecteur MIDI Web Audio)
// ---------------------------------------------------------------------------

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Synthétise une note (oscigateur avec enveloppe ADSR type piano/clavier doux)
 */
function playTone(ctx, freq, startTime, duration, voiceType) {
  if (!ctx || freq <= 0) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (voiceType === 'Vocal') {
    osc.type = 'sawtooth';
    // Filtre passe-bas pour imiter un timbre vocal doux
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, startTime);
    filter.Q.setValueAtTime(2, startTime);
    osc.connect(filter);
    filter.connect(gain);
  } else {
    // Ins / instrument : mélange triangle + onde douce
    osc.type = 'triangle';
    osc.connect(gain);
  }

  osc.frequency.setValueAtTime(freq, startTime);

  // Enveloppe d'amplitude (attack, decay, sustain, release)
  const attack = 0.02;
  const release = 0.05;
  const maxGain = voiceType === 'Vocal' ? 0.16 : 0.12;

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(maxGain, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(maxGain * 0.7, startTime + attack + 0.08);
  gain.gain.setValueAtTime(maxGain * 0.7, Math.max(startTime + attack + 0.08, startTime + duration - release));
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Analyse un texte ABC et extrait le tempo, la tonalité, les accords et les notes par piste
 */
function parseAbcScore(text) {
  if (!text) return null;
  const lines = text.split('\n');
  let tempo = 120;
  let unitLen = 1/16;
  let meter = [4, 4];
  let key = 'C';
  let currentVoice = 'Vocal';
  const voices = { Vocal: [], Ins: [] };
  const sections = [];
  let currentSection = 'Début';

  const baseMidi = {
    'C': 60, 'D': 62, 'E': 64, 'F': 65, 'G': 67, 'A': 69, 'B': 71,
    'c': 72, 'd': 74, 'e': 76, 'f': 77, 'g': 79, 'a': 81, 'b': 83
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith('%')) {
      const sec = line.replace(/^%+\s*/, '').trim();
      if (sec) {
        currentSection = sec;
        sections.push({ name: sec, raw: line });
      }
      return;
    }

    if (/^[A-Za-z]:/.test(line)) {
      const type = line[0];
      const val = line.slice(2).trim();
      if (type === 'M') {
        const parts = val.split('/').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) meter = parts;
      } else if (type === 'L') {
        const parts = val.split('/').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) unitLen = parts[0] / parts[1];
      } else if (type === 'Q') {
        const m = val.match(/(\d+\/\d+)=(\d+)/);
        if (m) {
          const [n, d] = m[1].split('/').map(Number);
          const bpm = Number(m[2]);
          tempo = bpm * (n / d) / 0.25;
        } else {
          const bpm = parseInt(val, 10);
          if (!isNaN(bpm)) tempo = bpm;
        }
      } else if (type === 'K') {
        key = val;
      } else if (type === 'V') {
        const vId = val.split(/\s+/)[0];
        currentVoice = vId;
        if (!voices[currentVoice]) voices[currentVoice] = [];
      }
      return;
    }

    if (!voices[currentVoice]) voices[currentVoice] = [];
    voices[currentVoice].push({ line, section: currentSection });
  });

  // Calcul du temps pour chaque piste
  const beatSec = 60 / Math.max(30, tempo);
  const unitSec = (unitLen / 0.25) * beatSec;

  const parsedVoices = {};
  let maxTime = 0;
  const chords = [];

  const tokenRegex = /"([^"]+)"|([_^=]*[A-Ga-gzZ][,']*)(\d*(?:\/\d*)?)|(Z\d*)|(\|)/g;

  Object.entries(voices).forEach(([voiceName, lineObjects]) => {
    let time = 0;
    const events = [];

    lineObjects.forEach(({ line }) => {
      let match;
      tokenRegex.lastIndex = 0;
      while ((match = tokenRegex.exec(line)) !== null) {
        if (match[1]) {
          // Accord: "Am"
          const chordName = match[1];
          if (voiceName === 'Vocal' || chords.length === 0) {
            chords.push({ name: chordName, time });
          }
        } else if (match[4]) {
          // Pause multimesure: Z ou Z2
          const count = match[4].slice(1) ? Number(match[4].slice(1)) : 1;
          const barDuration = (meter[0] / meter[1]) * 4 * beatSec;
          time += count * barDuration;
        } else if (match[2]) {
          const noteStr = match[2];
          const durStr = match[3] || '1';
          let durFactor = 1;
          if (durStr.includes('/')) {
            const [n, d] = durStr.split('/').map(x => x ? Number(x) : 1);
            durFactor = (n || 1) / (d || 2);
          } else if (durStr) {
            durFactor = Number(durStr);
          }
          const durSec = durFactor * unitSec;

          if (noteStr.toLowerCase().startsWith('z')) {
            time += durSec;
          } else {
            const accMatch = noteStr.match(/^([_^=]*)([A-Ga-g])([,']*)$/);
            if (accMatch) {
              const acc = accMatch[1];
              const letter = accMatch[2];
              const oct = accMatch[3];
              let midi = baseMidi[letter] || 60;
              if (oct) {
                for (const ch of oct) {
                  if (ch === ',') midi -= 12;
                  if (ch === "'") midi += 12;
                }
              }
              if (acc) {
                for (const ch of acc) {
                  if (ch === '^') midi += 1;
                  if (ch === '_') midi -= 1;
                }
              }
              events.push({
                midi,
                time,
                duration: durSec * 0.94,
                text: noteStr + (match[3] || ''),
                freq: midiToFreq(midi),
              });
            }
            time += durSec;
          }
        }
      }
    });

    parsedVoices[voiceName] = events;
    if (time > maxTime) maxTime = time;
  });

  return {
    tempo: Math.round(tempo),
    key,
    unitLen,
    meter,
    sections,
    chords,
    voices: parsedVoices,
    totalDuration: maxTime,
  };
}

/**
 * Gestionnaire du lecteur Audio Web pour la partition ABC
 */
class AbcPlayer {
  constructor(abcText, onProgress, onEnded) {
    this.abcText = abcText;
    this.onProgress = onProgress || (() => {});
    this.onEnded = onEnded || (() => {});
    this.parsed = parseAbcScore(abcText);
    this.isPlaying = false;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.timer = null;
    this.activeNodes = [];
  }

  play() {
    if (!this.parsed || this.parsed.totalDuration <= 0) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    this.stopAudio();
    this.isPlaying = true;
    const now = ctx.currentTime;
    this.startTime = now - this.pauseOffset;

    // Planification de toutes les notes à partir du curseur actuel
    Object.entries(this.parsed.voices).forEach(([voiceName, notes]) => {
      notes.forEach((note) => {
        const noteStart = this.startTime + note.time;
        if (noteStart + note.duration > now) {
          const actualStart = Math.max(now, noteStart);
          const actualDur = (noteStart + note.duration) - actualStart;
          playTone(ctx, note.freq, actualStart, actualDur, voiceName);
        }
      });
    });

    // Boucle d'animation / curseur
    const tick = () => {
      if (!this.isPlaying) return;
      const current = ctx.currentTime - this.startTime;
      if (current >= this.parsed.totalDuration) {
        this.stop();
        this.onEnded();
        return;
      }
      this.onProgress(current, this.parsed.totalDuration);
      this.timer = requestAnimationFrame(tick);
    };
    this.timer = requestAnimationFrame(tick);
  }

  pause() {
    if (!this.isPlaying) return;
    const ctx = getAudioContext();
    if (ctx) {
      this.pauseOffset = ctx.currentTime - this.startTime;
    }
    this.stopAudio();
    this.isPlaying = false;
  }

  stop() {
    this.stopAudio();
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.onProgress(0, this.parsed ? this.parsed.totalDuration : 0);
  }

  stopAudio() {
    if (this.timer) {
      cancelAnimationFrame(this.timer);
      this.timer = null;
    }
    // Coupe proprement le son en suspendant puis reprenant le contexte Web Audio
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Génération visuelle du Piano Roll SVG
// ---------------------------------------------------------------------------

function renderPianoRollSvg(parsed, width = 720, height = 150) {
  if (!parsed || parsed.totalDuration <= 0) {
    return `<div class="hint" style="padding: 10px;">Partition vide ou format non reconnu.</div>`;
  }

  const dur = parsed.totalDuration;
  const paddingLeft = 36;
  const paddingBottom = 22;
  const plotWidth = width - paddingLeft - 10;
  const plotHeight = height - paddingBottom - 10;

  // Calcul de la plage MIDI min/max
  let minMidi = 127;
  let maxMidi = 0;
  Object.values(parsed.voices).forEach((notes) => {
    notes.forEach((n) => {
      if (n.midi < minMidi) minMidi = n.midi;
      if (n.midi > maxMidi) maxMidi = n.midi;
    });
  });

  if (minMidi > maxMidi) { minMidi = 48; maxMidi = 84; }
  minMidi = Math.max(36, minMidi - 2);
  maxMidi = Math.min(96, maxMidi + 2);
  const midiRange = Math.max(12, maxMidi - minMidi);

  // Grille temporelle et accords
  let gridLines = '';
  let chordLabels = '';
  (parsed.chords || []).forEach((c) => {
    const x = paddingLeft + (c.time / dur) * plotWidth;
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${plotHeight}" stroke="var(--border-soft, #333)" stroke-dasharray="3,3" />`;
    chordLabels += `<text x="${x + 3}" y="12" fill="var(--accent, #60a5fa)" font-size="10" font-family="sans-serif" font-weight="bold">${c.name}</text>`;
  });

  // Tracé des notes
  let noteRects = '';
  Object.entries(parsed.voices).forEach(([voiceName, notes]) => {
    const isVocal = voiceName === 'Vocal';
    const color = isVocal ? '#38bdf8' : '#a78bfa'; // Bleu pour Vocal, Violet pour Ins
    notes.forEach((n) => {
      const x = paddingLeft + (n.time / dur) * plotWidth;
      const w = Math.max(3, (n.duration / dur) * plotWidth);
      const yNorm = (n.midi - minMidi) / midiRange;
      const y = plotHeight - (yNorm * plotHeight) - 4;
      noteRects += `<rect x="${x}" y="${y}" width="${w}" height="4.5" rx="1.5" fill="${color}" opacity="0.85"><title>${voiceName}: ${n.text} (${Math.round(n.midi)})</title></rect>`;
    });
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" class="pianoroll-svg" style="width: 100%; height: auto; display: block; background: var(--bg-card, #1e293b); border-radius: 6px;">
      ${gridLines}
      ${chordLabels}
      ${noteRects}
      <line id="pr-cursor" class="pr-cursor" x1="${paddingLeft}" y1="0" x2="${paddingLeft}" y2="${plotHeight}" stroke="#ef4444" stroke-width="2" style="display: none;" />
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Helpers d'édition et de transformation ABC
// ---------------------------------------------------------------------------

function updateAbcBpm(abc, newBpm) {
  if (/^Q:/m.test(abc)) {
    return abc.replace(/^Q:.*$/m, `Q:1/4=${newBpm}`);
  }
  return abc.replace(/^(M:.*)$/m, `$1\nQ:1/4=${newBpm}`);
}

function updateAbcKey(abc, newKey) {
  if (/^K:/m.test(abc)) {
    return abc.replace(/^K:.*$/m, `K:${newKey}`);
  }
  return abc + `\nK:${newKey}`;
}

function replaceAbcChord(abc, oldChord, newChord) {
  if (!oldChord || !newChord) return abc;
  const regex = new RegExp(`"${oldChord}"`, 'g');
  return abc.replace(regex, `"${newChord}"`);
}

window.YuESynth = {
  getAudioContext,
  parseAbcScore,
  AbcPlayer,
  renderPianoRollSvg,
  updateAbcBpm,
  updateAbcKey,
  replaceAbcChord,
};
