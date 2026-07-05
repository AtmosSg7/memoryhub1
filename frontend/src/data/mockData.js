export const stats = {
  totalClients: 148,
  totalClientsTrend: "+12",
  documentsStored: 1284,
  documentsTrend: "+86",
  notesCreated: 372,
  notesTrend: "+24",
  recentSearches: 96,
  recentSearchesTrend: "+9",
};

export const recentClients = [
  {
    id: "martin-plomberie",
    name: "Julien Martin",
    company: "Martin Plomberie",
    trade: { fr: "Plomberie & chauffage", en: "Plumbing & heating" },
    lastInteraction: { fr: "Il y a 2 heures", en: "2 hours ago" },
    status: "active",
    initials: "MP",
    color: "#0A2540",
  },
  {
    id: "atelier-dubois",
    name: "Sophie Dubois",
    company: "Atelier Dubois",
    trade: { fr: "Ébénisterie sur-mesure", en: "Bespoke cabinetry" },
    lastInteraction: { fr: "Hier, 17:42", en: "Yesterday, 5:42 PM" },
    status: "pending",
    initials: "AD",
    color: "#173A5E",
  },
  {
    id: "claire-renovation",
    name: "Claire Fontaine",
    company: "Claire Rénovation",
    trade: { fr: "Rénovation intérieure", en: "Interior renovation" },
    lastInteraction: { fr: "Il y a 3 jours", en: "3 days ago" },
    status: "new",
    initials: "CR",
    color: "#0066FF",
  },
  {
    id: "electricite-bernard",
    name: "Alain Bernard",
    company: "Électricité Bernard",
    trade: { fr: "Électricité générale", en: "General electrics" },
    lastInteraction: { fr: "Il y a 5 jours", en: "5 days ago" },
    status: "active",
    initials: "EB",
    color: "#0A2540",
  },
  {
    id: "menuiserie-laurent",
    name: "Paul Laurent",
    company: "Menuiserie Laurent",
    trade: { fr: "Menuiserie & agencement", en: "Carpentry & fitting" },
    lastInteraction: { fr: "Il y a 12 jours", en: "12 days ago" },
    status: "dormant",
    initials: "ML",
    color: "#4B5563",
  },
];

export const recentActivity = [
  {
    id: "a1",
    type: "quote",
    label: { key: "activity.quoteAdded" },
    detail: {
      fr: "Devis #2026-0034 — Atelier Dubois, 3 240 € HT",
      en: "Quote #2026-0034 — Atelier Dubois, €3,240 excl. VAT",
    },
    time: { fr: "il y a 12 min", en: "12 min ago" },
  },
  {
    id: "a2",
    type: "invoice",
    label: { key: "activity.invoiceUploaded" },
    detail: {
      fr: "Facture FA-0092 déposée pour Martin Plomberie",
      en: "Invoice FA-0092 uploaded for Martin Plomberie",
    },
    time: { fr: "il y a 1 h", en: "1 h ago" },
  },
  {
    id: "a3",
    type: "note",
    label: { key: "activity.noteCreated" },
    detail: {
      fr: "Note : « Prévoir visite chantier vendredi matin »",
      en: "Note: “Schedule site visit Friday morning”",
    },
    time: { fr: "il y a 3 h", en: "3 h ago" },
  },
  {
    id: "a4",
    type: "client",
    label: { key: "activity.clientUpdated" },
    detail: {
      fr: "Coordonnées mises à jour — Claire Rénovation",
      en: "Contact details updated — Claire Rénovation",
    },
    time: { fr: "hier", en: "yesterday" },
  },
  {
    id: "a5",
    type: "email",
    label: { key: "activity.emailSynced" },
    detail: {
      fr: "3 e-mails synchronisés depuis Gmail",
      en: "3 emails synced from Gmail",
    },
    time: { fr: "hier", en: "yesterday" },
  },
];

export const quotes = [
  {
    id: "2026-0034",
    client: "Atelier Dubois",
    amount: "3 240 €",
    status: "sent",
    date: "12 Feb 2026",
  },
  {
    id: "2026-0033",
    client: "Martin Plomberie",
    amount: "4 820 €",
    status: "accepted",
    date: "09 Feb 2026",
  },
  {
    id: "2026-0032",
    client: "Menuiserie Laurent",
    amount: "1 690 €",
    status: "draft",
    date: "07 Feb 2026",
  },
  {
    id: "2026-0031",
    client: "Électricité Bernard",
    amount: "2 350 €",
    status: "sent",
    date: "03 Feb 2026",
  },
];

