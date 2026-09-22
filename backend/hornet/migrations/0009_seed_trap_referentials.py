"""Seed the trap types and the species referential.

Both are ordinary rows afterwards: an admin can add, edit or remove them from
the administration screen. The migration is idempotent (keyed on the slug) so
re-running it never duplicates a row, and it only fills fields that identify
the entry, leaving any admin edit of the name or description alone.
"""

from django.db import migrations

TRAP_TYPES = [
    ('homemade', 'Fait maison', "Piège confectionné par l'utilisateur, à partir de matériaux de récupération.", 10),
    ('bottle', 'Piège bouteille', "Bouteille en plastique percée, appât liquide au fond.", 20),
    ('vespacatch', 'VespaCatch (Véto-pharma)', "Piège commercial avec attractif spécifique.", 30),
    ('vespacatch-select', 'VespaCatch Select', "Version sélective du VespaCatch, limitant les captures non ciblées.", 40),
    ('tap-trap', 'Tap Trap / cloche', "Bouchon-piège jaune à visser sur une bouteille.", 50),
    ('cone-trap', 'Piège à cônes sélectif', "Piège en bois à cônes, laissant échapper les petits insectes.", 60),
    ('jabeprode', 'Jabeprode', "Piège sélectif de type Jabeprode, à appât sec.", 70),
    ('electric-harp', 'Harpe électrique', "Grille électrifiée placée devant les ruches.", 80),
]

WIKI = 'https://fr.wikipedia.org/wiki/'

# (slug, name, scientific name, wikipedia article, sort order)
SPECIES = [
    ('vespa-velutina', 'Frelon asiatique', 'Vespa velutina', 'Vespa_velutina', 10),
    ('vespa-crabro', 'Frelon européen', 'Vespa crabro', 'Vespa_crabro', 20),
    ('apis-mellifera', 'Abeille domestique', 'Apis mellifera', 'Abeille_européenne', 30),
    ('bombus-terrestris', 'Bourdon terrestre', 'Bombus terrestris', 'Bombus_terrestris', 40),
    ('vespula-germanica', 'Guêpe germanique', 'Vespula germanica', 'Vespula_germanica', 50),
    ('vespula-vulgaris', 'Guêpe commune', 'Vespula vulgaris', 'Vespula_vulgaris', 60),
    ('dolichovespula-media', 'Guêpe des buissons', 'Dolichovespula media', 'Dolichovespula_media', 70),
    ('polistes-dominula', 'Guêpe poliste', 'Polistes dominula', 'Polistes_dominula', 80),
    ('xylocopa-violacea', 'Xylocope violet', 'Xylocopa violacea', 'Xylocopa_violacea', 90),
    ('episyrphus-balteatus', 'Syrphe ceinturé', 'Episyrphus balteatus', 'Episyrphus_balteatus', 100),
    ('eristalis-tenax', 'Éristale tenace', 'Eristalis tenax', 'Eristalis_tenax', 110),
    ('syrphus-ribesii', 'Syrphe du groseillier', 'Syrphus ribesii', 'Syrphus_ribesii', 120),
    ('volucella-zonaria', 'Volucelle zonée', 'Volucella zonaria', 'Volucella_zonaria', 130),
    ('sphaerophoria-scripta', 'Syrphe porte-plume', 'Sphaerophoria scripta', 'Sphaerophoria_scripta', 140),
    ('musca-domestica', 'Mouche domestique', 'Musca domestica', 'Mouche_domestique', 150),
    ('calliphora-vomitoria', 'Mouche bleue', 'Calliphora vomitoria', 'Calliphora_vomitoria', 160),
    ('lucilia-sericata', 'Mouche verte', 'Lucilia sericata', 'Lucilia_sericata', 170),
    ('sarcophaga-carnaria', 'Mouche grise à damier', 'Sarcophaga carnaria', 'Sarcophaga_carnaria', 180),
    ('tipula', 'Tipule', 'Tipula sp.', 'Tipula', 190),
    ('culex-pipiens', 'Moustique commun', 'Culex pipiens', 'Culex_pipiens', 200),
    ('araneus-diadematus', 'Épeire diadème', 'Araneus diadematus', 'Épeire_diadème', 210),
    ('eratigena-atrica', 'Tégénaire', 'Eratigena atrica', 'Eratigena_atrica', 220),
    ('forficula-auricularia', 'Perce-oreille', 'Forficula auricularia', 'Forficula_auricularia', 230),
    ('coccinella-septempunctata', 'Coccinelle à sept points', 'Coccinella septempunctata', 'Coccinella_septempunctata', 240),
    ('chrysoperla-carnea', 'Chrysope verte', 'Chrysoperla carnea', 'Chrysoperla_carnea', 250),
    ('cetonia-aurata', 'Cétoine dorée', 'Cetonia aurata', 'Cetonia_aurata', 260),
    ('noctuidae', 'Papillon de nuit', 'Noctuidae', 'Noctuidae', 270),
    ('other', 'Autre / indéterminé', '', '', 999),
]


def seed(apps, schema_editor):
    TrapType = apps.get_model('hornet', 'TrapType')
    Species = apps.get_model('hornet', 'Species')

    for slug, name, description, order in TRAP_TYPES:
        TrapType.objects.update_or_create(
            slug=slug,
            defaults={'name': name, 'description': description, 'sort_order': order},
        )

    for slug, name, scientific, article, order in SPECIES:
        Species.objects.update_or_create(
            slug=slug,
            defaults={
                'name': name,
                'scientific_name': scientific,
                'wikipedia_url': WIKI + article if article else '',
                'sort_order': order,
            },
        )


def unseed(apps, schema_editor):
    """Remove the seeded rows that are still unused (a used one is protected)."""
    TrapType = apps.get_model('hornet', 'TrapType')
    Species = apps.get_model('hornet', 'Species')
    TrapType.objects.filter(slug__in=[t[0] for t in TRAP_TYPES], traps__isnull=True).delete()
    Species.objects.filter(slug__in=[s[0] for s in SPECIES], trap_events__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('hornet', '0008_traps'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
