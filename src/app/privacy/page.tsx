import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politique de confidentialité | FILM-CREW',
  description: 'Politique de confidentialité de FILM-CREW.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour : 19 avril 2026
        </p>
      </header>

      <section className="space-y-4 text-sm leading-7 text-foreground/90">
        <p>
          FILM-CREW traite les informations nécessaires au fonctionnement de l’application,
          à la génération de contenus, à la gestion des projets vidéo et, si l’utilisateur
          l’autorise, à la connexion avec des services tiers comme TikTok.
        </p>

        <div>
          <h2 className="text-lg font-medium">Données traitées</h2>
          <p>
            Les données peuvent inclure les informations de configuration du compte, les
            médias importés ou générés, les métadonnées de publication, ainsi que les
            jetons techniques requis pour connecter des services tiers.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Utilisation des données</h2>
          <p>
            Les données sont utilisées pour fournir les fonctionnalités demandées par
            l’utilisateur : création, prévisualisation, organisation et publication de
            contenus vidéo.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Services tiers</h2>
          <p>
            Si vous connectez TikTok ou un autre fournisseur tiers, certaines données
            techniques sont échangées uniquement pour exécuter l’authentification et les
            actions que vous déclenchez explicitement.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Conservation et sécurité</h2>
          <p>
            FILM-CREW applique des mesures raisonnables pour protéger les données et limite
            leur usage au fonctionnement du service. Les utilisateurs restent responsables
            de la sécurité de leurs comptes tiers et de leurs appareils.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Contact</h2>
          <p>
            Pour toute question liée à la confidentialité ou à vos données, utilisez les
            coordonnées de contact affichées dans l’application ou dans les informations du
            projet.
          </p>
        </div>
      </section>
    </div>
  )
}
