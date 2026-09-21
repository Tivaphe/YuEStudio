#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
YueStudio - serveur local
=========================

Petit serveur web sans aucune dependance externe (uniquement la bibliotheque
standard de Python) qui :

  1. demarre le moteur audio.cpp (audiocpp_server.exe) avec le modele YuE2 ;
  2. sert l'interface web (app/index.html) sur http://127.0.0.1:8090 ;
  3. recoit les demandes de generation, les transmet au moteur, enregistre
     l'audio WAV sur le disque (dossier "Mes chansons") et tient a jour
     l'historique (historique.json).

Tout est volontairement simple : un seul fichier, aucun framework.
"""

from __future__ import annotations

import atexit
import base64
import json
import os
import re
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# ---------------------------------------------------------------------------
# Chemins
# ---------------------------------------------------------------------------

APP_DIR = Path(__file__).parent.absolute()  # ne resout pas les liens symboliques
ROOT = APP_DIR.parent

ENGINE_DIR = ROOT / "engine"
MODELS_DIR = ROOT / "models" / "Yue2-3B-GGUF"
SONGS_DIR = ROOT / "Mes chansons"
HISTORY_FILE = ROOT / "historique.json"
CONFIG_FILE = ROOT / "engine" / "server.json"
ENGINE_LOG = ROOT / "engine" / "journal-moteur.log"
BACKEND_FILE = ROOT / "engine" / "backend.txt"   # ecrit par installer.ps1
PID_FILE = ROOT / "yuestudio.pid"

# --- Parolier local (petit LLM llama.cpp, optionnel) ---------------------------
# Un LLM abliterated (sans refus, plus créatif) écrit TITRE / STYLE / PAROLES
# au format YuE2, à partir du style et du sujet saisis dans la carte
# « Préparer avec une IA ». Téléchargé uniquement si demandé :
#   .\installer.ps1 -AvecParolier
LLM_DIR = ENGINE_DIR / "llm"
LLM_MODELS_DIR = ROOT / "models" / "Parolier-GGUF"
LLM_LOG = ROOT / "engine" / "journal-parolier.log"
LLM_PORT_DEFAULT = 8081
LLM_IDLE_STOP_S = 900          # le serveur LLM s'arrête après 15 min sans usage

# Modèles conseillés (recherche Hugging Face, sept. 2026 — voir PAROLIER.md).
# Qwen3-8B abliterated v2 (huihui-ai, quantifié par mradermacher) : le meilleur
# compromis créativité / français / VRAM. Version 4B pour les GPU 8 Go.
LLM_MODELS = {
    "8b": {
        "label": "Parolier 8B - recommandé",
        "repo": "mradermacher/Huihui-Qwen3-8B-abliterated-v2-GGUF",
        "file": "Huihui-Qwen3-8B-abliterated-v2.Q4_K_M.gguf",
        "size": 5027780352,
        "vram": "~6 Go",
        "no_think": True,   # Qwen3 hybride : /no_think = réponse directe, sans raisonnement
    },
    "4b": {
        "label": "Parolier 4B - léger (GPU 8 Go)",
        "repo": "mradermacher/Huihui-Qwen3-4B-Instruct-2507-abliterated-GGUF",
        "file": "Huihui-Qwen3-4B-Instruct-2507-abliterated.Q4_K_M.gguf",
        "size": 2497281312,
        "vram": "~3 Go",
        "no_think": True,
    },
}
DEFAULT_LLM = "8b"

HOST = "127.0.0.1"        # adresse d'ecoute de l'interface (modifiable via --host)
HOST_DEFAULT = HOST
APP_PORT_DEFAULT = 8090
ENGINE_PORT_DEFAULT = 8080

ENGINE_HOST = "127.0.0.1"

# Qualites proposees : id -> (modele principal, VAE, taille approx. VRAM)
QUALITIES = {
    "q4": {
        "label": "Rapide (Q4)",
        "model_gguf": "yue2-3b-q4_0.gguf",
        "vae_gguf": "yue2-vae-f16.gguf",
        "vram": "~8 Go",
    },
    "q8": {
        "label": "Equilibre (Q8) - recommande",
        "model_gguf": "yue2-3b-q8_0.gguf",
        "vae_gguf": "yue2-vae-f16.gguf",
        "vram": "~9 Go",
    },
    "bf16": {
        "label": "Maximale (BF16)",
        "model_gguf": "yue2-3b-bf16.gguf",
        "vae_gguf": "yue2-vae-f32.gguf",
        "vram": "~13 Go",
    },
}
DEFAULT_QUALITY = "q8"

COT_LABELS = {
    "full": "Complete (le modele compose la partition puis chante)",
    "melody": "Melodie seule",
    "off": "Desactivee (plus rapide)",
}

# ---------------------------------------------------------------------------
# Petits utilitaires
# ---------------------------------------------------------------------------

HISTORY_LOCK = threading.Lock()
JOBS_LOCK = threading.Lock()
JOBS: dict = {}  # id -> {status, entry, error, started_at}

# --- Garde-fous des requetes POST ------------------------------------------
# 1) Content-Type : un site tiers ne peut PAS envoyer application/json sans
#    preflight CORS ; en mode « no-cors » le navigateur n'autorise que
#    text/plain, application/x-www-form-urlencoded ou multipart/form-data.
# 2) Host : bloque le DNS rebinding (un domaine pirate qui resout vers
#    127.0.0.1 se presente avec son propre nom dans l'en-tete Host).
# 3) Origin / Sec-Fetch-Site : refusent explicitement l'origine croisee.
ALLOWED_POST_TYPE = "application/json"
UNLOAD_GRACE = 5.0          # secondes : un F5 (ou un retour) annule le dechargement
_LOCAL_NAMES: set = set()   # noms d'hote autorises, calcules selon --host
_LAST_ACTIVITY = 0.0        # horodatage de la derniere requete de l'interface
_UNLOAD_TIMER = None
_UNLOAD_LOCK = threading.Lock()


def log(message: str) -> None:
    try:
        print(message, flush=True)
    except Exception:
        pass


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def sanitize_title(title: str) -> str:
    """Transforme un titre en nom de fichier sans risque."""
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", title or "").strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"[. ]+$", "", cleaned)
    return cleaned[:60] or "Sans titre"


def load_history() -> list:
    if not HISTORY_FILE.exists():
        return []
    try:
        with HISTORY_LOCK:
            data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception as exc:  # fichier abime : on repart d'une liste vide
        log(f"[!] historique.json illisible ({exc})")
    return []


def save_history(entries: list) -> None:
    with HISTORY_LOCK:
        tmp = HISTORY_FILE.with_suffix(".json.tmp")
        tmp.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        os.replace(tmp, HISTORY_FILE)


def http_json(url: str, payload=None, timeout: float = 15.0):
    """Petit client HTTP : renvoie (statut, corps JSON ou texte)."""
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        status = exc.code
    except Exception as exc:
        return 0, {"error": {"message": str(exc)}}
    try:
        return status, json.loads(raw.decode("utf-8", "replace"))
    except Exception:
        return status, {"raw": raw.decode("utf-8", "replace")}


def engine_ready(port: int) -> bool:
    status, body = http_json(f"http://{ENGINE_HOST}:{port}/health", timeout=5)
    return status == 200 and isinstance(body, dict) and body.get("status") == "ok"


def engine_has_yue2(port: int) -> bool:
    """Verifie qu'un moteur deja lance expose bien un modele YuE2."""
    status, body = http_json(f"http://{ENGINE_HOST}:{port}/v1/models", timeout=5)
    if status != 200 or not isinstance(body, dict):
        return False
    for entry in body.get("data") or []:
        if isinstance(entry, dict) and entry.get("family") == "yue2":
            return True
    return False


def port_is_free(port: int, host: str | None = None) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host or HOST, port))
            return True
        except OSError:
            return False


