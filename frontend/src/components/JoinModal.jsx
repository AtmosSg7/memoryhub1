import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { X, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "";

export const JoinModal = ({ open, onClose }) => {
  const { t, lang } = useLang();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (loading) return;
    setError("");
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), language: lang }),
      });

      if (res.status === 201) {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          setEmail("");
          setError("");
          onClose();
        }, 1800);
        return;
      }

      let data = null;
      try {
        data = await res.json();
      } catch {
        // ignore parse errors
      }

      if (res.status === 422) {
        setError(t("joinModal.errorInvalid"));
      } else if (res.status === 409) {
        setError(t("joinModal.errorDuplicate"));
      } else {
        setError(data?.detail?.message || t("joinModal.errorServer"));
      }
    } catch {
      setError(t("joinModal.errorServer"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          data-testid="join-modal"
        >
          <div className="absolute inset-0 bg-[#0A0A0B]/50 backdrop-blur-md" onClick={handleClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md bg-white rounded-[22px] border border-[#E7E9EE] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_20px_60px_-15px_rgba(10,10,11,0.35)] p-8"
          >
            <button
              onClick={handleClose}
              data-testid="join-modal-close"
              disabled={loading}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-black/[0.04] flex items-center justify-center text-[#8A8F98] transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>
            {!sent ? (
              <>
                <h3 className="font-display text-[24px] font-bold text-[#0A0A0B] tracking-[-0.025em]">
                  {t("joinModal.title")}
                </h3>
                <p className="mt-2 text-[14px] text-[#52535E] leading-[1.55]">{t("joinModal.subtitle")}</p>
                <form onSubmit={submit} className="mt-6 space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder={t("joinModal.placeholder")}
                    required
                    disabled={loading}
                    data-testid="join-modal-email"
                    className="w-full px-4 py-3 rounded-xl border border-[#E7E9EE] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 outline-none text-[15px] bg-white transition-all duration-200 placeholder:text-[#8A8F98]"
                  />
                  {error && (
                    <p className="text-[13px] text-red-500" data-testid="join-modal-error">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    data-testid="join-modal-submit"
                    className="btn-primary w-full justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("joinModal.loading")}
                      </>
                    ) : (
                      <>
                        {t("joinModal.submit")}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4" data-testid="join-modal-success">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_20px_-10px_rgba(16,185,129,0.5)]">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="mt-5 font-display text-[22px] font-bold text-[#0A0A0B] tracking-[-0.02em]">
                  {t("joinModal.success")}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
