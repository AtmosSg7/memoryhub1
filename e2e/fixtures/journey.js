/** Deterministic unknown-sender journey fixtures (isolated per run via unique sourceIds). */

const UNKNOWN = {
  fromEmail: "alex.inconnu@e2e.example.com",
  fromName: "Alex Inconnu",
  subject: "Devis terrasse Lyon E2E",
  preview: "Bonjour, je souhaite un devis pour une terrasse à Lyon.",
  replySubject: "Re: Devis terrasse Lyon E2E",
  replyPreview: "Merci, je reste disponible cette semaine pour le devis.",
  clientName: "Alex Inconnu",
};

module.exports = { UNKNOWN };