def find_engine_exe() -> Path | None:
    for name in ("audiocpp_server.exe", "audiocpp_server"):
        candidate = ENGINE_DIR / name
        if candidate.exists():
            return candidate
    found = sorted(ENGINE_DIR.glob("**/audiocpp_server*")) if ENGINE_DIR.exists() else []
    return found[0] if found else None


def detect_backend() -> str:
    """Backend choisi a l'installation (engine/backend.txt), sinon deduction.

    Sous Windows, ggml est compile statiquement dans audiocpp_server.exe :
    la presence de DLL ne suffit donc pas, d'ou le fichier backend.txt.
    """
    if BACKEND_FILE.exists():
        value = BACKEND_FILE.read_text(encoding="utf-8", errors="replace").strip().lower()
        value = value.replace("cuda12.4", "cuda").replace("cuda13.3", "cuda")
        if value in ("cuda", "vulkan", "cpu", "metal"):
            return value

    if not ENGINE_DIR.exists():
        return "cpu"
    names = {p.name.lower() for p in ENGINE_DIR.rglob("*.dll")}
    # Le paquet CUDA est livre avec les DLL d'execution CUDA (cudart, cublas...).
    if any(n.startswith(("cudart", "cublas", "ggml-cuda")) for n in names):
        return "cuda"
    if any(n.startswith("ggml-vulkan") for n in names):
        return "vulkan"
    # Paquet Windows Vulkan / CPU : ggml est statique, on suppose Vulkan
    # (le moteur retombe sur le CPU tout seul s'il ne trouve pas de GPU).
    if (ENGINE_DIR / "audiocpp_server.exe").exists():
        return "vulkan"
    return "cpu"


def write_engine_config(engine_port: int, backend: str) -> None:
    """Ecrit engine/server.json : un modele par qualite, charge a la demande."""
    model_path = str(MODELS_DIR)
    models = []
    for qid, spec in QUALITIES.items():
        models.append(
            {
                "id": f"yue2-{qid}",
                "family": "yue2",
                "path": model_path,
                "task": "gen",
                "mode": "offline",
                "busy_timeout_ms": 3600000,
                "session_options": {
                    "yue2.model_gguf": spec["model_gguf"],
                    "yue2.vae_gguf": spec["vae_gguf"],
                },
            }
        )
    config = {
        "host": ENGINE_HOST,
        "port": engine_port,
        "backend": backend,
        "device": 0,
        "threads": 4,
        "lazy_load": True,
        "max_loaded_models": 1,
        "idle_unload_ms": 1800000,
        "busy_timeout_ms": 3600000,
        "min_free_memory_mb": 0,
        "log_request_body": False,
        "models": models,
    }
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(
        json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ---------------------------------------------------------------------------
# Etat partage (moteur)
# ---------------------------------------------------------------------------


class Engine:
    def __init__(self) -> None:
        self.proc: subprocess.Popen | None = None
        self.port: int = ENGINE_PORT_DEFAULT
        self.backend: str = "cpu"
        self.exe: Path | None = None
        self.reused: bool = False
        self.log_handle = None

    @property
    def base_url(self) -> str:
        return f"http://{ENGINE_HOST}:{self.port}"

    def start(self) -> None:
        self.exe = find_engine_exe()
        if self.exe is None:
            log("")
            log("[!] audiocpp_server introuvable dans le dossier 'engine'.")
            log("    Lancez d'abord :  1-INSTALLER.bat")
            log("    L'interface demarre quand meme en mode 'hors ligne'.")
            return

        self.backend = detect_backend()

        # Un moteur YuE2 tourne deja ? On le reutilise (sinon on prend un autre port).
        for port in (ENGINE_PORT_DEFAULT, ENGINE_PORT_DEFAULT + 10):
            if engine_ready(port) and engine_has_yue2(port):
                self.port = port
                self.reused = True
                log(f"[i] Moteur audio.cpp deja actif sur le port {port} : je le reutilise.")
                return

        self.port = ENGINE_PORT_DEFAULT
        if not port_is_free(self.port):
            self.port = next(
                (p for p in range(8081, 8120) if port_is_free(p)), ENGINE_PORT_DEFAULT
            )
            log(f"[i] Le port 8080 est occupe : le moteur demarre sur le port {self.port}.")

        write_engine_config(self.port, self.backend)

        ENGINE_LOG.parent.mkdir(parents=True, exist_ok=True)
        self.log_handle = open(ENGINE_LOG, "a", encoding="utf-8", errors="replace")
        self.log_handle.write(f"\n=== Demarrage {now_iso()} backend={self.backend} port={self.port} ===\n")
        self.log_handle.flush()

        creationflags = 0
        if os.name == "nt":
            creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

        self.proc = subprocess.Popen(
            [str(self.exe), "--config", str(CONFIG_FILE)],
            cwd=str(ENGINE_DIR),
            stdout=self.log_handle,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            creationflags=creationflags,
        )
        log(f"[i] Moteur audio.cpp lance (backend {self.backend}, port {self.port}).")

        # Attente de la disponibilite (le chargement du modele se fait a la 1re demande)
        for _ in range(60):
            if engine_ready(self.port):
                log("[i] Moteur pret.")
                return
            if self.proc.poll() is not None:
                log("[!] Le moteur s'est arrete immediatement. Voir engine/journal-moteur.log")
                return
            time.sleep(0.5)
        log("[!] Le moteur ne repond pas encore ; l'interface reessaiera plus tard.")

    def stop(self) -> None:
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=10)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
        if self.log_handle:
            try:
                self.log_handle.close()
            except Exception:
                pass
            self.log_handle = None


ENGINE = Engine()


# ---------------------------------------------------------------------------
# Parolier local (serveur llama.cpp, démarré à la demande)
# ---------------------------------------------------------------------------
#
# Contrairement au moteur musical (toujours actif), le serveur LLM ne tourne
# que pendant la génération de paroles : il démarre au premier appel à
# POST /api/lyrics, s'arrête après 15 min d'inactivité, et est stoppé
# automatiquement dès qu'une génération musicale commence (la musique a
# priorité sur la VRAM — le parolier redémarre en ~15 s à la demande suivante).
# Un serveur llama.cpp déjà lancé à la main sur le port 8081 est réutilisé
# tel quel (et n'est jamais tué par YueStudio).

LLM_EXE_NAMES = (
    "llama-server.exe", "llama-server",      # CLI classique (toujours d'actualité)
    "llama-serve.exe", "llama-serve",        # variante éventuelle
    "llama.exe", "llama",                    # CLI unifiée : s'invoque via « llama serve »
)


def find_llm_exe() -> Path | None:
    for name in LLM_EXE_NAMES:
        candidate = LLM_DIR / name
        if candidate.exists():
            return candidate
    if LLM_DIR.exists():
        wanted = {n.lower() for n in LLM_EXE_NAMES}
        for found in sorted(LLM_DIR.rglob("*")):
            if found.is_file() and found.name.lower() in wanted:
                return found
    return None


def llm_probe(port: int) -> bool:
    """Vrai si le port répond comme un serveur LLM (llama.cpp ou compatible).

    /health seul ne suffit pas (audio.cpp répond aussi « ok ») : on vérifie
    /v1/models — audio.cpp y expose family=yue2, llama.cpp un format OpenAI.
    """
    status, body = http_json(f"http://{ENGINE_HOST}:{port}/health", timeout=5)
    if status != 200 or not isinstance(body, dict):
        return False
    if (body.get("status") or "").lower() not in ("ok", "no slot available"):
        return False
    status, body = http_json(f"http://{ENGINE_HOST}:{port}/v1/models", timeout=5)
    if status != 200 or not isinstance(body, dict):
        return False
    for entry in body.get("data") or []:
        if isinstance(entry, dict) and entry.get("family") == "yue2":
            return False  # c'est le moteur musical, pas un LLM
    return True


