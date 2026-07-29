/**
 * Legal entity placeholders — replace with real company data before public launch.
 * All legal pages interpolate these values at render time.
 */
export const LEGAL_ENTITY = {
  companyName: "[À RENSEIGNER — raison sociale]",
  legalForm: "[À RENSEIGNER — forme juridique]",
  shareCapital: "[À RENSEIGNER — capital social]",
  city: "[À RENSEIGNER — ville du RCS]",
  siret: "[À RENSEIGNER — SIRET]",
  publicationDirector: "[À RENSEIGNER — directeur de publication]",
  contactEmail: "[À RENSEIGNER — email de contact]",
  address: "[À RENSEIGNER — adresse du siège]",
  consentMechanism: "[À RENSEIGNER — mécanisme de gestion du consentement cookies]",
};

const PLACEHOLDER_MAP = {
  "[NOM DE LA SOCIÉTÉ]": () => LEGAL_ENTITY.companyName,
  "[FORME JURIDIQUE]": () => LEGAL_ENTITY.legalForm,
  "[CAPITAL SOCIAL]": () => LEGAL_ENTITY.shareCapital,
  "[VILLE]": () => LEGAL_ENTITY.city,
  "[SIRET]": () => LEGAL_ENTITY.siret,
  "[NOM DU DIRECTEUR DE PUBLICATION]": () => LEGAL_ENTITY.publicationDirector,
  "[EMAIL CONTACT]": () => LEGAL_ENTITY.contactEmail,
  "[ADRESSE]": () => LEGAL_ENTITY.address,
  "[MÉCANISME DE GESTION DU CONSENTEMENT]": () => LEGAL_ENTITY.consentMechanism,
};

export function applyLegalPlaceholders(text) {
  if (typeof text !== "string") return text;
  let result = text;
  for (const [placeholder, resolver] of Object.entries(PLACEHOLDER_MAP)) {
    result = result.split(placeholder).join(resolver());
  }
  return result;
}

export function legalPlaceholdersPending() {
  return Object.values(LEGAL_ENTITY).some((value) => value.startsWith("[À RENSEIGNER"));
}
