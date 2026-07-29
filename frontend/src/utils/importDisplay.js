export const IMPORT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";
export const IMPORT_MAX_FILES = 10;

export const DOCUMENT_KINDS = [
  "quote",
  "invoice",
  "purchase_order",
  "delivery_note",
  "receipt",
  "supplier_invoice",
  "administrative_document",
  "contract",
  "other",
];

export const CONFIDENCE_LEVELS = {
  reliable: {
    key: "reliable",
    minScore: 0.85,
    badgeClass: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]",
  },
  verify: {
    key: "verify",
    minScore: 0.5,
    badgeClass: "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]",
  },
  missing: {
    key: "missing",
    minScore: 0,
    badgeClass: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]",
  },
};

export const FIELD_CONFIDENCE_MAP = {
  kind: "detectedKind",
  client: ["clientName", "company"],
  externalNumber: "externalNumber",
  documentDate: "documentDate",
  amountHT: "amountHT",
  vatRate: "vatRate",
  amountTTC: "amountTTC",
  title: "title",
};

export const ANALYSIS_STAGE_KEYS = ["upload", "read", "extract", "match"];

export const CONFIRMABLE_KINDS = new Set(["quote", "invoice"]);

export function computeAmountTtc(amountHtCents, vatRate) {
  const ht = Number(amountHtCents) || 0;
  const rate = Number(vatRate) || 0;
  return Math.round((ht * (100 + rate)) / 100);
}

export function resolveImportFormVatRate(session, defaultVatRate = 20) {
  const normalized = session?.analysis?.normalized || {};
  const confidence = session?.analysis?.confidence?.vatRate ?? 0;
  if (normalized.vatRate != null && confidence >= CONFIDENCE_LEVELS.reliable.minScore) {
    return normalized.vatRate;
  }
  return defaultVatRate;
}

export function sessionToFormState(session, defaultKind, defaultVatRate = 20) {
  const normalized = session?.analysis?.normalized || {};
  const vatRate = resolveImportFormVatRate(session, defaultVatRate);
  return {
    targetKind: defaultKind || session?.detectedKind || "quote",
    title: normalized.title || "",
    externalNumber: normalized.externalNumber || "",
    documentDate: normalized.documentDate || "",
    amountHT: normalized.amountHT ?? 0,
    vatRate,
    amountTTC: normalized.amountTTC ?? computeAmountTtc(normalized.amountHT, vatRate),
    internalNotes: normalized.internalNotes || "",
    clientName: normalized.clientName || "",
    company: normalized.company || "",
    contactName: normalized.contactName || normalized.clientName || "",
    email: normalized.email || "",
    phone: normalized.phone || "",
    address: normalized.address || "",
    city: normalized.city || "",
  };
}

export function buildConfirmPayload(form, clientAction, clientId, clientData) {
  const fields = {
    clientName: form.clientName || null,
    company: form.company || null,
    contactName: form.contactName || null,
    email: form.email || null,
    phone: form.phone || null,
    address: form.address || null,
    city: form.city || null,
    externalNumber: form.externalNumber || null,
    documentDate: form.documentDate || null,
    title: form.title || null,
    amountHT: Number(form.amountHT) || 0,
    vatRate: Number(form.vatRate) || 0,
    amountTTC: Number(form.amountTTC) || computeAmountTtc(form.amountHT, form.vatRate),
    internalNotes: form.internalNotes || null,
  };

  const payload = {
    targetKind: form.targetKind,
    clientAction,
    fields,
  };

  if (clientAction === "use_existing") {
    payload.clientId = clientId;
  } else {
    payload.clientData = {
      name: clientData.name,
      company: clientData.company || null,
      contactName: clientData.contactName || null,
      email: clientData.email || null,
      phone: clientData.phone || null,
      address: clientData.address || null,
      city: clientData.city || null,
    };
  }

  return payload;
}

export function getConfidenceLevel(score, hasValue = true) {
  if (!hasValue || score == null || Number.isNaN(score)) return "missing";
  if (score >= CONFIDENCE_LEVELS.reliable.minScore) return "reliable";
  if (score >= CONFIDENCE_LEVELS.verify.minScore) return "verify";
  return "missing";
}

export function getFieldConfidenceScore(session, fieldKey) {
  const confidence = session?.analysis?.confidence || {};
  const mapping = FIELD_CONFIDENCE_MAP[fieldKey];

  if (fieldKey === "kind") {
    return session?.analysis?.detectedKindConfidence ?? session?.analysis?.overallConfidence ?? 0;
  }

  if (Array.isArray(mapping)) {
    return Math.max(...mapping.map((key) => confidence[key] ?? 0));
  }

  return confidence[mapping] ?? 0;
}