def llm_argv(exe: Path, model_file: Path, port: int, n_gpu_layers: int) -> list:
    """Ligne de commande du serveur LLM (compatible CLI classique et unifiée)."""
    args = [str(exe)]
    if exe.stem.lower() == "llama":
        args.append("serve")
    args += [
        "-m", str(model_file),
        "--host", ENGINE_HOST,
        "--port", str(port),
        "-c", "8192",              # prompt (~1500 tok.) + paroles (~1500 tok.) à l'aise
        "-ngl", str(n_gpu_layers),  # 999 = tout sur GPU, 0 = CPU seul
        "--log-disable",           # le journal reste lisible (journal-parolier.log)
    ]
    return args


class LlmEngine:
    def __init__(self) -> None:
        self.proc: subprocess.Popen | None = None
        self.port: int = LLM_PORT_DEFAULT
        self.model_id: str | None = None
        self.exe: Path | None = None
        self.reused: bool = False
        self.log_handle = None
        self._lock = threading.Lock()
        self._idle_timer = None

    @property
    def base_url(self) -> str:
        return f"http://{ENGINE_HOST}:{self.port}"

    def is_running(self) -> bool:
        if self.reused:
            return llm_probe(self.port)
        return self.proc is not None and self.proc.poll() is None

    def active(self) -> bool:
        """Vrai si un serveur LLM utilisable répond (le nôtre ou un externe)."""
        with self._lock:
            if self.is_running():
                return True
            # Un serveur lancé à la main entre-temps ? On l'adopte.
            for port in (LLM_PORT_DEFAULT, LLM_PORT_DEFAULT + 10):
                if llm_probe(port):
                    self.port = port
                    self.reused = True
                    self.model_id = self.model_id or "externe"
                    return True
            return False

    def ensure(self, model_id: str) -> tuple:
        """Démarre le serveur LLM si besoin. Renvoie (ok, message)."""
        with self._lock:
            if self.is_running():
                if self.reused or self.model_id == model_id:
                    self._arm_idle_locked()
                    return True, ""
                self._stop_locked("changement de modèle de parolier")
            ok, message = self._start_locked(model_id)
            if ok:
                self._arm_idle_locked()
            return ok, message

    def _start_locked(self, model_id: str) -> tuple:
        self.exe = find_llm_exe()
        if self.exe is None:
            return False, ("Le parolier local n'est pas installé. Dans PowerShell : "
                           ".\\installer.ps1 -AvecParolier")
        spec = LLM_MODELS.get(model_id)
        if spec is None:
            return False, f"Modèle de parolier inconnu : {model_id}"
        model_file = LLM_MODELS_DIR / spec["file"]
        if not model_file.exists():
            return False, (f"Modèle « {model_id} » absent ({spec['file']}). Relancez "
                           f".\\installer.ps1 -AvecParolier -Parolier {model_id}")

        # Un serveur LLM tourne déjà ? On le réutilise (jamais tué par YueStudio).
        for port in (LLM_PORT_DEFAULT, LLM_PORT_DEFAULT + 10):
            if llm_probe(port):
                self.port = port
                self.reused = True
                self.model_id = model_id
                log(f"[i] Serveur LLM déjà actif sur le port {port} : je le réutilise.")
                return True, ""

        self.port = LLM_PORT_DEFAULT
        if not port_is_free(self.port):
            self.port = next(
                (p for p in range(8082, 8120) if port_is_free(p)), LLM_PORT_DEFAULT
            )

        LLM_LOG.parent.mkdir(parents=True, exist_ok=True)
        try:
            if self.log_handle:
                self.log_handle.close()
        except Exception:
            pass
        self.log_handle = open(LLM_LOG, "a", encoding="utf-8", errors="replace")
        self.log_handle.write(f"\n=== Parolier {model_id} {now_iso()} port={self.port} ===\n")
        self.log_handle.flush()

        backend = ENGINE.backend or detect_backend()
        n_gpu_layers = 0 if backend == "cpu" else 999
        creationflags = 0
        if os.name == "nt":
            creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        try:
            self.proc = subprocess.Popen(
                llm_argv(self.exe, model_file, self.port, n_gpu_layers),
                cwd=str(LLM_DIR),
                stdout=self.log_handle,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                creationflags=creationflags,
            )
        except Exception as exc:
            return False, f"Impossible de lancer le serveur LLM : {exc}"
        self.reused = False
        self.model_id = model_id
        log(f"[i] Parolier {model_id} en cours de chargement (port {self.port})...")

        for _ in range(240):  # ~2 min max (chargement Q4 8B ≈ 15-30 s)
            if llm_probe(self.port):
                log("[i] Parolier prêt.")
                return True, ""
            if self.proc.poll() is not None:
                self.proc = None
                return False, ("Le serveur LLM s'est arrêté immédiatement. Voir "
                               "engine/journal-parolier.log (VRAM insuffisante ? "
                               "essayez 🧹 Libérer la VRAM puis le modèle 4B).")
            time.sleep(0.5)
        return False, "Le serveur LLM ne répond pas (délai dépassé)."

    def stop(self, reason: str = "") -> None:
        with self._lock:
            self._stop_locked(reason)

    def _stop_locked(self, reason: str = "") -> None:
        if self._idle_timer is not None:
            try:
                self._idle_timer.cancel()
            except Exception:
                pass
            self._idle_timer = None
        if self.reused:
            # Serveur externe : on s'en détache sans le tuer.
            self.reused = False
            self.model_id = None
            return
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=10)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
            if reason:
                log(f"[i] Parolier arrêté ({reason}).")
        self.proc = None
        self.model_id = None
        if self.log_handle:
            try:
                self.log_handle.close()
            except Exception:
                pass
            self.log_handle = None

    def _arm_idle_locked(self) -> None:
        """Arrêt automatique après 15 min sans génération de paroles."""
        if self._idle_timer is not None:
            try:
                self._idle_timer.cancel()
            except Exception:
                pass

        def _idle() -> None:
            with self._lock:
                if _LLM_BUSY[0] > 0:
                    self._arm_idle_locked()  # une génération est en cours : on reporte
                    return
            self.stop("inactivité (15 min)")

        timer = threading.Timer(LLM_IDLE_STOP_S, _idle)
        timer.daemon = True
        self._idle_timer = timer
        timer.start()


LLM = LlmEngine()

# Compteur de générations de paroles en cours (protège le serveur LLM contre
# l'arrêt automatique pendant qu'il écrit).
_LLM_BUSY = [0]
_LLM_BUSY_LOCK = threading.Lock()


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------


def open_in_file_manager(path: Path) -> bool:
    """Ouvre un dossier dans l'explorateur (Windows) / le gestionnaire de fichiers."""
    try:
        path.mkdir(parents=True, exist_ok=True)
        if os.name == "nt":
            os.startfile(str(path))  # type: ignore[attr-defined]
            return True
        if sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
            return True
        subprocess.Popen(["xdg-open", str(path)])
        return True
    except Exception as exc:
        log(f"[!] ouverture du dossier impossible : {exc}")
        return False


def quality_files_missing(quality: str) -> list:
    spec = QUALITIES[quality]
    missing = []
    for name in (spec["model_gguf"], spec["vae_gguf"]):
        if not (MODELS_DIR / name).exists():
            missing.append(name)
    for name in (
        "sidecars/yue2-model-config.json",
        "sidecars/yue2-generation-config.json",
        "sidecars/yue2-qwen.tiktoken",
        "sidecars/yue2-vae-config.json",
    ):
        if not (MODELS_DIR / name).exists():
            missing.append(name)
    return missing


def extract_score(result: dict) -> str:
    """Recupere la partition ABC produite par le modele, si presente."""
    for artifact in result.get("artifacts") or []:
        if not isinstance(artifact, dict):
            continue
        blob = " ".join(
            str(artifact.get(key, "")) for key in ("id", "kind")
        ) + " " + json.dumps(artifact.get("meta") or {}, ensure_ascii=False)
        if re.search(r"abc|score", blob, re.I):
            payload = artifact.get("payload")
            if isinstance(payload, str) and payload:
                try:
                    return base64.b64decode(payload).decode("utf-8", "replace")
                except Exception:
                    return ""
    return ""


