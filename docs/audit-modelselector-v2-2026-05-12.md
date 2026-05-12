# Audit ModelSelector V2 — 2026-05-12

## Volumes mesurés

- **OpenRouter live** : non-mesurable (accès réseau bloqué en sandbox ; de plus, `src/app/api/llm/models/route.ts` n'effectue pas de fetch vers openrouter.ai — il retourne `getAvailableOpenRouterLlmModels()`, liste statique pilotée par les variables d'env). Volume de secours sans env : **4 modèles** (nvidia/nemotron-3-nano-30b-a3b:free, google/gemini-2.0-flash-lite-001, meta-llama/llama-3.3-70b-instruct, qwen/qwen-2.5-72b-instruct). Aucun filtre `architecture.output_modalities` ou `pricing` applicable : la route ne consomme pas l'API publique OpenRouter.
- **Cloud (statique)** : **2 modèles** (source : `src/lib/llm/target.ts` → `getAvailableCloudLlmModels()` sans env). Modèles : deepseek-v3.1:671b-cloud, gemma4:31b-cloud.
- **Local (Ollama)** : non-mesuré côté remote.

## Friction observée

Aucune friction documentée.

- `git log --since=2026-04-28` → **0 commit** sur les chemins LLM (dernier commit repo : 2026-04-26, hash 607444a).
- Grep mots-clés friction (scroll, combobox, filter, search, model select) → **0 résultat**.
- GitHub PR #1–#4 : HyperFrames, audio-first, C1-publication, C1-audit. Aucune PR relative à ModelSelector.
- Issues : aucune issue GitHub matchant "ModelSelector OR model selector OR LLM picker".

**Drift critique — V1 elle-même absente** : les fichiers décrits comme "V1 figée le 2026-04-28" n'existent pas dans le dépôt :

| Fichier attendu | Statut |
|---|---|
| `src/components/llm/model-selector.tsx` | absent |
| `src/lib/client/use-llm-catalog.ts` | absent |
| `src/lib/llm/catalog.ts` | absent |

En lieu et place, le type `LlmCatalog` et la fonction `loadLlmCatalog()` sont **dupliqués indépendamment** dans 4 fichiers :

- `src/app/settings/page.tsx:28` — `type LlmCatalog`, `getModelsForMode()`, `loadLlmCatalog()` inline
- `src/app/runs/[id]/page.tsx:47` — idem
- `src/app/runs/[id]/studio/page.tsx:13` — idem
- `src/app/runs/new/page.tsx:44` — variante `buildModelOptions()`, fetch `/api/llm/models` inline

La page `src/app/runs/[id]/control/page.tsx` n'existe pas (répertoire absent). Pas de drift consommateur additionnel.

## Décision : NO GO

Trois critères suffisent :

1. **Volume statique OpenRouter ≤ 8** (4 modèles sans env, fetch live non implémenté dans la route) — le seuil GO exige > 8 modèles utiles.
2. **Aucune friction documentée** — zéro commit fix, zéro issue, zéro PR liés à la sélection de modèle depuis le 2026-04-28.
3. **V1 elle-même non implémentée** — le composant `<ModelSelector>`, le hook `useLlmCatalog` et le catalogue partagé décrits comme pré-requis sont absents du dépôt. Toute décision V2 est prématurée sans cette base.

## Plan

NO GO V2. La priorité est d'implémenter V1 avant d'envisager V2.

**Drifts à corriger avant V1 :**

1. Extraire `type LlmCatalog` dans `src/lib/llm/catalog.ts` (ou `src/types/run.ts`). Supprimer les 4 déclarations locales.
2. Extraire `loadLlmCatalog()` + `getModelsForMode()` dans `src/lib/client/use-llm-catalog.ts` (hook React ou fonction utilitaire pure). Supprimer les duplicatas dans `settings/page.tsx`, `runs/[id]/page.tsx`, `runs/[id]/studio/page.tsx`, `runs/new/page.tsx`.
3. Créer le composant `src/components/llm/model-selector.tsx` encapsulant le `<select>` natif + les props (mode, model, catalog, onChange) — remplacement dans les 4 pages.
4. Ajouter les tests manquants (6 cas décrits dans la mission V1).

**Concernant le volume OpenRouter :** si V1 doit exposer des modèles live (et non statiques), la route `src/app/api/llm/models/route.ts` doit être étendue pour interroger `https://openrouter.ai/api/v1/models` avec le filtre `architecture.output_modalities includes 'text'` + `pricing.prompt == 0`. Ce chantier est orthogonal à l'extraction du composant.
