/** User documentation of the statistics module. */
export default function StatsDoc() {
  return (
    <>
      <p className="lead text-muted">
        Suivez les captures de frelons asiatiques, comparez les pièges et voyez la couverture du
        territoire, sur la période de votre choix.
      </p>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📈</span>
          Captures de frelons asiatiques
        </h5>
        <p>
          Pour chaque jour, semaine ou mois : les frelons asiatiques capturés, les pièges en service et
          surtout les <strong>frelons par piège et par semaine</strong>. Ce rapport ne dépend pas du
          nombre de pièges posés ni de la fréquence des relevés : il se compare d&apos;une semaine et
          d&apos;une année à l&apos;autre. L&apos;année précédente est affichée à côté, sur la même
          période.
        </p>
        <p className="mb-0">
          Les frelons d&apos;un relevé sont répartis sur les jours écoulés depuis le relevé précédent du
          piège. Un relevé sans capture compte donc autant qu&apos;une capture : enregistrez-le.
          Entre crochets figure l&apos;intervalle de confiance à 95 %.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🐝</span>
          Captures par espèce
        </h5>
        <p className="mb-0">
          Les frelons asiatiques et les prises accessoires, espèce par espèce. La part de chaque
          espèce parmi les insectes comptés ne porte que sur les relevés où toutes les espèces ont
          été comptées : cochez-le au relevé, sinon seules les captures totales sont connues.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">⚖️</span>
          Types de piège
        </h5>
        <p className="mb-0">
          L&apos;<strong>efficacité</strong> de chaque modèle (frelons par piège et par semaine) et sa{' '}
          <strong>sélectivité</strong> : la part de frelons asiatiques parmi tous les insectes comptés,
          sur les seuls relevés où toutes les espèces ont été comptées. Deux modèles dont les
          intervalles de confiance se chevauchent largement ne sont pas départagés.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🏆</span>
          Pièges les plus actifs
        </h5>
        <p className="mb-0">
          Chaque piège que vous voyez sur la carte, classé par frelons capturés par semaine de
          présence (ce qui ne favorise pas les pièges posés plus tôt) ou par captures totales. Un
          piège en place depuis moins de 7 jours n&apos;a pas encore de taux.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">📊</span>
          Tableau ou graphique
        </h5>
        <p className="mb-0">
          Chaque tableau existe en graphique. La bande claire autour d&apos;une courbe, ou le trait
          autour d&apos;un point, est l&apos;intervalle de confiance à 95 % : deux valeurs dont les
          intervalles se chevauchent largement ne sont pas départagées. Touchez une barre pour la
          détailler.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🗺️</span>
          Couverture et pression
        </h5>
        <p>
          Deux cartes en mailles de 250 m, sur la carte affichée ou sur une zone autour de vous.
          La <strong>couverture</strong> donne la part du territoire à portée d&apos;un piège en
          service pendant la période : chaque piège couvre un disque de 100, 250 ou 500 m. Cette
          portée est une hypothèse de travail, pas une mesure. La <strong>pression</strong> lisse
          les frelons asiatiques par piège et par semaine autour des pièges ; une maille trop
          loin des pièges reste transparente.
        </p>
        <p className="mb-0">
          Les deux cartes existent aussi comme couches du module <em>Carte</em>, dans la feuille
          des couches (section « Analyse du piégeage »). Elles ne comptent que les pièges que vous
          voyez sur la carte.
        </p>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">🗓️</span>
          Périodes et filtres
        </h5>
        <ul className="mb-0">
          <li>7 ou 30 derniers jours, mois en cours, dates libres</li>
          <li><strong>Saison</strong> : printemps (1er février – 15 juin), été (16 juin – 30 septembre), été-automne-hiver (16 juin – 31 décembre)</li>
          <li><strong>Année</strong> : le cycle de vie du frelon, assimilé à l&apos;année civile</li>
          <li>Type de piège, groupe, vos seuls pièges, zone autour de votre position</li>
        </ul>
      </section>

      <section className="mb-4">
        <h5 className="text-primary">
          <span className="me-2">👁️</span>
          Pièges comptés
        </h5>
        <p className="mb-0">
          Un total sur tout le territoire compte tous les pièges, y compris ceux réservés à un groupe :
          il ne situe aucun piège. Dès qu&apos;une zone est choisie, seuls les pièges que vous voyez sur
          la carte sont comptés, car un piège situe souvent un rucher.
        </p>
      </section>

      <section>
        <h5 className="text-primary">
          <span className="me-2">📤</span>
          Exporter
        </h5>
        <p>
          Le bouton d&apos;export donne le tableau affiché en Excel, en PDF (avec ses graphiques)
          ou en CSV, avec la période, les filtres et les pièges comptés. Le lien du fichier reste
          valable 15 minutes. Les cartes s&apos;exportent en Excel et en CSV.
        </p>
        <p className="mb-0">
          <strong>Envoyer un lien par email</strong> : vous recevez un lien vers une page de
          téléchargement, pour reprendre l&apos;export plus tard sur un ordinateur. Il sert une
          heure et dix téléchargements, sans connexion, avec vos droits : ne le transférez pas.
        </p>
      </section>
    </>
  );
}