def validate_generation(body: dict):
    """Verifications immediates : renvoie (statut, message) ou (None, None)."""
    if not (body.get("style") or "").strip():
        return 400, "Le champ « Style » est obligatoire."
    if not (body.get("lyrics") or "").strip():
        return 400, "Le champ « Paroles » est obligatoire."

    quality = body.get("quality") or DEFAULT_QUALITY
    if quality not in QUALITIES:
        return 400, f"Qualite inconnue : {quality}"

    if ENGINE.exe is None:
        return 503, "Le moteur audio.cpp n'est pas installe. Lancez 1-INSTALLER.bat."
    if not engine_ready(ENGINE.port):
        return 503, ("Le moteur ne repond pas. Relancez 2-LANCER.bat ou consultez "
                     "engine/journal-moteur.log.")

    missing = quality_files_missing(quality)
    if missing:
        return 400, ("Fichiers modele manquants pour la qualite « " + quality + " » : "
                     + ", ".join(missing)
                     + ". Relancez 1-INSTALLER.bat (option -ToutesQualites) ou "
                       "choisissez une autre qualite.")
    return None, None


def run_generation(body: dict):
    title = (body.get("title") or "").strip()
    style = (body.get("style") or "").strip()
    lyrics = (body.get("lyrics") or "").strip()
    quality = body.get("quality") or DEFAULT_QUALITY
    cot = body.get("cot") or "full"
    steps = int(body.get("steps") or 8)
    guidance = float(body.get("guidance") or 0)
    seed = body.get("seed")

    def as_float(value, default=0.0):
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    max_duration_min = as_float(body.get("max_duration_min"), 0.0)
    semantic_temperature = as_float(body.get("semantic_temperature"), 0.0)
    semantic_max_tokens = 0
    if max_duration_min > 0:
        # 25 codes musicaux par seconde (trame de 40 ms), plafond modele : 9000
        semantic_max_tokens = int(max(250, min(9000, max_duration_min * 60 * 25)))

    if quality not in QUALITIES:
        return 400, {"error": {"message": f"Qualite inconnue : {quality}"}}
    if not style:
        return 400, {"error": {"message": "Le style est obligatoire."}}
    if not lyrics:
        return 400, {"error": {"message": "Les paroles sont obligatoires."}}
    if cot not in COT_LABELS:
        cot = "full"
    abc_text = (body.get("abc") or "").strip()
    if len(abc_text) > 200000:
        return 400, {
            "error": {"message": "Partition ABC trop longue (200 000 caracteres max)."}
        }
    if abc_text and cot == "off":
        cot = "melody"  # une partition fournie impose une route symbolique
    steps = max(1, min(64, steps))

    missing = quality_files_missing(quality)
    if missing:
        return 400, {
            "error": {
                "message": (
                    "Fichiers modele manquants pour cette qualite : "
                    + ", ".join(missing)
                    + ". Relancez 1-INSTALLER.bat (option -ToutesQualites) "
                    "ou choisissez une autre qualite."
                )
            }
        }

    if ENGINE.exe is None:
        return 503, {
            "error": {
                "message": "Le moteur audio.cpp n'est pas installe. Lancez 1-INSTALLER.bat."
            }
        }
    if not engine_ready(ENGINE.port):
        return 503, {
            "error": {
                "message": "Le moteur ne repond pas. Relancez 2-LANCER.bat "
                "ou consultez engine/journal-moteur.log."
            }
        }

    if seed in (None, "", "random"):
        seed = int(time.time() * 1000) % (2**31)
    else:
        try:
            seed = max(0, min(2**62, int(seed)))
        except Exception:
            seed = 1234

    options = {
        "style": style,
        "lyrics": lyrics,
        "cot": cot,
        "seed": seed,
        "num_inference_steps": steps,
    }
    if guidance > 0:
        options["guidance_scale"] = guidance
    if semantic_max_tokens:
        options["semantic_max_tokens"] = semantic_max_tokens
        options["semantic_min_tokens"] = min(200, semantic_max_tokens)
    if semantic_temperature > 0:
        options["semantic_temperature"] = max(0.0, min(5.0, semantic_temperature))
    if abc_text:
        options["abc"] = abc_text

    # La musique a priorité sur la VRAM : le parolier est arrêté avant chaque
    # génération (il redémarre tout seul en ~15 s à la prochaine demande).
    # On ne coupe jamais un parolier en pleine écriture.
    with _LLM_BUSY_LOCK:
        lyrics_busy = _LLM_BUSY[0] > 0
    if not lyrics_busy and LLM.is_running():
        LLM.stop("génération musicale prioritaire")

    started = time.time()
    status, result = http_json(
        f"{ENGINE.base_url}/v1/tasks/run",
        {"model": f"yue2-{quality}", "request": {"text": lyrics, "options": options}},
        timeout=3600.0,
    )
    elapsed = time.time() - started

    if status != 200 or "audio" not in result:
        message = "Generation echouee."
        if isinstance(result, dict):
            err = result.get("error")
            if isinstance(err, dict) and err.get("message"):
                message = err["message"]
            elif result.get("raw"):
                message = result["raw"][:600]
        return status or 502, {
            "error": {"message": message, "detail": result if isinstance(result, dict) else None}
        }

    try:
        wav_bytes = base64.b64decode(result["audio"])
    except Exception as exc:
        return 502, {"error": {"message": f"Audio illisible : {exc}"}}
    if not wav_bytes:
        return 502, {"error": {"message": "Le moteur n'a renvoye aucun audio."}}

    SONGS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"{stamp}_{sanitize_title(title)}.wav"
    target = SONGS_DIR / filename
    counter = 1
    while target.exists():
        target = SONGS_DIR / f"{stamp}_{sanitize_title(title)}_{counter}.wav"
        counter += 1
    target.write_bytes(wav_bytes)

    resynth_of = body.get("resynth_of")
    if isinstance(resynth_of, dict):
        resynth_of = {
            "id": str(resynth_of.get("id") or "")[:40],
            "title": str(resynth_of.get("title") or "")[:120],
        }
    else:
        resynth_of = None

    timing = result.get("timing") or {}
    entry = {
        "id": uuid.uuid4().hex[:12],
        "created_at": now_iso(),
        "title": title or "Sans titre",
        "style": style,
        "lyrics": lyrics,
        "cot": cot,
        "quality": quality,
        "seed": seed,
        "steps": steps,
        "guidance": guidance or None,
        "semantic_temperature": semantic_temperature or None,
        "max_duration_min": max_duration_min or None,
        "semantic_max_tokens": semantic_max_tokens or None,
        "audio_file": target.name,
        "audio_bytes": len(wav_bytes),
        "duration_ms": timing.get("audio_duration_ms"),
        "sample_rate": result.get("sample_rate"),
        "channels": result.get("channels"),
        "gen_seconds": round(elapsed, 1),
        "rtf": timing.get("rtf"),
        "score_abc": extract_score(result) or None,
        "abc_external": bool(abc_text),
        "resynth_of": resynth_of,
        "note": "",
        "favori": False,
    }

    entries = load_history()
    entries.insert(0, entry)
    save_history(entries)

    log(
        f"[+] Genere : {entry['title']} "
        f"({(entry['duration_ms'] or 0) / 1000:.0f} s de musique en {entry['gen_seconds']} s)"
    )
    return 200, {"entry": entry, "audio_url": f"/audio/{urllib.parse.quote(target.name)}"}


# ---------------------------------------------------------------------------
# Parolier : prompt, appel au LLM et découpage TITRE / STYLE / PAROLES
# ---------------------------------------------------------------------------

_LYRICS_TEMPLATE_CACHE: dict = {}


