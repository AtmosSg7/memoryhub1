import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { X, CheckCircle2, ArrowRight } from "lucide-react";

export const JoinModal = ({ open, onClose }) => {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!email.includes("@")) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setEmail("");
      onClose();
    }, 1800);
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
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md bg-white rounded-3xl border border-[#E5E7EB] shadow-2xl p-7"
          >
            <button
              onClick={onClose}
              data-testid="join-modal-close"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg hover:bg-[#F4F5F7] flex items-center justify-center text-[#8A8F98]"
            >
              <X className="w-4 h-4" />
            </button>
            {!sent ? (
              <>
                <h3 className="font-display text-2xl font-bold text-[#0A0A0B] tracking-tight">
                  {t("joinModal.title")}
                </h3>
                <p className="mt-2 text-[14px] text-[#5E5F6E]">{t("joinModal.subtitle")}</p>
                <form onSubmit={submit} className="mt-5 space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("joinModal.placeholder")}
                    required
                    data-testid="join-modal-email"
                    className="w-full px-4 py-3 rounded-xl border border-[#E5E7EB] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/15 outline-none text-[15px] transition-all"
                  />
                  <button
                    type="submit"
                    data-testid="join-modal-submit"
                    className="btn-primary w-full justify-center"
                  >
                    {t("joinModal.submit")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4" data-testid="join-modal-success">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="mt-4 font-display text-xl font-bold text-[#0A0A0B]">
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
