/** User documentation of the statistics module. */
export default function StatsDoc() {
  return (
    <>
      <p className="lead text-muted">
        Suivez les captures de frelons asiatiques et comparez les pièges, sur la période de votre choix.
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
        <p className="mb-0">
          Le bouton d&apos;export donne le tableau affiché en Excel ou en CSV, avec la période, les
          filtres et les pièges comptés. Le lien du fichier reste valable 15 minutes.
        </p>
      </section>
    </>
  );
}