def lyrics_template(lang: str) -> str:
    """Gabarit du prompt parolier, lu dans app/index.html (source unique).

    C'est exactement le texte que la carte « Préparer avec une IA » affiche
    et copie : aucune duplication, aucune dérive possible entre la version
    « copier vers ChatGPT » et la génération locale.
    """
    lang = "en" if lang == "en" else "fr"
    if lang in _LYRICS_TEMPLATE_CACHE:
        return _LYRICS_TEMPLATE_CACHE[lang]
    tag_id = "ai-prompt-template-en" if lang == "en" else "ai-prompt-template"
    try:
        html = (APP_DIR / "index.html").read_text(encoding="utf-8")
        start = html.index(f'id="{tag_id}"')
        start = html.index(">", start) + 1
        end = html.index("</script>", start)
        template = html[start:end].strip()
    except Exception:
        template = ("Écris une chanson au format YuE2.\n\nSTYLE : {{STYLE}}\n"
                    "SUJET : {{SUJET}}\nRéponds avec les blocs TITRE / STYLE / "
                    "PAROLES séparés par des lignes '-----'.")
    _LYRICS_TEMPLATE_CACHE[lang] = template
    return template


def build_lyrics_prompt(style: str, subject: str, duration: str, lang: str) -> str:
    template = lyrics_template(lang)
    return (template
            .replace("{{STYLE}}", style or "(à préciser)")
            .replace("{{SUJET}}", subject or "(à préciser)")
            .replace("{{DUREE}}", duration or "standard (~3 min)"))


def parse_lyrics_output(text: str) -> dict:
    """Découpe la réponse du LLM en titre / style / paroles / durée estimée.

    Tolérant : le modèle ajoute parfois du markdown (**TITRE :**, # ...) ou
    oublie les séparateurs. Si les paroles sont introuvables, `parsed` vaut
    False et l'interface affiche le texte brut (rien n'est perdu).
    """
    cleaned = re.sub(r"<think>.*?</think>", "", text or "",
                     flags=re.S | re.I).strip()
    heads = {"titre": "title", "title": "title", "style": "style",
             "paroles": "lyrics", "lyrics": "lyrics"}
    sections = {"title": [], "style": [], "lyrics": []}
    current = None
    for raw in cleaned.splitlines():
        probe = raw.strip().lstrip("#*>—- ").strip().lstrip("*_").strip()
        match = re.match(r"(?i)^(titre|title|style|paroles|lyrics)\s*:\s*(.*)$", probe)
        if match:
            current = heads[match.group(1).lower()]
            rest = match.group(2).strip().strip("*_\"«» ").strip()
            if rest:
                sections[current].append(rest)
            continue
        stripped = raw.strip()
        if stripped and set(stripped) <= {"-", "—", "="} and len(stripped) >= 3:
            continue  # ligne séparatrice « ----- »
        if current:
            sections[current].append(raw.rstrip())

    title = " ".join(sections["title"]).strip()
    title = re.sub(r"\s+", " ", title).strip("*_\"'«» ").strip()[:120]
    style = " ".join(s for s in sections["style"] if s.strip())
    style = re.sub(r"\s+", " ", style).strip()
    lyrics = "\n".join(sections["lyrics"]).strip()
    lyrics = re.sub(r"\n{3,}", "\n\n", lyrics)

    duration_estimate = ""
    found = re.search(r"(?im)^(?:.*)?(durée estimée|estimated duration)\s*:\s*(.+)$",
                      cleaned)
    if found:
        duration_estimate = re.sub(r"\s+", " ", found.group(2)).strip("*_ ").strip()[:80]

    return {
        "title": title,
        "style": style,
        "lyrics": lyrics,
        "duration_estimate": duration_estimate,
        "parsed": bool(lyrics),
    }


