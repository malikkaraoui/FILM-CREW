#!/bin/bash
set -e

echo "=== VIDEO_TIKTOK — Installation ==="

# Vérification des prérequis
echo ""
echo "1. Vérification des prérequis..."

command -v node >/dev/null 2>&1 || { echo "Node.js requis — https://nodejs.org"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Python 3.12+ requis"; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "FFmpeg requis — brew install ffmpeg"; exit 1; }

# PostgreSQL — vérifier via le path Homebrew ou le path système
PSQL_CMD=""
if command -v psql >/dev/null 2>&1; then
  PSQL_CMD="psql"
elif [ -f /opt/homebrew/opt/postgresql@17/bin/psql ]; then
  PSQL_CMD="/opt/homebrew/opt/postgresql@17/bin/psql"
else
  echo "PostgreSQL 17 requis — brew install postgresql@17"
  exit 1
fi

echo "  Node.js $(node -v) ✓"
echo "  Python $(python3 --version | cut -d' ' -f2) ✓"
echo "  FFmpeg ✓"
echo "  PostgreSQL ✓"

# Dépendances Node
echo ""
echo "2. Installation des dépendances Node..."
npm install

# Python venv
echo ""
echo "3. Création du venv Python..."
python3 -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt

# Base de données
echo ""
echo "4. Création de la base de données..."
CREATEDB_CMD="${PSQL_CMD/psql/createdb}"
$CREATEDB_CMD video_tiktok 2>/dev/null || echo "  Base video_tiktok existe déjà"

# Schema Drizzle
echo ""
echo "5. Push du schema Drizzle..."
npx drizzle-kit push

# Fichier .env.local
echo ""
if [ ! -f .env.local ]; then
  echo "6. Création de .env.local depuis .env.example..."
  cp .env.example .env.local
  echo "  ⚠ Pensez à configurer vos clés API dans .env.local"
else
  echo "6. .env.local existe déjà ✓"
fi

# Dossiers storage
echo ""
echo "7. Création des dossiers storage..."
mkdir -p storage/brands storage/runs storage/stock

echo ""
echo "=== Installation terminée ==="
echo "Lancer l'application : npm run dev"