export function getFieldDisplayValue(form, fieldKey, t) {
  switch (fieldKey) {
    case "kind":
      return t(`importWizard.kind.${form.targetKind}`);
    case "client":
      return form.company || form.clientName || "—";
    case "externalNumber":
      return form.externalNumber || "—";
    case "documentDate":
      return form.documentDate
        ? new Date(form.documentDate).toLocaleDateString()
        : "—";
    case "amountHT":
      return form.amountHT ? `${(form.amountHT / 100).toFixed(2)} €` : "—";
    case "vatRate":
      return form.vatRate != null ? `${form.vatRate} %` : "—";
    case "amountTTC":
      return form.amountTTC ? `${(form.amountTTC / 100).toFixed(2)} €` : "—";
    default:
      return "—";
  }
}

export function hasFieldValue(form, fieldKey) {
  switch (fieldKey) {
    case "kind":
      return Boolean(form.targetKind);
    case "client":
      return Boolean(form.clientName?.trim() || form.company?.trim());
    case "externalNumber":
      return Boolean(form.externalNumber?.trim());
    case "documentDate":
      return Boolean(form.documentDate);
    case "amountHT":
      return Number(form.amountHT) > 0;
    case "vatRate":
      return form.vatRate != null;
    case "amountTTC":
      return Number(form.amountTTC) > 0;
    default:
      return false;
  }
}

export function getClientMatchLevel(score) {
  if (score >= 70) return "reliable";
  if (score >= 40) return "verify";
  return "missing";
}

export function getDetectedSummaryFields() {
  return ["kind", "client", "externalNumber", "documentDate", "amountHT", "vatRate", "amountTTC"];
}

export function getDetectedLineItems(session) {
  const items = session?.analysis?.rawExtracted?.lineItems;
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.filter((item) => item && (item.label || item.description));
}

export function formatLineItemAmount(cents) {
  if (cents == null || cents === "") return "—";
  const value = Number(cents);
  if (Number.isNaN(value)) return "—";
  return `${(value / 100).toFixed(2)} €`;
}

export function formatLineItemQuantity(quantity) {
  if (quantity == null || quantity === "") return "—";
  const value = Number(quantity);
  if (Number.isNaN(value)) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

const WARNING_FIELD_CONFIG = [
  { fieldKey: "vatRate", warningKey: "vatIncomplete", formKey: "vatRate" },
  { fieldKey: "documentDate", warningKey: "dateUnclear", formKey: "documentDate" },
  { fieldKey: "client", warningKey: "clientUnclear", formKey: "clientName" },
  { fieldKey: "externalNumber", warningKey: "numberUnclear", formKey: "externalNumber" },
  { fieldKey: "amountHT", warningKey: "amountUnclear", formKey: "amountHT" },
];

export function getOverallConfidencePercent(session) {
  const overall = session?.analysis?.overallConfidence;
  if (overall != null && !Number.isNaN(Number(overall))) {
    return Math.round(Number(overall) * 100);
  }

  const confidence = session?.analysis?.confidence || {};
  const values = Object.values(confidence).filter((v) => v != null && !Number.isNaN(Number(v)));
  if (values.length === 0) {
    const kindScore = session?.analysis?.detectedKindConfidence;
    if (kindScore != null) return Math.round(Number(kindScore) * 100);
    return null;
  }
  const avg = values.reduce((sum, v) => sum + Number(v), 0) / values.length;
  return Math.round(avg * 100);
}

export function getVerificationWarnings(session, form, t) {
  const warnings = [];
  for (const config of WARNING_FIELD_CONFIG) {
    const score = getFieldConfidenceScore(session, config.fieldKey);
    const hasValue = hasFieldValue(form, config.fieldKey);
    const level = getConfidenceLevel(score, hasValue);
    if (level === "verify" || level === "missing") {
      warnings.push({
        field: config.fieldKey,
        message: t(`importWizard.warnings.${config.warningKey}`),
      });
    }
  }
  return warnings;
}

export function getResolvedClientLabel(session, form, clientAction, selectedClientId) {
  if (clientAction === "use_existing" && selectedClientId) {
    const match = session?.clientMatches?.find((m) => m.clientId === selectedClientId);
    if (match?.clientName) return match.clientName;
  }
  return form.company?.trim() || form.clientName?.trim() || "";
}

export function willCreateNewClient(session, clientAction) {
  if (clientAction === "create_new") return true;
  return !(session?.clientMatches?.length > 0);
}