def run_lyrics(body: dict):
    """Génère TITRE / STYLE / PAROLES avec le parolier local (llama.cpp)."""
    lang = "en" if (body.get("lang") or "") == "en" else "fr"
    prompt = (body.get("prompt") or "").strip()
    if not prompt:
        # Appel direct à l'API (sans l'interface) : on construit le prompt ici.
        style = (body.get("style") or "").strip()
        subject = (body.get("subject") or "").strip()
        if not style and not subject:
            return 400, {"error": {"message": "Indiquez au moins un style ou un sujet."}}
        prompt = build_lyrics_prompt(style, subject,
                                     (body.get("duration") or "").strip(), lang)

    wanted = body.get("model") or DEFAULT_LLM
    if wanted not in LLM_MODELS:
        wanted = DEFAULT_LLM
    installed = [mid for mid, spec in LLM_MODELS.items()
                 if (LLM_MODELS_DIR / spec["file"]).exists()]
    if find_llm_exe() is None or not installed:
        return 503, {"error": {
            "message": ("Parolier local non installé. Dans PowerShell, depuis le dossier "
                        "de l'application : .\\installer.ps1 -AvecParolier "
                        "(+ ~5 Go de modèle, une seule fois)."),
            "code": "llm_not_installed",
        }}
    # Repli automatique : si le modèle demandé est absent, on prend celui qui
    # est là (l'interface affiche lequel a servi).
    model_id = wanted if wanted in installed else installed[0]

    with _LLM_BUSY_LOCK:
        _LLM_BUSY[0] += 1
    try:
        ok, message = LLM.ensure(model_id)
        if not ok:
            return 503, {"error": {"message": message, "code": "llm_unavailable"}}

        spec = LLM_MODELS[model_id]
        content = prompt + ("\n/no_think" if spec.get("no_think") else "")
        seed = body.get("seed")
        if seed in (None, "", "random"):
            seed = int(time.time() * 1000) % (2 ** 31)
        else:
            try:
                seed = max(0, min(2 ** 31 - 1, int(seed)))
            except Exception:
                seed = int(time.time() * 1000) % (2 ** 31)
        try:
            temperature = float(body.get("temperature") or 1.0)
        except (TypeError, ValueError):
            temperature = 1.0
        temperature = max(0.0, min(2.0, temperature))

        started = time.time()
        status, result = http_json(
            f"{LLM.base_url}/v1/chat/completions",
            {"messages": [{"role": "user", "content": content}],
             "temperature": temperature,   # 1.0 = créatif ; baisser vers 0.7 = sage
             "top_p": 0.95,
             "max_tokens": 2048,
             "seed": seed,
             "stream": False},
            timeout=600.0,
        )
        elapsed = time.time() - started
    finally:
        with _LLM_BUSY_LOCK:
            _LLM_BUSY[0] -= 1

    if status != 200:
        message = "Le parolier n'a pas répondu."
        if isinstance(result, dict):
            err = result.get("error")
            if isinstance(err, dict) and err.get("message"):
                message = err["message"][:300]
            elif result.get("raw"):
                message = str(result["raw"])[:300]
        log(f"[!] Parolier : {message}")
        return status or 502, {"error": {"message": message}}

    text = ""
    try:
        text = (result.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    except Exception:
        text = ""
    if not text.strip():
        return 502, {"error": {"message": "Le parolier a renvoyé une réponse vide."}}

    parsed = parse_lyrics_output(text)
    log(f"[+] Parolier ({model_id}, {elapsed:.0f} s) : {parsed['title'] or '(sans titre)'}")
    return 200, {
        "model": model_id,
        "model_fallback": model_id != wanted,
        "gen_seconds": round(elapsed, 1),
        "seed": seed,
        **parsed,
        "raw": text,
    }


# ---------------------------------------------------------------------------
# Serveur HTTP
# ---------------------------------------------------------------------------


class Handler(BaseHTTPRequestHandler):
    server_version = "YueStudio/1.0"
    protocol_version = "HTTP/1.1"

    # --- helpers -----------------------------------------------------------
    def _send(self, status: int, body: bytes, ctype: str, extra=None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def _json(self, status: int, obj) -> None:
        self._send(
            status,
            json.dumps(obj, ensure_ascii=False).encode("utf-8"),
            "application/json; charset=utf-8",
        )

    def _read_body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def log_message(self, fmt, *args) -> None:  # silence le journal HTTP
        pass

    # --- anti-CSRF ---------------------------------------------------------
    def _host_name(self) -> str:
        """Nom d'hote de l'en-tete Host, sans le port."""
        raw = (self.headers.get("Host") or "").strip()
        if not raw:
            return ""
        try:
            return (urllib.parse.urlsplit("//" + raw).hostname or "").lower()
        except ValueError:
            return ""

    @staticmethod
    def _origin_name(value: str) -> str:
        try:
            return (urllib.parse.urlsplit(value).hostname or "").lower()
        except ValueError:
            return ""

    def _post_allowed(self) -> tuple:
        """Un POST doit venir de l'interface locale elle-meme.

        Trois barrieres, dans l'ordre ou elles se declenchent :
          - Sec-Fetch-Site / Origin : refus explicite d'une page tierce ;
          - Host : refus du DNS rebinding ;
          - Content-Type: application/json : un site tiers ne peut pas l'envoyer
            sans preflight CORS (en mode « no-cors » le navigateur n'accepte que
            text/plain, x-www-form-urlencoded ou multipart/form-data).
        """
        site = (self.headers.get("Sec-Fetch-Site") or "").strip().lower()
        if site == "cross-site":
            return False, "Requete refusee : origine croisee (Sec-Fetch-Site)."

        origin = (self.headers.get("Origin") or "").strip()
        if origin:
            if origin.lower() == "null":
                return False, "Requete refusee : origine opaque."
            o_name = self._origin_name(origin)
            if _LOCAL_NAMES:
                if o_name not in _LOCAL_NAMES:
                    return False, "Requete refusee : origine non locale."
            elif o_name != self._host_name():
                return False, "Requete refusee : origine differente de l'hote."

        if _LOCAL_NAMES:
            host = self._host_name()
            if host and host not in _LOCAL_NAMES:
                return False, "Requete refusee : en-tete Host inattendu."

        ctype = (self.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
        if ctype != ALLOWED_POST_TYPE:
            return False, "Requete refusee : Content-Type « application/json » attendu."
        return True, ""

    # --- routes ------------------------------------------------------------
    def do_GET(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        touch_activity()

        if path in ("/", "/index.html"):
            self._serve_file(APP_DIR / "index.html", "text/html; charset=utf-8")
        elif path == "/app.js":
            self._serve_file(APP_DIR / "app.js", "application/javascript; charset=utf-8")
        elif path == "/i18n.js":
            self._serve_file(APP_DIR / "i18n.js", "application/javascript; charset=utf-8")
        elif path == "/style.css":
            self._serve_file(APP_DIR / "style.css", "text/css; charset=utf-8")
        elif path == "/favicon.svg":
            self._serve_file(APP_DIR / "favicon.svg", "image/svg+xml")
        elif path == "/api/state":
            self._state()
        elif path == "/api/history":
            self._json(200, {"entries": load_history()})
        elif path == "/api/export":
            payload = json.dumps(
                {"export": "YueStudio", "version": 1, "entries": load_history()},
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8")
            self._send(
                200,
                payload,
                "application/json; charset=utf-8",
                {
                    "Content-Disposition": 'attachment; filename="historique-yuestudio.json"'
                },
            )
        elif path == "/api/pending":
            with JOBS_LOCK:
                jobs = [
                    {"job_id": jid, **{k: v for k, v in job.items() if k != "entry"}}
                    for jid, job in JOBS.items()
                ]
            self._json(200, {"jobs": jobs})
        elif path.startswith("/api/pending/"):
            job_id = path[len("/api/pending/") :]
            with JOBS_LOCK:
                job = dict(JOBS.get(job_id) or {})
            if not job:
                self._json(404, {"error": {"message": "Travail inconnu ou termine."}})
                return
            payload = {"job_id": job_id, "status": job.get("status")}
            if job.get("entry"):
                name = job["entry"].get("audio_file") or ""
                payload["entry"] = job["entry"]
                payload["audio_url"] = f"/audio/{urllib.parse.quote(name)}"
            if job.get("error"):
                payload["error"] = job["error"]
            self._json(200, payload)
        elif path.startswith("/audio/"):
            self._audio(path[len("/audio/") :])
        else:
            self._json(404, {"error": {"message": f"Route inconnue : {path}"}})

    def do_POST(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path != "/api/bye":
            touch_activity()          # le beacon de fermeture ne repousse pas le timer
        allowed, reason = self._post_allowed()
        if not allowed:
            log(f"[!] {reason} (POST {path})")
            self._json(403, {"error": {"message": reason}})
            return
        body = self._read_body()

        if path == "/api/generate":
            err_status, err_message = validate_generation(body)
            if err_status:
                log(f"[!] Demande refusee : {err_message}")
                self._json(err_status, {"error": {"message": err_message}})
                return

            job_id = uuid.uuid4().hex[:10]
            with JOBS_LOCK:
                JOBS[job_id] = {"status": "running", "started_at": now_iso()}
                # on ne garde que les 8 derniers travaux
                for old in sorted(
                    JOBS.items(), key=lambda kv: kv[1].get("started_at") or ""
                )[:-8]:
                    JOBS.pop(old[0], None)

            def worker(jid: str, payload: dict) -> None:
                try:
                    status, result = run_generation(payload)
                except Exception as exc:
                    status, result = 500, {"error": {"message": f"Erreur interne : {exc}"}}
                with JOBS_LOCK:
                    job = JOBS.setdefault(jid, {})
                    job["status"] = "done" if status == 200 else "error"
                    job["http_status"] = status
                    if status == 200:
                        job["entry"] = result.get("entry")
                        job["audio_url"] = result.get("audio_url")
                    else:
                        job["error"] = (result or {}).get("error") or {"message": "Erreur"}
                if status != 200:
                    log(f"[!] Echec : {job.get('error', {}).get('message')}")

            threading.Thread(target=worker, args=(job_id, body), daemon=True).start()
            self._json(202, {"job_id": job_id, "status": "running"})
        elif path == "/api/update":
            self._update(body)
        elif path == "/api/import":
            self._import(body)
        elif path == "/api/lyrics":
            status, result = run_lyrics(body)
            self._json(status, result)
        elif path == "/api/lyrics/unload":
            LLM.stop("arrêt demandé")
            self._json(200, {"ok": True, "message": "Parolier arrêté : la VRAM est libérée."})
        elif path == "/api/open-songs":
            ok = open_in_file_manager(SONGS_DIR)
            self._json(200, {"ok": ok, "path": str(SONGS_DIR)})
        elif path == "/api/open-root":
            ok = open_in_file_manager(ROOT)
            self._json(200, {"ok": ok, "path": str(ROOT)})
        elif path == "/api/unload":
            if has_running_job():
                self._json(
                    409,
                    {
                        "ok": False,
                        "message": "Une generation est en cours : attendez la fin "
                        "avant de decharger le modele.",
                    },
                )
                return
            LLM.stop("libération manuelle de la VRAM")
            ok = unload_engine_model(timeout=60)
            self._json(
                200,
                {
                    "ok": ok,
                    "message": "Modele decharge : la VRAM est liberee."
                    if ok
                    else "Le moteur n'a pas repondu.",
                },
            )
        elif path == "/api/bye":
            # Beacon envoye quand l'onglet du navigateur est ferme : on libere la
            # VRAM sans couper le moteur (il rechargera le modele a la demande).
            # Deux garde-fous : rien n'est fait pendant une generation, et le
            # dechargement est annule si la page revient (simple F5).
            started, skipped = unload_after_leave()
            self._json(200, {"ok": started, "deferred": started, "skipped": skipped})
        else:
            self._json(404, {"error": {"message": f"Route inconnue : {path}"}})

    def do_DELETE(self):  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/history/"):
            entry_id = path[len("/api/history/") :]
            entries = load_history()
            kept, removed = [], None
            for entry in entries:
                if entry.get("id") == entry_id:
                    removed = entry
                else:
                    kept.append(entry)
            if removed is None:
                self._json(404, {"error": {"message": "Entree introuvable."}})
                return
            save_history(kept)
            name = removed.get("audio_file")
            if name:
                try:
                    (SONGS_DIR / Path(name).name).unlink(missing_ok=True)
                except Exception:
                    pass
            self._json(200, {"ok": True, "id": entry_id})
        else:
            self._json(404, {"error": {"message": f"Route inconnue : {path}"}})

    # --- implementations ---------------------------------------------------
    def _serve_file(self, file_path: Path, ctype: str) -> None:
        if not file_path.exists():
            self._json(404, {"error": {"message": f"Fichier absent : {file_path.name}"}})
            return
        self._send(200, file_path.read_bytes(), ctype)

    def _audio(self, name: str) -> None:
        name = urllib.parse.unquote(name)
        safe = Path(name).name  # empeche toute sortie du dossier
        file_path = SONGS_DIR / safe
        if not safe or not file_path.exists() or not file_path.is_file():
            self._json(404, {"error": {"message": "Fichier audio introuvable."}})
            return
        size = file_path.stat().st_size
        extra = {
            "Accept-Ranges": "bytes",
            "Content-Disposition": f'inline; filename="{safe.encode("ascii", "ignore").decode() or "song.wav"}"',
        }
        rng = self.headers.get("Range")
        if rng:
            match = re.match(r"bytes=(\d*)-(\d*)", rng)
            if match and (match.group(1) or match.group(2)) and size > 0:
                if match.group(1):
                    start = int(match.group(1))
                    end = int(match.group(2)) if match.group(2) else size - 1
                else:
                    # plage suffixe : « bytes=-500 » = les 500 derniers octets
                    start = max(0, size - int(match.group(2)))
                    end = size - 1
                if start >= size or start > end:
                    # plage hors bornes : 416 comme le demande la RFC 9110
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                end = min(end, size - 1)
                length = end - start + 1
                # On ne lit QUE la plage demandee : un seek dans un WAV de
                # 55 Mo ne doit pas relire les 55 Mo a chaque deplacement.
                with file_path.open("rb") as handle:
                    handle.seek(start)
                    chunk = handle.read(length)
                self.send_response(206)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(len(chunk)))
                self.end_headers()
                try:
                    self.wfile.write(chunk)
                except Exception:
                    pass
                return
        self._send(200, file_path.read_bytes(), "audio/wav", extra)

    def _state(self) -> None:
        ready = ENGINE.exe is not None and engine_ready(ENGINE.port)
        health = {}
        if ready:
            _, health = http_json(f"{ENGINE.base_url}/health", timeout=5)

        installed = {}
        for qid, spec in QUALITIES.items():
            installed[qid] = (MODELS_DIR / spec["model_gguf"]).exists() and (
                MODELS_DIR / spec["vae_gguf"]
            ).exists()

        sidecars_ok = all(
            (MODELS_DIR / name).exists()
            for name in (
                "sidecars/yue2-model-config.json",
                "sidecars/yue2-generation-config.json",
                "sidecars/yue2-qwen.tiktoken",
                "sidecars/yue2-vae-config.json",
            )
        )

        llm_exe = find_llm_exe()
        llm_installed = {
            mid: (LLM_MODELS_DIR / spec["file"]).exists()
            for mid, spec in LLM_MODELS.items()
        }

        self._json(
            200,
            {
                "engine": {
                    "installed": ENGINE.exe is not None,
                    "ready": ready,
                    "backend": health.get("backend") or ENGINE.backend,
                    "port": ENGINE.port,
                    "reused": ENGINE.reused,
                },
                "llm": {
                    "installed": llm_exe is not None and any(llm_installed.values()),
                    "server_present": llm_exe is not None,
                    "ready": LLM.active(),
                    "port": LLM.port,
                    "active_model": LLM.model_id,
                    "default_model": DEFAULT_LLM,
                    "models": {
                        mid: {**spec, "installed": llm_installed[mid]}
                        for mid, spec in LLM_MODELS.items()
                    },
                },
                "models": {
                    "dir": str(MODELS_DIR),
                    "sidecars_ok": sidecars_ok,
                    "qualities": {
                        qid: {**spec, "installed": installed[qid]}
                        for qid, spec in QUALITIES.items()
                    },
                    "default_quality": DEFAULT_QUALITY,
                },
                "songs_dir": str(SONGS_DIR),
                "cot_labels": COT_LABELS,
                "counts": {"history": len(load_history())},
            },
        )

    def _update(self, body: dict) -> None:
        entry_id = body.get("id")
        changes = body.get("changes") or {}
        allowed = {"title", "note", "favori"}
        entries = load_history()
        found = False
        for entry in entries:
            if entry.get("id") == entry_id:
                for key, value in changes.items():
                    if key in allowed:
                        entry[key] = value
                found = True
                break
        if not found:
            self._json(404, {"error": {"message": "Entree introuvable."}})
            return
        save_history(entries)
        self._json(200, {"ok": True})

    def _import(self, body: dict) -> None:
        incoming = body.get("entries")
        if not isinstance(incoming, list):
            self._json(400, {"error": {"message": "Format d'import invalide."}})
            return
        entries = load_history()
        known = {e.get("id") for e in entries}
        added = 0
        for item in incoming:
            if not isinstance(item, dict) or not item.get("id"):
                continue
            if item["id"] in known:
                continue
            entries.append(item)
            known.add(item["id"])
            added += 1
        entries.sort(key=lambda e: e.get("created_at") or "", reverse=True)
        save_history(entries)
        self._json(200, {"ok": True, "added": added})


# ---------------------------------------------------------------------------
# Arret propre : decharger le modele, couper le moteur, tout nettoyer
# ---------------------------------------------------------------------------
#
# Le moteur audio.cpp tourne en sous-processus cache de ce script : il n'a pas
# sa propre fenetre. Fermer la fenetre de YueStudio doit donc tout arreter.
#
# Trois evenements declenchent la meme procedure :
#   - Ctrl+C                          (KeyboardInterrupt)
#   - fermeture de la fenetre Windows (CTRL_CLOSE_EVENT, via kernel32)
#   - arret / fermeture de session Windows, ou signal SIGTERM
#
# Ordre des operations : dechargement du modele (la VRAM est liberee proprement)
# puis arret du processus moteur, puis suppression du fichier yuestudio.pid.

_SHUTDOWN_DONE = threading.Event()


def unload_engine_model(timeout: float = 8.0) -> bool:
    """Demande au moteur de liberer la VRAM. Renvoie True si c'est confirme."""
    try:
        status, _ = http_json(
            f"{ENGINE.base_url}/v1/tasks/unload_all_models", {}, timeout=timeout
        )
        return status == 200
    except Exception:
        return False


def local_host_names(host: str) -> set:
    """Noms d'hote acceptes dans l'en-tete Host et dans Origin.

    Ecoute sur une adresse locale : seuls les noms de boucle locale sont valides.
    Ecoute sur une adresse explicite : ce nom uniquement. Ecoute sur toutes les
    interfaces (0.0.0.0) : ensemble vide, donc controle desactive (on se rabat
    alors sur la comparaison Origin == Host, qui reste une verification
    same-origin).
    """
    host = (host or "").strip().lower()
    if host in ("", "0.0.0.0", "::", "[::]"):
        return set()
    if host in ("localhost", "127.0.0.1", "::1", "[::1]") or host.startswith("127."):
        return {"localhost", "127.0.0.1", "::1"}
    return {host}


def touch_activity() -> None:
    """Note qu'une page de l'interface vient de parler au serveur."""
    global _LAST_ACTIVITY
    _LAST_ACTIVITY = time.monotonic()


def has_running_job() -> bool:
    """Vrai si une generation est en cours (elle serait tuee par un dechargement)."""
    with JOBS_LOCK:
        return any(job.get("status") == "running" for job in JOBS.values())


def unload_after_leave() -> tuple:
    """Fermeture de l'onglet : decharge le modele apres un delai de grace.

    Le delai distingue une vraie fermeture d'un simple F5 : quand la page se
    recharge, elle rappelle aussitot /api/state et /api/history, ce qui repousse
    le dechargement (et evite de perdre 30 a 60 s au lancement suivant).
    Aucun dechargement n'a lieu tant qu'une generation tourne.
    """
    global _UNLOAD_TIMER
    if has_running_job():
        return False, "job_en_cours"
    with _UNLOAD_LOCK:
        if _UNLOAD_TIMER is not None:
            _UNLOAD_TIMER.cancel()
        left_at = _LAST_ACTIVITY   # instant ou l'onglet a signale sa fermeture

        def later() -> None:
            global _UNLOAD_TIMER
            with _UNLOAD_LOCK:
                _UNLOAD_TIMER = None
            # Toute requete venue APRES le beacon = la page est revenue (F5,
            # retour arriere, nouvel onglet) : on garde le modele en memoire.
            if _LAST_ACTIVITY > left_at:
                log("[i] Onglet recharge : modele conserve en memoire.")
                return
            if unload_engine_model(timeout=5):
                log("[i] Onglet ferme : modele decharge, VRAM liberee.")

        timer = threading.Timer(UNLOAD_GRACE, later)
        timer.daemon = True
        _UNLOAD_TIMER = timer
        timer.start()
    return True, ""


def cleanup() -> None:
    """Arret complet, idempotent : utilisable depuis plusieurs gestionnaires."""
    if _SHUTDOWN_DONE.is_set():
        return
    _SHUTDOWN_DONE.set()
    try:
        log("[i] Dechargement du modele (liberation de la VRAM)...")
        if unload_engine_model():
            log("[OK] Modele decharge : la VRAM est liberee.")
        else:
            log("[i] Le moteur n'a pas repondu : la VRAM sera liberee a sa fermeture.")
    except Exception:
        pass
    try:
        ENGINE.stop()
    except Exception:
        pass
    try:
        LLM.stop("arrêt de YueStudio")
    except Exception:
        pass
    try:
        PID_FILE.unlink(missing_ok=True)
    except Exception:
        pass


HTTPD = None            # serveur HTTP actif (pose dans main())
_SHUTDOWN_STARTED = threading.Event()


def request_shutdown(reason: str, hard_exit: bool = False) -> None:
    """Declenche l'arret complet depuis n'importe quel fil ou gestionnaire.

    Le travail est fait dans un fil dedie : un gestionnaire de signal s'execute
    dans le fil principal, qui est justement celui qui doit sortir de
    serve_forever() - appeler httpd.shutdown() directement y provoquerait un
    blocage. Idempotent : un seul arret reel, meme si plusieurs evenements
    arrivent en meme temps (fenetre fermee + fin de session, par exemple).
    """
    if _SHUTDOWN_STARTED.is_set():
        return
    _SHUTDOWN_STARTED.set()

    def _run() -> None:
        try:
            log("")
            log(f"[i] {reason}")
            cleanup()
            try:
                if HTTPD is not None:
                    HTTPD.shutdown()
            except Exception:
                pass
            if hard_exit:
                # Fermeture de la fenetre Windows : le systeme tue les processus
                # de la console apres ~5 s, on sort donc sans attendre.
                try:
                    sys.stdout.flush()
                except Exception:
                    pass
                os._exit(0)
        except Exception:
            pass

    threading.Thread(target=_run, name="arret", daemon=True).start()


def _install_shutdown_handlers() -> None:
    """Branche Ctrl+C, fermeture de fenetre, fin de session et SIGTERM."""
    atexit.register(cleanup)

    def _on_signal(signum, _frame):  # noqa: ANN001
        noms = {1: "terminal ferme", 2: "Ctrl+C", 3: "Ctrl+Pause", 15: "signal d'arret"}
        nom = noms.get(signum, f"signal {signum}")
        request_shutdown(f"{nom} recu : arret de YueStudio...")

    signaux = [signal.SIGINT, signal.SIGTERM]
    for nom in ("SIGBREAK", "SIGHUP"):        # Ctrl+Pause (Windows), terminal ferme
        sig = getattr(signal, nom, None)
        if sig is not None:
            signaux.append(sig)
    for sig in signaux:
        if sig is not None:
            try:
                signal.signal(sig, _on_signal)
            except Exception:
                pass

    if os.name != "nt":
        return

    # Windows envoie CTRL_CLOSE_EVENT a tous les processus de la console quand
    # l'utilisateur clique sur la croix, puis laisse ~5 secondes avant de tuer.
    try:
        import ctypes
        from ctypes import wintypes

        HANDLER_ROUTINE = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)
        CTRL_C_EVENT = 0
        CTRL_BREAK_EVENT = 1
        CTRL_CLOSE_EVENT = 2
        CTRL_LOGOFF_EVENT = 5
        CTRL_SHUTDOWN_EVENT = 6

        def _console_handler(event):  # noqa: ANN001
            if event in (CTRL_CLOSE_EVENT, CTRL_LOGOFF_EVENT, CTRL_SHUTDOWN_EVENT):
                # Fenetre fermee, session fermee ou PC qui s'eteint.
                request_shutdown("Fenetre fermee : arret de YueStudio...", hard_exit=True)
                return True     # on a traite l'evenement
            if event in (CTRL_C_EVENT, CTRL_BREAK_EVENT):
                return False    # laisse Python lever KeyboardInterrupt
            return False

        # Reference conservee : sinon le rappel est libere par le ramasse-miettes.
        _install_shutdown_handlers._keepalive = HANDLER_ROUTINE(_console_handler)
        ctypes.windll.kernel32.SetConsoleCtrlHandler(
            _install_shutdown_handlers._keepalive, True
        )
    except Exception as exc:  # jamais bloquant
        log(f"[i] Gestion de la fermeture de fenetre indisponible : {exc}")


# ---------------------------------------------------------------------------
# Demarrage
# ---------------------------------------------------------------------------


def main() -> int:
    import argparse

    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="YueStudio - serveur local")
    parser.add_argument("--port", type=int, default=APP_PORT_DEFAULT)
    parser.add_argument("--host", default=HOST_DEFAULT,
                        help="adresse d'ecoute de l'interface (127.0.0.1 par defaut)")
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--no-engine", action="store_true")
    args = parser.parse_args()

    SONGS_DIR.mkdir(parents=True, exist_ok=True)
    if not HISTORY_FILE.exists():
        save_history([])
    try:
        PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
    except Exception:
        pass

    log("=" * 62)
    log("  YueStudio - creation de musique locale avec YuE2-3B")
    log("=" * 62)

    _install_shutdown_handlers()

    if not args.no_engine:
        ENGINE.start()
    else:
        log("[i] Mode --no-engine : moteur non demarre.")

    global HOST, _LOCAL_NAMES
    HOST = args.host
    _LOCAL_NAMES = local_host_names(HOST)   # noms d'hote autorises pour les POST
    port = args.port
    if not port_is_free(port):
        port = next((p for p in range(port + 1, port + 40) if port_is_free(p)), port)

    url = f"http://{HOST}:{port}/"
    global HTTPD
    try:
        httpd = ThreadingHTTPServer((HOST, port), Handler)
        HTTPD = httpd
    except OSError as exc:
        log(f"[!] Impossible d'ecouter sur le port {port} : {exc}")
        return 1

    log("")
    log(f"  Interface : {url}")
    log(f"  Chansons  : {SONGS_DIR}")
    log(f"  Historique: {HISTORY_FILE}")
    log("")
    log("  Laissez cette fenetre ouverte pendant que vous creez.")
    log("  Pour tout arreter : FERMEZ CETTE FENETRE (ou Ctrl+C).")
    log("  Le modele est alors decharge et le moteur coupe automatiquement.")
    log("")

    if not args.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log("\n[i] Ctrl+C : arret demande...")
    finally:
        try:
            httpd.shutdown()
        except Exception:
            pass
        cleanup()
        log("[i] Au revoir.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
