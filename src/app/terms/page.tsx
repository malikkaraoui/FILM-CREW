import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conditions d’utilisation | FILM-CREW',
  description: 'Conditions d’utilisation de FILM-CREW.',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Conditions d’utilisation</h1>
        <p className="text-sm text-muted-foreground">
          Dernière mise à jour : 19 avril 2026
        </p>
      </header>

      <section className="space-y-4 text-sm leading-7 text-foreground/90">
        <p>
          FILM-CREW est une application web qui aide les créateurs à préparer,
          prévisualiser, gérer et publier des vidéos courtes. En utilisant le service,
          vous acceptez les présentes conditions d’utilisation.
        </p>

        <div>
          <h2 className="text-lg font-medium">Utilisation du service</h2>
          <p>
            Vous devez utiliser FILM-CREW conformément aux lois applicables, aux règles
            de la plateforme TikTok et aux politiques des fournisseurs tiers connectés à
            l’application.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Compte et contenus</h2>
          <p>
            Vous restez responsable des comptes tiers que vous connectez, des médias que
            vous importez, générez ou publiez, ainsi que des métadonnées et descriptions
            associées à vos publications.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Publication vers TikTok</h2>
          <p>
            Lorsqu’un compte TikTok est connecté, FILM-CREW peut envoyer des contenus vers
            TikTok uniquement après action explicite de l’utilisateur. Vous devez vérifier
            les contenus avant toute publication.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Disponibilité</h2>
          <p>
            Le service peut évoluer, être interrompu ou modifié à tout moment, notamment
            lors d’ajouts de fonctionnalités, de maintenance ou de changements imposés par
            des fournisseurs tiers.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-medium">Contact</h2>
          <p>
            Pour toute question relative à ces conditions, utilisez les coordonnées de
            contact affichées dans l’application ou dans les informations du projet.
          </p>
        </div>
      </section>
    </div>
  )
}
