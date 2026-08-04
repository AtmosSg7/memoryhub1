/**
 * Official Basera product-showcase fixtures.
 * Coherent “Atelier Moreau” story — months of real usage, no empty cards.
 * Monetary amounts in API shapes are in cents (×100).
 */

export const DEMO_SEARCH_QUERY = "Martin Ébénisterie";
export const DEMO_CLIENT_ID = "demo-client-martin-ebenisterie";

const NOW = "2026-08-04T10:00:00.000Z";
const DAYS_AGO = (n, hour = 10) => {
  const d = new Date(Date.now() - n * 86400000);
  d.setHours(hour, (n * 7) % 60, 0, 0);
  return d.toISOString();
};

const EUR = (euros) => Math.round(euros * 100);

function monthLabel(iso, fr) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  return d.toLocaleDateString(fr ? "fr-FR" : "en-GB", { month: "short", year: "2-digit" });
}

export function getDemoData(lang = "fr") {
  const fr = lang !== "en";

  const client = {
    id: DEMO_CLIENT_ID,
    name: "Martin Ébénisterie",
    company: "Martin Ébénisterie",
    contactName: "Didier Martin",
    email: "didier@martin-ebenisterie-demo.fr",
    phone: "+33 6 42 18 09 33",
    status: "active",
    activity: fr ? "Ébénisterie" : "Cabinetmaking",
    tags: fr ? ["Artisan", "Prioritaire"] : ["Craftsman", "Priority"],
    isFavorite: true,
    city: "Nantes",
    address: "12 rue des Ateliers",
    postalCode: "44000",
    country: "FR",
    notes: fr
      ? "Devis accepté. Rappeler mardi pour confirmer le créneau. Acompte reçu, solde en attente."
      : "Quote accepted. Call Tuesday to confirm the slot. Deposit received, balance pending.",
    lastActivityAt: DAYS_AGO(0, 9),
    updatedAt: DAYS_AGO(0, 9),
    createdAt: "2024-03-12T09:00:00.000Z",
    documentsCount: 6,
    notesCount: 4,
    totalRevenue: EUR(12480),
    emails: [{ id: "e1", value: "didier@martin-ebenisterie-demo.fr", isPrimary: true }],
    phones: [{ id: "p1", value: "+33 6 42 18 09 33", isPrimary: true }],
    addresses: [
      {
        id: "a1",
        city: "Nantes",
        line1: "12 rue des Ateliers",
        postalCode: "44000",
        country: "FR",
        isPrimary: true,
      },
    ],
  };

  const clients = [
    client,
    {
      id: "demo-client-dupont",
      name: "Dupont Rénovation",
      company: "Dupont Rénovation",
      contactName: "Claire Dupont",
      email: "claire@dupont-renov-demo.fr",
      phone: "+33 6 22 11 00 44",
      status: "active",
      activity: fr ? "Rénovation" : "Renovation",
      tags: fr ? ["Pro", "Chantier"] : ["Pro", "Jobsite"],
      isFavorite: true,
      city: "Angers",
      lastActivityAt: DAYS_AGO(2),
      updatedAt: DAYS_AGO(2),
      createdAt: "2024-06-01T09:00:00.000Z",
      documentsCount: 8,
      notesCount: 5,
      totalRevenue: EUR(15400),
      emails: [{ id: "e-dupont", value: "claire@dupont-renov-demo.fr", isPrimary: true }],
      phones: [{ id: "p-dupont", value: "+33 6 22 11 00 44", isPrimary: true }],
    },
    {
      id: "demo-client-loire",
      name: "Habitation Loire",
      company: "Habitation Loire",
      contactName: "Paul Guérin",
      email: "paul@habitation-loire-demo.fr",
      phone: "+33 6 77 88 99 00",
      status: "active",
      activity: fr ? "Promoteurs" : "Developers",
      tags: fr ? ["Promoteur"] : ["Developer"],
      isFavorite: false,
      city: "Nantes",
      lastActivityAt: DAYS_AGO(3),
      updatedAt: DAYS_AGO(3),
      createdAt: "2024-09-14T09:00:00.000Z",
      documentsCount: 7,
      notesCount: 3,
      totalRevenue: EUR(11200),
      emails: [{ id: "e-loire", value: "paul@habitation-loire-demo.fr", isPrimary: true }],
      phones: [{ id: "p-loire", value: "+33 6 77 88 99 00", isPrimary: true }],
    },
    {
      id: "demo-client-bernard",
      name: "Marc Bernard",
      company: "Bernard & Fils",
      contactName: "Marc Bernard",
      email: "marc@bernard-fils-demo.fr",
      phone: "+33 6 55 66 77 88",
      status: "active",
      activity: fr ? "Menuiserie" : "Carpentry",
      tags: fr ? ["Particulier"] : ["Residential"],
      isFavorite: false,
      city: "Nantes",
      lastActivityAt: DAYS_AGO(4),
      updatedAt: DAYS_AGO(4),
      createdAt: "2024-11-02T09:00:00.000Z",
      documentsCount: 5,
      notesCount: 2,
      totalRevenue: EUR(8900),
      emails: [{ id: "e-bernard", value: "marc@bernard-fils-demo.fr", isPrimary: true }],
      phones: [{ id: "p-bernard", value: "+33 6 55 66 77 88", isPrimary: true }],
    },
    {
      id: "demo-client-pinel",
      name: "Atelier Pinel",
      company: "Atelier Pinel",
      contactName: "Élodie Pinel",
      email: "elodie@atelier-pinel-demo.fr",
      phone: "+33 6 33 44 55 66",
      status: "active",
      activity: fr ? "Agencement" : "Fit-out",
      tags: fr ? ["Agencement"] : ["Fit-out"],
      isFavorite: false,
      city: "Saint-Nazaire",
      lastActivityAt: DAYS_AGO(5),
      updatedAt: DAYS_AGO(5),
      createdAt: "2025-02-18T09:00:00.000Z",
      documentsCount: 4,
      notesCount: 2,
      totalRevenue: EUR(7800),
      emails: [{ id: "e-pinel", value: "elodie@atelier-pinel-demo.fr", isPrimary: true }],
      phones: [{ id: "p-pinel", value: "+33 6 33 44 55 66", isPrimary: true }],
    },
    {
      id: "demo-client-leroy",
      name: "Sophie Leroy",
      company: "Leroy Design",
      contactName: "Sophie Leroy",
      email: "sophie@leroy-design-demo.fr",
      phone: "+33 6 11 22 33 44",
      status: "active",
      activity: fr ? "Design d'intérieur" : "Interior design",
      tags: fr ? ["Design"] : ["Design"],
      isFavorite: false,
      city: "Lyon",
      lastActivityAt: DAYS_AGO(1),
      updatedAt: DAYS_AGO(1),
      createdAt: "2025-01-08T09:00:00.000Z",
      documentsCount: 3,
      notesCount: 2,
      totalRevenue: EUR(6200),
      emails: [{ id: "e-leroy", value: "sophie@leroy-design-demo.fr", isPrimary: true }],
      phones: [{ id: "p-leroy", value: "+33 6 11 22 33 44", isPrimary: true }],
    },
    {
      id: "demo-client-cuisine",
      name: "Cuisine & Co",
      company: "Cuisine & Co",
      contactName: "Nadia Benali",
      email: "nadia@cuisine-co-demo.fr",
      phone: "+33 6 98 76 54 32",
      status: "active",
      activity: fr ? "Cuisiniste" : "Kitchen retailer",
      tags: fr ? ["Partenaire"] : ["Partner"],
      isFavorite: false,
      city: "Rezé",
      lastActivityAt: DAYS_AGO(6),
      updatedAt: DAYS_AGO(6),
      createdAt: "2025-04-22T09:00:00.000Z",
      documentsCount: 3,
      notesCount: 1,
      totalRevenue: EUR(4300),
      emails: [{ id: "e-cuisine", value: "nadia@cuisine-co-demo.fr", isPrimary: true }],
      phones: [{ id: "p-cuisine", value: "+33 6 98 76 54 32", isPrimary: true }],
    },
    {
      id: "demo-client-rousseau",
      name: "Menuiserie Rousseau",
      company: "Menuiserie Rousseau",
      contactName: "Antoine Rousseau",
      email: "antoine@rousseau-demo.fr",
      phone: "+33 6 12 34 56 78",
      status: "active",
      activity: fr ? "Menuiserie" : "Carpentry",
      tags: fr ? ["Nouveau"] : ["New"],
      isFavorite: false,
      city: "Vertou",
      lastActivityAt: DAYS_AGO(1, 15),
      updatedAt: DAYS_AGO(1, 15),
      createdAt: DAYS_AGO(12),
      documentsCount: 1,
      notesCount: 1,
      totalRevenue: EUR(2100),
      emails: [{ id: "e-rousseau", value: "antoine@rousseau-demo.fr", isPrimary: true }],
      phones: [{ id: "p-rousseau", value: "+33 6 12 34 56 78", isPrimary: true }],
    },
  ];

  const quotes = [
    {
      id: "demo-doc-quote",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      number: "DM-142",
      title: fr ? "Cuisine sur mesure" : "Custom kitchen",
      status: "accepted",
      amountTTC: EUR(4850),
      amountHT: EUR(4041.67),
      currency: "EUR",
      issueDate: DAYS_AGO(18),
      createdAt: DAYS_AGO(22),
      updatedAt: DAYS_AGO(14),
      lineItems: [
        {
          description: fr ? "Cuisine sur mesure — fabrication & pose" : "Custom kitchen — build & install",
          quantity: 1,
          unitPriceHT: EUR(4041.67),
          amountHT: EUR(4041.67),
        },
      ],
    },
    {
      id: "demo-quote-leroy",
      clientId: "demo-client-leroy",
      clientName: "Leroy Design",
      number: "DM-158",
      title: fr ? "Bibliothèque chêne" : "Oak bookshelf",
      status: "sent",
      amountTTC: EUR(3200),
      amountHT: EUR(2666.67),
      currency: "EUR",
      issueDate: DAYS_AGO(5),
      createdAt: DAYS_AGO(5),
      updatedAt: DAYS_AGO(5),
      lineItems: [
        {
          description: fr ? "Bibliothèque chêne massif" : "Solid oak bookshelf",
          quantity: 1,
          unitPriceHT: EUR(2666.67),
          amountHT: EUR(2666.67),
        },
      ],
    },
    {
      id: "demo-quote-dupont",
      clientId: "demo-client-dupont",
      clientName: "Dupont Rénovation",
      number: "DM-155",
      title: fr ? "Escalier + garde-corps" : "Staircase + railing",
      status: "accepted",
      amountTTC: EUR(6800),
      amountHT: EUR(5666.67),
      currency: "EUR",
      issueDate: DAYS_AGO(28),
      createdAt: DAYS_AGO(30),
      updatedAt: DAYS_AGO(25),
      lineItems: [
        {
          description: fr ? "Escalier droit + garde-corps" : "Straight staircase + railing",
          quantity: 1,
          unitPriceHT: EUR(5666.67),
          amountHT: EUR(5666.67),
        },
      ],
    },
    {
      id: "demo-quote-loire",
      clientId: "demo-client-loire",
      clientName: "Habitation Loire",
      number: "DM-149",
      title: fr ? "Lot menuiserie intérieure — T3" : "Interior joinery lot — 3-room",
      status: "accepted",
      amountTTC: EUR(9200),
      amountHT: EUR(7666.67),
      currency: "EUR",
      issueDate: DAYS_AGO(40),
      createdAt: DAYS_AGO(42),
      updatedAt: DAYS_AGO(35),
      lineItems: [
        {
          description: fr ? "Portes, plinthes, placards" : "Doors, skirting, closets",
          quantity: 1,
          unitPriceHT: EUR(7666.67),
          amountHT: EUR(7666.67),
        },
      ],
    },
    {
      id: "demo-quote-bernard",
      clientId: "demo-client-bernard",
      clientName: "Bernard & Fils",
      number: "DM-161",
      title: fr ? "Dressing sous combles" : "Attic dressing room",
      status: "draft",
      amountTTC: EUR(4100),
      amountHT: EUR(3416.67),
      currency: "EUR",
      issueDate: DAYS_AGO(1),
      createdAt: DAYS_AGO(1),
      updatedAt: DAYS_AGO(1),
      lineItems: [
        {
          description: fr ? "Dressing sur mesure" : "Custom dressing",
          quantity: 1,
          unitPriceHT: EUR(3416.67),
          amountHT: EUR(3416.67),
        },
      ],
    },
    {
      id: "demo-quote-pinel",
      clientId: "demo-client-pinel",
      clientName: "Atelier Pinel",
      number: "DM-150",
      title: fr ? "Banque d'accueil" : "Reception desk",
      status: "sent",
      amountTTC: EUR(5400),
      amountHT: EUR(4500),
      currency: "EUR",
      issueDate: DAYS_AGO(9),
      createdAt: DAYS_AGO(10),
      updatedAt: DAYS_AGO(9),
      lineItems: [
        {
          description: fr ? "Banque d'accueil chêne" : "Oak reception desk",
          quantity: 1,
          unitPriceHT: EUR(4500),
          amountHT: EUR(4500),
        },
      ],
    },
    {
      id: "demo-quote-rousseau",
      clientId: "demo-client-rousseau",
      clientName: "Menuiserie Rousseau",
      number: "DM-162",
      title: fr ? "Sous-traitance façades" : "Facade subcontract",
      status: "sent",
      amountTTC: EUR(2100),
      amountHT: EUR(1750),
      currency: "EUR",
      issueDate: DAYS_AGO(2),
      createdAt: DAYS_AGO(2),
      updatedAt: DAYS_AGO(2),
      lineItems: [
        {
          description: fr ? "Façades placards — 12 unités" : "Closet fronts — 12 units",
          quantity: 12,
          unitPriceHT: EUR(145.83),
          amountHT: EUR(1750),
        },
      ],
    },
  ];

  const invoices = [
    {
      id: "demo-doc-invoice",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      number: "FA-2026-020",
      title: fr ? "Solde travaux — cuisine" : "Work balance — kitchen",
      status: "in_progress",
      amountTTC: EUR(2425),
      amountHT: EUR(2020.83),
      amountPaid: 0,
      currency: "EUR",
      issueDate: DAYS_AGO(2),
      createdAt: DAYS_AGO(2),
      updatedAt: DAYS_AGO(2),
      lineItems: [
        {
          description: fr ? "Solde 50 % — cuisine sur mesure" : "50% balance — custom kitchen",
          quantity: 1,
          unitPriceHT: EUR(2020.83),
          amountHT: EUR(2020.83),
        },
      ],
    },
    {
      id: "demo-invoice-acompte",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      number: "FA-2026-019",
      title: fr ? "Acompte — cuisine sur mesure" : "Deposit — custom kitchen",
      status: "paid",
      amountTTC: EUR(2425),
      amountHT: EUR(2020.83),
      amountPaid: EUR(2425),
      currency: "EUR",
      issueDate: DAYS_AGO(12),
      createdAt: DAYS_AGO(12),
      updatedAt: DAYS_AGO(11),
      lineItems: [
        {
          description: fr ? "Acompte 50 %" : "50% deposit",
          quantity: 1,
          unitPriceHT: EUR(2020.83),
          amountHT: EUR(2020.83),
        },
      ],
    },
    {
      id: "demo-invoice-dupont",
      clientId: "demo-client-dupont",
      clientName: "Dupont Rénovation",
      number: "FA-2026-018",
      title: fr ? "Acompte escalier" : "Staircase deposit",
      status: "paid",
      amountTTC: EUR(3400),
      amountHT: EUR(2833.33),
      amountPaid: EUR(3400),
      currency: "EUR",
      issueDate: DAYS_AGO(20),
      createdAt: DAYS_AGO(20),
      updatedAt: DAYS_AGO(18),
      lineItems: [
        {
          description: fr ? "Acompte 50 % escalier" : "50% staircase deposit",
          quantity: 1,
          unitPriceHT: EUR(2833.33),
          amountHT: EUR(2833.33),
        },
      ],
    },
    {
      id: "demo-invoice-loire",
      clientId: "demo-client-loire",
      clientName: "Habitation Loire",
      number: "FA-2026-017",
      title: fr ? "Situation n°2 — lot menuiserie" : "Progress invoice #2 — joinery",
      status: "in_progress",
      amountTTC: EUR(4600),
      amountHT: EUR(3833.33),
      amountPaid: 0,
      currency: "EUR",
      issueDate: DAYS_AGO(4),
      createdAt: DAYS_AGO(4),
      updatedAt: DAYS_AGO(4),
      lineItems: [
        {
          description: fr ? "Situation n°2" : "Progress #2",
          quantity: 1,
          unitPriceHT: EUR(3833.33),
          amountHT: EUR(3833.33),
        },
      ],
    },
    {
      id: "demo-invoice-bernard",
      clientId: "demo-client-bernard",
      clientName: "Bernard & Fils",
      number: "FA-2026-016",
      title: fr ? "Porte d'entrée chêne" : "Oak front door",
      status: "paid",
      amountTTC: EUR(2890),
      amountHT: EUR(2408.33),
      amountPaid: EUR(2890),
      currency: "EUR",
      issueDate: DAYS_AGO(16),
      createdAt: DAYS_AGO(16),
      updatedAt: DAYS_AGO(14),
      lineItems: [
        {
          description: fr ? "Porte d'entrée + pose" : "Front door + install",
          quantity: 1,
          unitPriceHT: EUR(2408.33),
          amountHT: EUR(2408.33),
        },
      ],
    },
    {
      id: "demo-invoice-leroy",
      clientId: "demo-client-leroy",
      clientName: "Leroy Design",
      number: "FA-2026-015",
      title: fr ? "Table basse — solde" : "Coffee table — balance",
      status: "in_progress",
      amountTTC: EUR(980),
      amountHT: EUR(816.67),
      amountPaid: EUR(400),
      currency: "EUR",
      issueDate: DAYS_AGO(7),
      createdAt: DAYS_AGO(7),
      updatedAt: DAYS_AGO(7),
      lineItems: [
        {
          description: fr ? "Solde table basse" : "Coffee table balance",
          quantity: 1,
          unitPriceHT: EUR(816.67),
          amountHT: EUR(816.67),
        },
      ],
    },
    {
      id: "demo-invoice-pinel",
      clientId: "demo-client-pinel",
      clientName: "Atelier Pinel",
      number: "FA-2026-014",
      title: fr ? "Mobilier showroom" : "Showroom furniture",
      status: "paid",
      amountTTC: EUR(4200),
      amountHT: EUR(3500),
      amountPaid: EUR(4200),
      currency: "EUR",
      issueDate: DAYS_AGO(32),
      createdAt: DAYS_AGO(32),
      updatedAt: DAYS_AGO(30),
      lineItems: [
        {
          description: fr ? "Lot showroom" : "Showroom lot",
          quantity: 1,
          unitPriceHT: EUR(3500),
          amountHT: EUR(3500),
        },
      ],
    },
    {
      id: "demo-invoice-overdue",
      clientId: "demo-client-cuisine",
      clientName: "Cuisine & Co",
      number: "FA-2026-012",
      title: fr ? "Façades échantillons" : "Sample fronts",
      status: "overdue",
      amountTTC: EUR(860),
      amountHT: EUR(716.67),
      amountPaid: 0,
      currency: "EUR",
      issueDate: DAYS_AGO(45),
      createdAt: DAYS_AGO(45),
      updatedAt: DAYS_AGO(45),
      lineItems: [
        {
          description: fr ? "Échantillons façades" : "Front samples",
          quantity: 1,
          unitPriceHT: EUR(716.67),
          amountHT: EUR(716.67),
        },
      ],
    },
  ];

  const notes = [
    {
      id: "demo-note-1",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      title: fr ? "Confirmation créneau" : "Slot confirmation",
      content: fr
        ? "Rappeler mardi pour confirmer le créneau d'intervention. Didier préfère l'après-midi."
        : "Call back Tuesday to confirm the job slot. Didier prefers the afternoon.",
      type: "follow_up",
      createdAt: DAYS_AGO(1),
      updatedAt: DAYS_AGO(1),
    },
    {
      id: "demo-note-2",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      title: fr ? "Préférences client" : "Client preferences",
      content: fr
        ? "Préfère un contact téléphonique en fin de journée. Paiement par virement."
        : "Prefers a phone call at the end of the day. Pays by bank transfer.",
      type: "general",
      createdAt: DAYS_AGO(10),
      updatedAt: DAYS_AGO(10),
    },
    {
      id: "demo-note-3",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      title: fr ? "Acompte reçu" : "Deposit received",
      content: fr
        ? "Acompte FA-2026-019 encaissé. Pose prévue après confirmation mardi."
        : "Deposit FA-2026-019 collected. Install after Tuesday confirmation.",
      type: "general",
      createdAt: DAYS_AGO(11),
      updatedAt: DAYS_AGO(11),
    },
    {
      id: "demo-note-dupont",
      clientId: "demo-client-dupont",
      clientName: "Dupont Rénovation",
      title: fr ? "Chantier semaine prochaine" : "Jobsite next week",
      content: fr
        ? "Accès chantier confirmé lundi 8h. Apporter les plans V3."
        : "Site access confirmed Monday 8am. Bring plan V3.",
      type: "follow_up",
      createdAt: DAYS_AGO(2),
      updatedAt: DAYS_AGO(2),
    },
    {
      id: "demo-note-loire",
      clientId: "demo-client-loire",
      clientName: "Habitation Loire",
      title: fr ? "Situation à envoyer" : "Progress invoice to send",
      content: fr
        ? "Paul attend la situation n°2 avant validation du lot suivant."
        : "Paul is waiting for progress invoice #2 before approving the next lot.",
      type: "follow_up",
      createdAt: DAYS_AGO(3),
      updatedAt: DAYS_AGO(3),
    },
    {
      id: "demo-note-leroy",
      clientId: "demo-client-leroy",
      clientName: "Leroy Design",
      title: fr ? "Relance devis bibliothèque" : "Bookshelf quote follow-up",
      content: fr
        ? "Devis DM-158 envoyé il y a 5 jours. Relancer si pas de retour jeudi."
        : "Quote DM-158 sent 5 days ago. Follow up Thursday if no reply.",
      type: "follow_up",
      createdAt: DAYS_AGO(1, 16),
      updatedAt: DAYS_AGO(1, 16),
    },
    {
      id: "demo-note-rousseau",
      clientId: "demo-client-rousseau",
      clientName: "Menuiserie Rousseau",
      title: fr ? "Premier contact" : "First contact",
      content: fr
        ? "Nouveau sous-traitant. Devis façades envoyé. Bon feeling."
        : "New subcontractor. Facade quote sent. Good fit.",
      type: "general",
      createdAt: DAYS_AGO(2, 11),
      updatedAt: DAYS_AGO(2, 11),
    },
  ];

  const files = [
    {
      id: "demo-doc-file",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      title: fr ? "Plan_atelier_V3.pdf" : "Workshop_plan_V3.pdf",
      filename: fr ? "Plan_atelier_V3.pdf" : "Workshop_plan_V3.pdf",
      mimeType: "application/pdf",
      size: 420_000,
      createdAt: DAYS_AGO(5),
      updatedAt: DAYS_AGO(5),
    },
    {
      id: "demo-file-dupont",
      clientId: "demo-client-dupont",
      clientName: "Dupont Rénovation",
      title: fr ? "Releve_escalier.pdf" : "Staircase_survey.pdf",
      filename: fr ? "Releve_escalier.pdf" : "Staircase_survey.pdf",
      mimeType: "application/pdf",
      size: 310_000,
      createdAt: DAYS_AGO(8),
      updatedAt: DAYS_AGO(8),
    },
    {
      id: "demo-file-loire",
      clientId: "demo-client-loire",
      clientName: "Habitation Loire",
      title: fr ? "CCTP_lot_menuiserie.pdf" : "Joinery_spec.pdf",
      filename: fr ? "CCTP_lot_menuiserie.pdf" : "Joinery_spec.pdf",
      mimeType: "application/pdf",
      size: 890_000,
      createdAt: DAYS_AGO(15),
      updatedAt: DAYS_AGO(15),
    },
    {
      id: "demo-file-photo",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      title: fr ? "Photos_cuisine_existante.zip" : "Existing_kitchen_photos.zip",
      filename: fr ? "Photos_cuisine_existante.zip" : "Existing_kitchen_photos.zip",
      mimeType: "application/zip",
      size: 12_400_000,
      createdAt: DAYS_AGO(20),
      updatedAt: DAYS_AGO(20),
    },
  ];

  // Legacy documents array (quotes/invoices/files) kept for search / 360 helpers
  const documents = [
    ...quotes.map((q) => ({
      id: q.id,
      kind: "quote",
      number: q.number,
      title: q.title,
      status: q.status,
      amountTTC: q.amountTTC,
      createdAt: q.createdAt,
      issueDate: q.issueDate,
      clientId: q.clientId,
    })),
    ...invoices.map((inv) => ({
      id: inv.id,
      kind: "invoice",
      number: inv.number,
      title: inv.title,
      status: inv.status,
      amountTTC: inv.amountTTC,
      createdAt: inv.createdAt,
      issueDate: inv.issueDate,
      clientId: inv.clientId,
    })),
    ...files.map((f) => ({
      id: f.id,
      kind: "file",
      title: f.title,
      createdAt: f.createdAt,
      clientId: f.clientId,
    })),
  ];

  const emails = [
    {
      id: "demo-email-1",
      clientId: DEMO_CLIENT_ID,
      subject: fr
        ? "Validation des travaux de rénovation"
        : "Renovation work approval",
      preview: fr
        ? "Bonjour, je vous confirme mon accord pour les travaux. Pouvez-vous me rappeler mardi pour finaliser ?"
        : "Hi, I confirm my approval for the work. Can you call me on Tuesday to finalize?",
      direction: "inbound",
      fromName: "Didier Martin",
      fromEmail: "didier@martin-ebenisterie-demo.fr",
      toEmails: ["julien@atelier-demo.fr"],
      attachmentCount: 0,
      createdAt: DAYS_AGO(0, 8),
    },
    {
      id: "demo-email-2",
      clientId: DEMO_CLIENT_ID,
      subject: fr ? "Re: Planning atelier" : "Re: Workshop schedule",
      preview: fr
        ? "Je serai disponible jeudi matin pour le relevé."
        : "I'll be available Thursday morning for the survey.",
      direction: "inbound",
      fromName: "Didier Martin",
      fromEmail: "didier@martin-ebenisterie-demo.fr",
      toEmails: ["julien@atelier-demo.fr"],
      attachmentCount: 0,
      createdAt: DAYS_AGO(3),
    },
    {
      id: "demo-email-3",
      clientId: DEMO_CLIENT_ID,
      subject: fr ? "Devis DM-142 — cuisine sur mesure" : "Quote DM-142 — custom kitchen",
      preview: fr
        ? "Veuillez trouver ci-joint le devis pour votre cuisine."
        : "Please find attached the quote for your kitchen.",
      direction: "outbound",
      fromName: "Julien Moreau",
      fromEmail: "julien@atelier-demo.fr",
      toEmails: ["didier@martin-ebenisterie-demo.fr"],
      attachmentCount: 1,
      createdAt: DAYS_AGO(22),
    },
    {
      id: "demo-email-4",
      clientId: DEMO_CLIENT_ID,
      subject: fr ? "Accord sur le devis" : "Quote approval",
      preview: fr
        ? "C'est bon pour moi, on peut démarrer. Combien d'acompte ?"
        : "I'm good with it, we can start. How much deposit?",
      direction: "inbound",
      fromName: "Didier Martin",
      fromEmail: "didier@martin-ebenisterie-demo.fr",
      toEmails: ["julien@atelier-demo.fr"],
      attachmentCount: 0,
      createdAt: DAYS_AGO(14),
    },
    {
      id: "demo-email-leroy",
      clientId: "demo-client-leroy",
      subject: fr ? "Devis bibliothèque" : "Bookshelf quote",
      preview: fr
        ? "Merci pour le devis, je regarde ça cette semaine."
        : "Thanks for the quote, I'll look at it this week.",
      direction: "inbound",
      fromName: "Sophie Leroy",
      fromEmail: "sophie@leroy-design-demo.fr",
      toEmails: ["julien@atelier-demo.fr"],
      attachmentCount: 0,
      createdAt: DAYS_AGO(4),
    },
    {
      id: "demo-email-dupont",
      clientId: "demo-client-dupont",
      subject: fr ? "Accès chantier lundi" : "Site access Monday",
      preview: fr
        ? "Le chef de chantier vous attend lundi dès 8h."
        : "The site manager will meet you Monday from 8am.",
      direction: "inbound",
      fromName: "Claire Dupont",
      fromEmail: "claire@dupont-renov-demo.fr",
      toEmails: ["julien@atelier-demo.fr"],
      attachmentCount: 0,
      createdAt: DAYS_AGO(2, 14),
    },
  ];

  const topClients = [
    {
      clientId: "demo-client-dupont",
      clientName: "Dupont Rénovation",
      collected: EUR(15400),
      billed: EUR(16800),
      quoteCount: 4,
      invoiceCount: 5,
      lastActivityAt: DAYS_AGO(2),
    },
    {
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      collected: EUR(12480),
      billed: EUR(14905),
      quoteCount: 3,
      invoiceCount: 4,
      lastActivityAt: DAYS_AGO(0, 9),
    },
    {
      clientId: "demo-client-loire",
      clientName: "Habitation Loire",
      collected: EUR(11200),
      billed: EUR(15800),
      quoteCount: 3,
      invoiceCount: 3,
      lastActivityAt: DAYS_AGO(3),
    },
    {
      clientId: "demo-client-bernard",
      clientName: "Bernard & Fils",
      collected: EUR(8900),
      billed: EUR(8900),
      quoteCount: 2,
      invoiceCount: 3,
      lastActivityAt: DAYS_AGO(4),
    },
    {
      clientId: "demo-client-pinel",
      clientName: "Atelier Pinel",
      collected: EUR(7800),
      billed: EUR(7800),
      quoteCount: 2,
      invoiceCount: 2,
      lastActivityAt: DAYS_AGO(5),
    },
  ];

  const monthKeys = [
    "2026-02-01",
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-08-01",
  ];

  const financialRaw = [
    { collected: EUR(8200), billed: EUR(9100), outstanding: EUR(1800) },
    { collected: EUR(9800), billed: EUR(11200), outstanding: EUR(2100) },
    { collected: EUR(12400), billed: EUR(13100), outstanding: EUR(2400) },
    { collected: EUR(15600), billed: EUR(16800), outstanding: EUR(2800) },
    { collected: EUR(14200), billed: EUR(15900), outstanding: EUR(3100) },
    { collected: EUR(18900), billed: EUR(20100), outstanding: EUR(2600) },
    { collected: EUR(12480), billed: EUR(14800), outstanding: EUR(4200) },
  ];

  const commercialRaw = [
    { quotesCreated: 3, quotesAccepted: 2, invoicesCreated: 3, invoicesPaid: 2 },
    { quotesCreated: 4, quotesAccepted: 2, invoicesCreated: 3, invoicesPaid: 3 },
    { quotesCreated: 6, quotesAccepted: 3, invoicesCreated: 4, invoicesPaid: 4 },
    { quotesCreated: 5, quotesAccepted: 4, invoicesCreated: 5, invoicesPaid: 3 },
    { quotesCreated: 8, quotesAccepted: 3, invoicesCreated: 4, invoicesPaid: 5 },
    { quotesCreated: 7, quotesAccepted: 5, invoicesCreated: 6, invoicesPaid: 5 },
    { quotesCreated: 4, quotesAccepted: 2, invoicesCreated: 3, invoicesPaid: 2 },
  ];

  const clientRaw = [
    { newClients: 1, activeClients: 28 },
    { newClients: 2, activeClients: 30 },
    { newClients: 1, activeClients: 32 },
    { newClients: 3, activeClients: 35 },
    { newClients: 2, activeClients: 38 },
    { newClients: 2, activeClients: 42 },
    { newClients: 3, activeClients: 48 },
  ];

  const financialSeries = monthKeys.map((key, i) => ({
    key,
    label: monthLabel(key, fr),
    values: financialRaw[i],
  }));

  const commercialSeries = monthKeys.map((key, i) => ({
    key,
    label: monthLabel(key, fr),
    values: commercialRaw[i],
  }));

  const clientSeries = monthKeys.map((key, i) => ({
    key,
    label: monthLabel(key, fr),
    values: clientRaw[i],
  }));

  const breakdownTotal = topClients.reduce((sum, row) => sum + row.collected, 0);
  const revenueBreakdown = topClients.map((row) => ({
    key: row.clientId,
    label: row.clientName,
    amount: row.collected,
    sharePercent: Math.round((row.collected / breakdownTotal) * 1000) / 10,
  }));

  const kpis = {
    revenue: {
      value: EUR(12480),
      formatted: fr ? "12 480 €" : "€12,480",
      trendPercent: 12,
      trendFormatted: "+12%",
      helperCount: 18,
    },
    clients: { total: 48, newThisMonth: 3 },
    quotes: { pending: 5, accepted: 8, total: 28 },
    invoices: { paid: 18, pending: 3, total: 22 },
  };

  const analytics = {
    empty: false,
    period: {
      key: "30d",
      fromDate: "2026-02-01",
      toDate: "2026-08-04",
      granularity: "month",
    },
    kpis: {
      collectedRevenue: {
        value: EUR(12480),
        previous: EUR(11140),
        changePercent: 12,
        unit: "currency_cents",
      },
      billedRevenue: {
        value: EUR(14800),
        previous: EUR(15600),
        changePercent: -5,
        unit: "currency_cents",
      },
      outstandingAmount: {
        value: EUR(4200),
        previous: EUR(3900),
        changePercent: 8,
        unit: "currency_cents",
      },
      paidInvoices: { value: 18, previous: 16, changePercent: 12 },
      newClients: { value: 3, previous: 2, changePercent: 16 },
      quotesCreated: { value: 28, previous: 24, changePercent: 16 },
      quoteAcceptanceRate: { value: 0.62, previous: 0.58, changePercent: 7, unit: "ratio" },
      averageBasket: {
        value: EUR(4120),
        previous: EUR(3920),
        changePercent: 5,
        unit: "currency_cents",
      },
    },
    quotePipeline: {
      draft: 3,
      sent: 5,
      accepted: 8,
      rejected: 2,
      expired: 1,
      total: 28,
    },
    invoicePipeline: {
      pending: 3,
      paid: 18,
      overdue: 1,
      created: 22,
    },
    clientStats: { newClients: 3, activeClients: 48 },
    financialSeries,
    commercialSeries,
    clientSeries,
    revenueBreakdown,
    topClients,
    // Analytics comparison UI appends "%" — values must be percent deltas, not amounts.
    comparison: {
      collectedRevenue: 12,
      billedRevenue: -5,
      newClients: 16,
      acceptedQuotes: 8,
      paidInvoices: 12,
    },
    comparisonPeriod: {
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
    },
  };

  const actions = [
    {
      id: "demo-action-1",
      kind: "action",
      ruleId: "follow_up_call",
      priority: "critical",
      category: "follow_up",
      title: fr ? "Rappeler Martin Ébénisterie" : "Call Martin Ébénisterie",
      reason: fr
        ? "Devis accepté — confirmer le créneau d'intervention mardi"
        : "Quote accepted — confirm Tuesday install slot",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      date: NOW,
      link: `/dashboard/clients/${DEMO_CLIENT_ID}`,
    },
    {
      id: "demo-action-2",
      kind: "action",
      ruleId: "invoice_pending",
      priority: "high",
      category: "invoice",
      title: fr ? "Encaisser le solde Martin" : "Collect Martin’s balance",
      reason: fr ? "FA-2026-020 — 2 425 € en attente" : "FA-2026-020 — €2,425 outstanding",
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      date: NOW,
      link: "/dashboard/documents",
    },
    {
      id: "demo-action-3",
      kind: "action",
      ruleId: "quote_follow_up",
      priority: "high",
      category: "commercial",
      title: fr ? "Relancer le devis Leroy Design" : "Follow up Leroy Design quote",
      reason: fr ? "DM-158 envoyé il y a 5 jours — sans réponse" : "DM-158 sent 5 days ago — no reply",
      clientId: "demo-client-leroy",
      clientName: "Leroy Design",
      date: DAYS_AGO(0, 9),
      link: "/dashboard/documents",
    },
    {
      id: "demo-action-4",
      kind: "action",
      ruleId: "invoice_overdue",
      priority: "high",
      category: "invoice",
      title: fr ? "Relancer Cuisine & Co" : "Chase Cuisine & Co",
      reason: fr ? "FA-2026-012 en retard — 860 €" : "FA-2026-012 overdue — €860",
      clientId: "demo-client-cuisine",
      clientName: "Cuisine & Co",
      date: DAYS_AGO(0, 8),
      link: "/dashboard/documents",
    },
    {
      id: "demo-action-5",
      kind: "action",
      ruleId: "follow_up_site",
      priority: "medium",
      category: "follow_up",
      title: fr ? "Préparer le chantier Dupont" : "Prepare Dupont jobsite",
      reason: fr ? "Accès lundi 8h — plans V3 à emporter" : "Access Monday 8am — bring plan V3",
      clientId: "demo-client-dupont",
      clientName: "Dupont Rénovation",
      date: DAYS_AGO(0, 7),
      link: "/dashboard/clients/demo-client-dupont",
    },
    {
      id: "demo-action-6",
      kind: "action",
      ruleId: "invoice_situation",
      priority: "medium",
      category: "invoice",
      title: fr ? "Suivre la situation Habitation Loire" : "Follow Habitation Loire progress invoice",
      reason: fr ? "FA-2026-017 — 4 600 € à encaisser" : "FA-2026-017 — €4,600 to collect",
      clientId: "demo-client-loire",
      clientName: "Habitation Loire",
      date: DAYS_AGO(0, 7),
      link: "/dashboard/documents",
    },
    {
      id: "demo-action-7",
      kind: "action",
      ruleId: "quote_draft",
      priority: "medium",
      category: "commercial",
      title: fr ? "Finaliser le devis Bernard" : "Finish Bernard quote",
      reason: fr ? "DM-161 en brouillon — dressing sous combles" : "DM-161 draft — attic dressing",
      clientId: "demo-client-bernard",
      clientName: "Bernard & Fils",
      date: DAYS_AGO(0, 6),
      link: "/dashboard/documents",
    },
    {
      id: "demo-action-8",
      kind: "action",
      ruleId: "new_client",
      priority: "low",
      category: "follow_up",
      title: fr ? "Qualifier Menuiserie Rousseau" : "Qualify Menuiserie Rousseau",
      reason: fr ? "Nouveau contact — devis façades en attente" : "New contact — facade quote pending",
      clientId: "demo-client-rousseau",
      clientName: "Menuiserie Rousseau",
      date: DAYS_AGO(0, 6),
      link: "/dashboard/clients/demo-client-rousseau",
    },
  ];

  const reminders = [
    {
      id: "demo-reminder-1",
      type: "follow_up",
      priority: "high",
      title: fr ? "Appel Didier Martin — mardi" : "Call Didier Martin — Tuesday",
      description: fr ? "Confirmer créneau pose cuisine" : "Confirm kitchen install slot",
      link: `/dashboard/clients/${DEMO_CLIENT_ID}`,
      date: DAYS_AGO(-1),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      resolved: false,
    },
    {
      id: "demo-reminder-2",
      type: "invoice",
      priority: "medium",
      title: fr ? "Relance facture Cuisine & Co" : "Cuisine & Co invoice chase",
      description: fr ? "Échéance dépassée de 15 jours" : "15 days past due",
      link: "/dashboard/documents",
      date: NOW,
      clientId: "demo-client-cuisine",
      clientName: "Cuisine & Co",
      resolved: false,
    },
  ];

  const timeline = [
    {
      id: "tl-1",
      type: "email_received",
      createdAt: DAYS_AGO(0, 8),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      entityType: "email",
      entityId: "demo-email-1",
      metadata: {
        clientName: "Martin Ébénisterie",
        subject: emails[0].subject,
        excerpt: emails[0].preview,
      },
    },
    {
      id: "tl-2",
      type: "follow_up_recorded",
      createdAt: DAYS_AGO(0, 9),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      metadata: {
        clientName: "Martin Ébénisterie",
        title: fr ? "Rappel mardi" : "Tuesday reminder",
        excerpt: fr
          ? "Rappeler mardi pour confirmer le créneau."
          : "Call back Tuesday to confirm the slot.",
      },
    },
    {
      id: "tl-3",
      type: "note_created",
      createdAt: DAYS_AGO(1),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      metadata: {
        clientName: "Martin Ébénisterie",
        noteTitle: notes[0].title,
        title: notes[0].title,
        excerpt: notes[0].content,
        noteType: notes[0].type,
        noteDate: notes[0].createdAt,
      },
    },
    {
      id: "tl-4",
      type: "invoice_created",
      createdAt: DAYS_AGO(2),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      entityType: "invoice",
      entityId: "demo-doc-invoice",
      metadata: {
        clientName: "Martin Ébénisterie",
        invoiceNumber: "FA-2026-020",
        title: invoices[0].title,
        amountTTC: EUR(2425),
      },
    },
    {
      id: "tl-5",
      type: "quote_created",
      createdAt: DAYS_AGO(2, 11),
      clientId: "demo-client-rousseau",
      clientName: "Menuiserie Rousseau",
      entityType: "quote",
      entityId: "demo-quote-rousseau",
      metadata: {
        clientName: "Menuiserie Rousseau",
        quoteNumber: "DM-162",
        title: quotes[6].title,
        amountTTC: EUR(2100),
      },
    },
    {
      id: "tl-6",
      type: "email_received",
      createdAt: DAYS_AGO(2, 14),
      clientId: "demo-client-dupont",
      clientName: "Dupont Rénovation",
      metadata: {
        clientName: "Dupont Rénovation",
        subject: emails[5].subject,
        excerpt: emails[5].preview,
      },
    },
    {
      id: "tl-7",
      type: "invoice_issued",
      createdAt: DAYS_AGO(4),
      clientId: "demo-client-loire",
      clientName: "Habitation Loire",
      entityType: "invoice",
      entityId: "demo-invoice-loire",
      metadata: {
        clientName: "Habitation Loire",
        invoiceNumber: "FA-2026-017",
        amountTTC: EUR(4600),
      },
    },
    {
      id: "tl-8",
      type: "quote_sent",
      createdAt: DAYS_AGO(5),
      clientId: "demo-client-leroy",
      clientName: "Leroy Design",
      entityType: "quote",
      entityId: "demo-quote-leroy",
      metadata: {
        clientName: "Leroy Design",
        quoteNumber: "DM-158",
        amountTTC: EUR(3200),
      },
    },
    {
      id: "tl-9",
      type: "document_uploaded",
      createdAt: DAYS_AGO(5, 15),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      metadata: {
        clientName: "Martin Ébénisterie",
        fileName: files[0].filename,
        title: files[0].title,
      },
    },
    {
      id: "tl-10",
      type: "invoice_paid",
      createdAt: DAYS_AGO(11),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      entityType: "invoice",
      entityId: "demo-invoice-acompte",
      metadata: {
        clientName: "Martin Ébénisterie",
        invoiceNumber: "FA-2026-019",
        amountTTC: EUR(2425),
      },
    },
    {
      id: "tl-11",
      type: "quote_accepted",
      createdAt: DAYS_AGO(14),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      entityType: "quote",
      entityId: "demo-doc-quote",
      metadata: {
        clientName: "Martin Ébénisterie",
        quoteNumber: "DM-142",
        title: fr ? "Cuisine sur mesure" : "Custom kitchen",
        amountTTC: EUR(4850),
      },
    },
    {
      id: "tl-12",
      type: "invoice_paid",
      createdAt: DAYS_AGO(14, 16),
      clientId: "demo-client-bernard",
      clientName: "Bernard & Fils",
      metadata: {
        clientName: "Bernard & Fils",
        invoiceNumber: "FA-2026-016",
        amountTTC: EUR(2890),
      },
    },
    {
      id: "tl-13",
      type: "client_created",
      createdAt: DAYS_AGO(12),
      clientId: "demo-client-rousseau",
      clientName: "Menuiserie Rousseau",
      metadata: { clientName: "Menuiserie Rousseau" },
    },
    {
      id: "tl-14",
      type: "quote_sent",
      createdAt: DAYS_AGO(22),
      clientId: DEMO_CLIENT_ID,
      clientName: "Martin Ébénisterie",
      metadata: {
        clientName: "Martin Ébénisterie",
        quoteNumber: "DM-142",
        amountTTC: EUR(4850),
      },
    },
  ];

  const client360ById = {
    [DEMO_CLIENT_ID]: {
      stats: {
        exchangesTotal: 18,
        emailsReceived: 12,
        emailsSent: 6,
        totalRevenue: EUR(12480),
        notesCount: 4,
        documentsCount: 6,
        quotesCount: 3,
        invoicesCount: 4,
        lastActivityAt: DAYS_AGO(0, 9),
      },
      integrations: {
        googleContacts: { connected: true, email: "julien@atelier-demo.fr", lastSync: DAYS_AGO(0) },
        gmail: { connected: true, email: "julien@atelier-demo.fr", lastSync: DAYS_AGO(0) },
      },
      recentCommunications: emails
        .filter((e) => e.clientId === DEMO_CLIENT_ID)
        .map((item) => ({
          id: item.id,
          subject: item.subject,
          preview: item.preview,
          createdAt: item.createdAt,
        })),
      recentDocuments: documents
        .filter((d) => d.clientId === DEMO_CLIENT_ID)
        .slice(0, 6)
        .map((doc) => ({
          id: doc.id,
          kind: doc.kind,
          number: doc.number,
          title: doc.title,
          status: doc.status,
          createdAt: doc.createdAt,
        })),
      recentNotes: notes.filter((n) => n.clientId === DEMO_CLIENT_ID),
    },
  };

  for (const c of clients) {
    if (client360ById[c.id]) continue;
    const cNotes = notes.filter((n) => n.clientId === c.id);
    const cDocs = documents.filter((d) => d.clientId === c.id);
    const cEmails = emails.filter((e) => e.clientId === c.id);
    client360ById[c.id] = {
      stats: {
        exchangesTotal: cEmails.length + cNotes.length + 4,
        emailsReceived: cEmails.filter((e) => e.direction === "inbound").length,
        emailsSent: cEmails.filter((e) => e.direction === "outbound").length,
        totalRevenue: c.totalRevenue,
        notesCount: cNotes.length || c.notesCount,
        documentsCount: cDocs.length || c.documentsCount,
        quotesCount: quotes.filter((q) => q.clientId === c.id).length,
        invoicesCount: invoices.filter((inv) => inv.clientId === c.id).length,
        lastActivityAt: c.lastActivityAt,
      },
      integrations: {
        gmail: { connected: true, email: "julien@atelier-demo.fr", lastSync: DAYS_AGO(0) },
      },
      recentCommunications: cEmails.map((item) => ({
        id: item.id,
        subject: item.subject,
        preview: item.preview,
        createdAt: item.createdAt,
      })),
      recentDocuments: cDocs.slice(0, 4).map((doc) => ({
        id: doc.id,
        kind: doc.kind,
        number: doc.number,
        title: doc.title,
        status: doc.status,
        createdAt: doc.createdAt,
      })),
      recentNotes: cNotes,
    };
  }

  const searchGroups = {
    clients: {
      total: 1,
      items: [
        {
          id: DEMO_CLIENT_ID,
          type: "client",
          title: "Martin Ébénisterie",
          subtitle: "Didier Martin · didier@martin-ebenisterie-demo.fr",
          url: `/dashboard/clients/${DEMO_CLIENT_ID}`,
          matchPreview: fr ? "Client prioritaire · À relancer" : "Priority client · Follow up",
        },
      ],
    },
    documents: {
      total: 2,
      items: [
        {
          id: "demo-doc-quote",
          type: "quote",
          title: fr ? "Devis DM-142 — Cuisine sur mesure" : "Quote DM-142 — Custom kitchen",
          subtitle: "Martin Ébénisterie",
          url: "/dashboard/documents?open=demo-doc-quote",
          matchPreview: fr ? "Accepté · 4 850 €" : "Accepted · €4,850",
        },
        {
          id: "demo-doc-invoice",
          type: "invoice",
          title: fr ? "Facture FA-2026-020 — Solde" : "Invoice FA-2026-020 — Balance",
          subtitle: "Martin Ébénisterie",
          url: "/dashboard/documents?open=demo-doc-invoice",
          matchPreview: fr ? "En attente · 2 425 €" : "Pending · €2,425",
        },
      ],
    },
    emails: {
      total: 1,
      items: [
        {
          id: "demo-email-1",
          type: "email",
          title: emails[0].subject,
          subtitle: "Didier Martin",
          url: `/dashboard/clients/${DEMO_CLIENT_ID}?section=emails`,
          matchPreview: emails[0].preview.slice(0, 60),
        },
      ],
    },
    notes: {
      total: 1,
      items: [
        {
          id: "demo-note-1",
          type: "note",
          title: notes[0].title,
          subtitle: "Martin Ébénisterie",
          url: `/dashboard/clients/${DEMO_CLIENT_ID}?section=notes`,
          matchPreview: notes[0].content.slice(0, 60),
        },
      ],
    },
    quotes: { total: 0, items: [] },
    invoices: { total: 0, items: [] },
  };

  return {
    user: { firstName: "Julien" },
    client,
    clients,
    kpis,
    topClients,
    actions,
    reminders,
    searchQuery: DEMO_SEARCH_QUERY,
    searchGroups,
    searchTotal: 5,
    emails,
    notes,
    quotes,
    invoices,
    files,
    documents,
    timeline,
    analytics,
    client360: client360ById[DEMO_CLIENT_ID],
    client360ById,
    sectionCounts: {
      emails: emails.filter((e) => e.clientId === DEMO_CLIENT_ID).length,
      quotes: quotes.filter((q) => q.clientId === DEMO_CLIENT_ID).length,
      invoices: invoices.filter((inv) => inv.clientId === DEMO_CLIENT_ID).length,
      notes: notes.filter((n) => n.clientId === DEMO_CLIENT_ID).length,
      documents: files.filter((f) => f.clientId === DEMO_CLIENT_ID).length,
    },
  };
}
