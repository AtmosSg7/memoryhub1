import { useRef } from "react";

/**
 * Invisible anti-bot fields for public/sensitive forms.
 * - honeypot "website" (bots fill it; humans never see it)
 * - formStartedAt captured once on mount
 */
export function useFormAbuseGuard() {
  const startedAtRef = useRef(typeof performance !== "undefined" ? Date.now() / 1000 : Date.now() / 1000);

  return {
    formStartedAt: startedAtRef.current,
    withAbuseFields(payload = {}) {
      return {
        ...payload,
        website: "",
        formStartedAt: startedAtRef.current,
      };
    },
  };
}

export function HoneypotField({ value = "", onChange }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-10000px",
        top: "auto",
        width: "1px",
        height: "1px",
        overflow: "hidden",
      }}
    >
      <label htmlFor="mh-website-hp">Website</label>
      <input
        id="mh-website-hp"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        onChange={onChange}
        data-testid="honeypot-website"
      />
    </div>
  );
}