export const invoices = [
  {
    id: "FA-0092",
    client: "Martin Plomberie",
    amount: "4 820 €",
    status: "paid",
    date: "11 Feb 2026",
  },
  {
    id: "FA-0091",
    client: "Claire Rénovation",
    amount: "980 €",
    status: "pending",
    date: "08 Feb 2026",
  },
  {
    id: "FA-0090",
    client: "Atelier Dubois",
    amount: "2 140 €",
    status: "overdue",
    date: "22 Jan 2026",
  },
];

export const integrations = [
  {
    id: "gmail",
    name: "Gmail",
    desc: {
      fr: "Synchroniser les e-mails clients automatiquement.",
      en: "Automatically sync client emails.",
    },
    connected: true,
    icon: "Mail",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    desc: {
      fr: "Rendez-vous et rappels liés à chaque client.",
      en: "Appointments and reminders linked to each client.",
    },
    connected: true,
    icon: "Calendar",
  },
  {
    id: "drive",
    name: "Google Drive",
    desc: {
      fr: "Retrouver vos PDF, photos et devis Drive.",
      en: "Retrieve your Drive PDFs, photos and quotes.",
    },
    connected: false,
    icon: "HardDrive",
  },
  {
    id: "stripe",
    name: "Stripe",
    desc: {
      fr: "Suivi de facturation et paiements clients.",
      en: "Track invoicing and client payments.",
    },
    connected: false,
    icon: "CreditCard",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    desc: {
      fr: "Enregistrer les conversations dans la mémoire.",
      en: "Save conversations into the memory.",
    },
    connected: false,
    icon: "MessageCircle",
  },
  {
    id: "sage",
    name: "Sage / EBP",
    desc: {
      fr: "Import automatique des devis et factures.",
      en: "Automatic quote and invoice import.",
    },
    connected: false,
    icon: "FileSpreadsheet",
  },
];

export const searchExamples = {
  fr: ["Martin", "plomberie", "devis salle de bain", "facture"],
  en: ["Martin", "plumbing", "bathroom quote", "invoice"],
};

export const clientTimeline = [
  { id: "t1", type: "email", title: { fr: "E-mail reçu", en: "Email received" }, detail: { fr: "Confirmation intervention salle de bain", en: "Bathroom job confirmation" }, date: "14 Feb — 09:12" },
  { id: "t2", type: "quote", title: { fr: "Devis accepté", en: "Quote accepted" }, detail: { fr: "Devis #2026-0031 — 4 820 € HT", en: "Quote #2026-0031 — €4,820" }, date: "09 Feb — 16:04" },
  { id: "t3", type: "note", title: { fr: "Note ajoutée", en: "Note added" }, detail: { fr: "Prévoir seconde tranche fin mars", en: "Plan second phase late March" }, date: "05 Feb — 11:22" },
  { id: "t4", type: "invoice", title: { fr: "Facture envoyée", en: "Invoice sent" }, detail: { fr: "FA-0088 — 1 240 €", en: "FA-0088 — €1,240" }, date: "28 Jan — 10:00" },
];

export const clientEmails = [
  {
    id: "e1",
    from: { fr: "Julien Martin", en: "Julien Martin" },
    subject: { fr: "Re: Devis salle de bain", en: "Re: Bathroom quote" },
    snippet: {
      fr: "Bonjour, le devis me convient. Pouvez-vous confirmer la date de début ?",
      en: "Hi, the quote works for me. Can you confirm the start date?",
    },
    time: "09:24",
  },
  {
    id: "e2",
    from: { fr: "Julien Martin", en: "Julien Martin" },
    subject: { fr: "Confirmation intervention", en: "Job confirmation" },
    snippet: {
      fr: "Parfait pour jeudi 14h. Je serai sur place pour valider les finitions.",
      en: "Thursday 2pm works. I'll be there to sign off the finishes.",
    },
    time: { fr: "Hier", en: "Yesterday" },
  },
  {
    id: "e3",
    from: { fr: "Julien Martin", en: "Julien Martin" },
    subject: { fr: "Contrat d'entretien annuel", en: "Annual maintenance contract" },
    snippet: {
      fr: "Pouvez-vous me rappeler les conditions du contrat d'entretien ?",
      en: "Could you remind me of the maintenance contract terms?",
    },
    time: "12 déc.",
  },
];
