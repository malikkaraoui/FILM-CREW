import Image from 'next/image'
import Link from 'next/link'

const features = [
  {
    title: 'Mur storyboard plein cadre',
    description:
      'La vitrine assume désormais un support de studio : panneaux, séquences, annotations, signaux et hiérarchie éditoriale à grande échelle.',
  },
  {
    title: 'Pipeline éditorial en cours de cristallisation',
    description:
      'FILM-CREW assemble aujourd’hui les briques qui relient brief, storyboard, son, clips et publication dans un seul flux opérable.',
  },
  {
    title: 'Lancement visé · septembre 2026',
    description:
      'La vitrine publique expose la trajectoire du projet pendant que le cockpit privé continue d’évoluer au rythme des chantiers et validations.',
  },
]

const milestones = [
  'Printemps 2026 · verrouillage du cockpit privé et du pipeline runs/chaînes',
  'Été 2026 · stabilisation du studio multi-agents et des flows publication',
  'Septembre 2026 · ouverture d’une version publique plus propre, plus claire, plus montrable',
]

export function PublicSiteHome() {
  return (
    <div className="bg-background text-foreground">
      <section className="border-b bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.15),transparent_30%),radial-gradient(circle_at_top_right,rgba(192,132,252,0.16),transparent_32%)]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:px-6 md:py-16 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Projet en construction publique
              </div>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl xl:text-6xl">
                FILM-CREW construit une plateforme de production vidéo IA pensée comme un vrai studio éditorial en mouvement.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
                Ici, on présente le projet actuel tel qu’il avance vraiment : un cockpit privé déjà opérable,
                une vitrine publique assumée, et une trajectoire claire vers un lancement miroir en <strong>septembre 2026</strong>.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/malikkaraoui/FILM-CREW"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Voir le GitHub
              </a>
              <Link
                href="/tiktok/connect"
                prefetch={false}
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Connecter TikTok
              </Link>
              <Link
                href="/terms"
                className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Lire les CGU
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Statut</div>
                <div className="mt-2 text-lg font-medium">Build public en cours</div>
              </div>
              <div className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cible</div>
                <div className="mt-2 text-lg font-medium">Septembre 2026</div>
              </div>
              <div className="rounded-2xl border bg-card/70 p-4 backdrop-blur">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Mode public</div>
                <div className="mt-2 text-lg font-medium">Vitrine + légal + OAuth</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] border bg-card/60 shadow-2xl shadow-slate-950/10 backdrop-blur">
            <Image
              src="/landing-hero-agents.svg"
              alt="Illustration large d'un mur storyboard et d'un cockpit éditorial FILM-CREW"
              width={1600}
              height={960}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">Le projet actuel</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Une plateforme qui s’organise comme une vraie réunion de production.
            </h2>
          </div>
          <a
            href="https://github.com/malikkaraoui/FILM-CREW"
            target="_blank"
            rel="noreferrer"
            className="hidden text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline md:inline"
          >
            Explorer le dépôt GitHub
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-3xl border bg-card p-6 shadow-sm">
              <h3 className="text-xl font-medium">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-8">
        <div className="overflow-hidden rounded-[2rem] border bg-slate-950">
          <Image
            src="/landing-virtual-meeting.svg"
            alt="Illustration grand format d'un mur de coordination éditoriale FILM-CREW avec séquences, pistes et blocs de pilotage"
            width={1600}
            height={900}
            className="h-auto w-full"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:px-6 md:py-16 xl:grid-cols-[0.95fr_1.05fr] xl:items-center">
        <div className="space-y-5">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">Support visuel</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Un langage de studio, pas des mascottes.
          </h2>
          <p className="text-base leading-8 text-muted-foreground">
            On abandonne les visuels de type personnages pour un support plus crédible et plus premium : murs storyboard,
            grandes timelines, blocs de décision, annotations de prod et matière éditoriale.
          </p>
          <p className="text-base leading-8 text-muted-foreground">
            L’idée n’est pas de montrer un simple dashboard. L’idée est de rendre visible un <strong>studio de fabrication</strong>
            où coordination, narration, image, son et montage dialoguent avant la génération finale.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border bg-card p-6">
            <div className="text-sm font-medium">Coordination</div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Un panneau central distribue les priorités, consolide le brief et rend l’état de fabrication lisible d’un coup d’œil.
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-6">
            <div className="text-sm font-medium">Narration & rythme</div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Le storytelling se lit comme une progression de séquences, pas comme une pile de prompts jetés sur la table.
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-6">
            <div className="text-sm font-medium">Image & cadrage</div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              L’image reste pensée comme une production : scènes, arrières-plans, plans lisibles, continuité visuelle.
            </p>
          </div>
          <div className="rounded-3xl border bg-card p-6">
            <div className="text-sm font-medium">Montée publique</div>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Cette façade sert maintenant à raconter cette ambition avec une grammaire visuelle plus sérieuse, plus nette et plus montrable.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/25">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 md:px-6 md:py-16 xl:grid-cols-[1.05fr_0.95fr] xl:items-center">
          <div className="overflow-hidden rounded-[2rem] border bg-slate-950">
            <Image
              src="/landing-launch-september-2026.svg"
              alt="Illustration grand format d'une frise de lancement FILM-CREW vers septembre 2026"
              width={1600}
              height={820}
              className="h-auto w-full"
            />
          </div>

          <div className="space-y-5">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">Cap public</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              On fait miroiter un lancement en septembre 2026, sans faire semblant que tout est déjà figé.
            </h2>
            <p className="text-base leading-8 text-muted-foreground">
              La page vitrine assume le bon niveau de promesse : le projet existe, le moteur travaille déjà,
              la façade publique se professionnalise maintenant, et le prochain grand cap lisible est <strong>septembre 2026</strong>.
            </p>

            <ul className="space-y-3">
              {milestones.map((milestone) => (
                <li key={milestone} className="rounded-2xl border bg-card px-4 py-3 text-sm leading-7 text-muted-foreground">
                  {milestone}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-16">
        <div className="rounded-[2rem] border bg-card px-6 py-8 md:px-8 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">Liens publics</p>
              <h2 className="text-3xl font-semibold tracking-tight">Une vitrine qui renvoie au projet réel.</h2>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground">
                Le but de cette page est simple : présenter proprement FILM-CREW, renvoyer vers le GitHub,
                garder les pages légales visibles, et servir d’adresse officielle quand TikTok ou des partenaires demandent une présence publique.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a
                href="https://github.com/malikkaraoui/FILM-CREW"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Ouvrir GitHub
              </a>
              <Link href="/privacy" className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
                Privacy
              </Link>
              <Link href="/terms" className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
                CGU
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
