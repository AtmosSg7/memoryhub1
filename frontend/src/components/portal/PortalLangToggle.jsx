export default function PortalLangToggle({ lang, setLang, ariaLabel = "Language" }) {
  return (
    <div
      className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] shrink-0"
      role="group"
      aria-label={ariaLabel}
      data-testid="portal-lang-toggle"
    >
      {["fr", "en"].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          data-testid={`portal-lang-${code}`}
          className={[
            "px-2.5 py-1 text-[11px] uppercase font-semibold rounded-md transition-all tracking-wider",
            lang === code
              ? "bg-white text-[#0A2540] shadow-sm"
              : "text-[#6B7280] hover:text-[#111827]",
          ].join(" ")}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
