import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/context/LanguageContext";
import { Search, Mail, FileText, Receipt, FolderOpen, StickyNote, Image as ImageIcon, Sparkles, Phone, MapPin, Clock, CheckCircle2, CircleDot } from "lucide-react";
import { SiGmail, SiGoogledrive, SiNotion } from "react-icons/si";

const TARGET = "Didier Martin";
const AVATAR = "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzJ8MHwxfHNlYXJjaHwxfHxmcmVuY2glMjBhcnRpc2FuJTIwbWF0dXJlJTIwbWFuJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzgzMDQ0OTA5fDA&ixlib=rb-4.1.0&q=85";
const PHOTO_1 = "https://images.unsplash.com/photo-1611021061285-16c871740efa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwyfHxjYXJwZW50cnklMjB3b29kd29yayUyMGNyYWZ0c21hbnxlbnwwfHx8fDE3ODMwNDQ5MTB8MA&ixlib=rb-4.1.0&q=85";
const PHOTO_2 = "https://images.unsplash.com/photo-1659930087003-2d64e33181f7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHxjYXJwZW50cnklMjB3b29kd29yayUyMGNyYWZ0c21hbnxlbnwwfHx8fDE3ODMwNDQ5MTB8MA&ixlib=rb-4.1.0&q=85";

const TABS = [
  { key: "summary", icon: Sparkles },
  { key: "emails", icon: Mail },
  { key: "quotes", icon: FileText },
  { key: "invoices", icon: Receipt },
  { key: "drive", icon: FolderOpen },
  { key: "notion", icon: StickyNote },
  { key: "photos", icon: ImageIcon },
];

const StatusPill = ({ label }) => {
  const isPaid = ["Payée", "Payé", "Paid"].includes(label);
  const isPending = ["En attente", "Pending"].includes(label);
  const cls = isPaid
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isPending
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-indigo-50 text-indigo-700 border-indigo-200";
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{label}</span>;
};

export const SearchDemo = React.forwardRef((props, ref) => {
  const { t, lang } = useLang();
  const [typed, setTyped] = useState("");
  const [showDash, setShowDash] = useState(false);
  const [tab, setTab] = useState("summary");
  const [started, setStarted] = useState(false);
  const sectionRef = useRef(null);

  // Start typing when scrolled into view
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started) setStarted(true);
        });
      },
      { threshold: 0.35 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    setTyped("");
    setShowDash(false);
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setTyped(TARGET.slice(0, i));
      if (i >= TARGET.length) {
        clearInterval(iv);
        setTimeout(() => setShowDash(true), 400);
      }
    }, 85);
    return () => clearInterval(iv);
  }, [started, lang]);

  // expose replay
  React.useImperativeHandle(ref, () => ({
    replay: () => {
      setStarted(false);
      setShowDash(false);
      setTyped("");
      setTimeout(() => setStarted(true), 60);
    },
  }));

  const d = t("dashboard");

  return (
    <section
      ref={sectionRef}
      id="demo"
      className="relative py-24 md:py-32 bg-[#FAFAFB] border-y border-[#E5E7EB]"
      data-testid="search-demo-section"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-[12px] uppercase tracking-[0.18em] text-[#4F46E5] font-bold mb-3">
            {t("search.kicker")}
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-black text-[#0A0A0B] tracking-tight">
            {t("search.title")}
          </h2>
          <p className="mt-4 text-[#5E5F6E] text-base md:text-lg">
            {t("search.subtitle")}
          </p>
        </div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="card-soft flex items-center gap-3 px-4 py-3.5" data-testid="fake-search-bar">
            <Search className="w-5 h-5 text-[#8A8F98]" />
            <div className="flex-1 text-left font-mono text-[15px] md:text-[16px] text-[#0A0A0B]">
              {typed || <span className="text-[#8A8F98] font-sans">{t("search.placeholder")}</span>}
              {started && typed.length < TARGET.length && <span className="caret" />}
            </div>
            <span className="hidden sm:inline text-[11px] font-mono text-[#8A8F98] border border-[#E5E7EB] rounded-md px-2 py-0.5">
              {t("search.hint")}
            </span>
          </div>
        </motion.div>

        {/* Dashboard */}
        <AnimatePresence>
          {showDash && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10"
              data-testid="client-dashboard"
            >
              <div className="card-soft overflow-hidden">
                {/* Dashboard chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFB]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  <div className="ml-4 font-mono text-[12px] text-[#8A8F98]">memoryhub.app/clients/didier-martin</div>
                </div>

                {/* Header */}
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 border-b border-[#E5E7EB]">
                  <div className="relative">
                    <img
                      src={AVATAR}
                      alt="Didier Martin"
                      className="w-20 h-20 rounded-2xl object-cover border border-[#E5E7EB] shadow-sm"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                      <CircleDot className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display text-2xl md:text-3xl font-bold text-[#0A0A0B] tracking-tight">
                        Didier Martin
                      </h3>
                      <span className="pill" style={{ background: "#ECFDF5", color: "#047857", borderColor: "#A7F3D0" }}>
                        {d.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-[#5E5F6E]">
                      <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{d.city}</span>
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />+33 6 42 18 09 33</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{d.lastInteraction}: {d.ago}</span>
                    </div>
                    <p className="mt-2 text-[13px] text-[#8A8F98] font-medium">{d.job}</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-[#E5E7EB] overflow-x-auto no-scrollbar">
                  <div className="flex items-center gap-1 px-4 md:px-6 py-2 min-w-max">
                    {TABS.map((tb) => {
                      const Icon = tb.icon;
                      const active = tab === tb.key;
                      return (
                        <button
                          key={tb.key}
                          onClick={() => setTab(tb.key)}
                          data-testid={`dash-tab-${tb.key}`}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                            active
                              ? "bg-[#0A0A0B] text-white shadow-sm"
                              : "text-[#5E5F6E] hover:text-[#0A0A0B] hover:bg-[#F4F5F7]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {d.tabs[tb.key]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tab content */}
                <div className="p-6 md:p-8 min-h-[360px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25 }}
                    >
                      {tab === "summary" && (
                        <div className="grid md:grid-cols-3 gap-6">
                          <div className="md:col-span-2 card-soft p-6 bg-gradient-to-br from-white to-[#FAFAFB]">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#0EA5E9] flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                              </div>
                              <p className="text-[13px] font-bold text-[#0A0A0B]">{d.ai.title}</p>
                            </div>
                            <p className="text-[14.5px] leading-relaxed text-[#0A0A0B]/85">{d.ai.body}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {d.ai.chips.map((c) => (
                                <span key={c} className="pill" style={{ background: "#EEF2FF", color: "#4338CA", borderColor: "#C7D2FE" }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="card-soft p-4">
                              <p className="text-[11px] uppercase tracking-wider text-[#8A8F98] font-bold mb-2">Emails</p>
                              <p className="font-display text-3xl font-black text-[#0A0A0B]">28</p>
                            </div>
                            <div className="card-soft p-4">
                              <p className="text-[11px] uppercase tracking-wider text-[#8A8F98] font-bold mb-2">CA {lang === "fr" ? "cumulé" : "lifetime"}</p>
                              <p className="font-display text-3xl font-black text-[#0A0A0B]">8 040 €</p>
                            </div>
                            <div className="card-soft p-4">
                              <p className="text-[11px] uppercase tracking-wider text-[#8A8F98] font-bold mb-2">{lang === "fr" ? "Chantiers" : "Projects"}</p>
                              <p className="font-display text-3xl font-black text-[#0A0A0B]">3</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {tab === "emails" && (
                        <div className="divide-y divide-[#EEF0F3] -mx-2">
                          {d.emails.map((e, i) => (
                            <div key={i} className="flex items-start gap-3 px-2 py-3.5">
                              <div className="w-8 h-8 rounded-lg bg-[#FDECEA] flex items-center justify-center flex-shrink-0">
                                <SiGmail className="w-4 h-4 text-[#EA4335]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[14px] font-semibold text-[#0A0A0B] truncate">{e.subj}</p>
                                  <span className="text-[12px] text-[#8A8F98] flex-shrink-0">{e.time}</span>
                                </div>
                                <p className="text-[13px] text-[#5E5F6E] truncate mt-0.5">{e.snippet}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "quotes" && (
                        <div className="grid md:grid-cols-3 gap-4">
                          {d.quotes.map((q) => (
                            <div key={q.ref} className="card-soft p-5">
                              <p className="font-mono text-[11px] text-[#8A8F98]">#{q.ref}</p>
                              <p className="mt-1 font-semibold text-[#0A0A0B] text-[15px]">{q.label}</p>
                              <div className="mt-3 flex items-center justify-between">
                                <p className="font-display text-xl font-bold text-[#0A0A0B]">{q.amount}</p>
                                <StatusPill label={q.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "invoices" && (
                        <div className="card-soft overflow-hidden">
                          <div className="grid grid-cols-12 px-5 py-3 bg-[#FAFAFB] border-b border-[#E5E7EB] text-[11px] uppercase tracking-wider text-[#8A8F98] font-bold">
                            <div className="col-span-4">Ref</div>
                            <div className="col-span-4">{lang === "fr" ? "Objet" : "Subject"}</div>
                            <div className="col-span-2">Total</div>
                            <div className="col-span-2 text-right">Status</div>
                          </div>
                          {d.invoices.map((inv) => (
                            <div key={inv.ref} className="grid grid-cols-12 px-5 py-4 border-b border-[#EEF0F3] last:border-none items-center">
                              <div className="col-span-4 font-mono text-[13px] text-[#0A0A0B]">{inv.ref}</div>
                              <div className="col-span-4 text-[14px] text-[#0A0A0B]">{inv.label}</div>
                              <div className="col-span-2 font-semibold text-[#0A0A0B]">{inv.amount}</div>
                              <div className="col-span-2 flex justify-end"><StatusPill label={inv.status} /></div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "drive" && (
                        <div className="grid md:grid-cols-2 gap-3">
                          {d.drive.map((f) => (
                            <div key={f.name} className="card-soft p-4 flex items-center gap-3 hover:border-[#C7D2FE] transition-colors">
                              <div className="w-10 h-10 rounded-lg bg-[#E8F5EC] flex items-center justify-center flex-shrink-0">
                                <SiGoogledrive className="w-5 h-5 text-[#1FA463]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[#0A0A0B] text-[14px] truncate">{f.name}</p>
                                <p className="text-[12px] text-[#8A8F98] truncate">{f.meta}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "notion" && (
                        <div className="space-y-3">
                          {d.notion.map((n) => (
                            <div key={n.title} className="card-soft p-5 flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-[#F4F5F7] flex items-center justify-center flex-shrink-0">
                                <SiNotion className="w-5 h-5 text-[#0A0A0B]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[#0A0A0B] text-[14.5px]">{n.title}</p>
                                <p className="text-[12px] text-[#8A8F98] mt-0.5">{n.meta}</p>
                              </div>
                              <span className="pill" style={{ background: "#F4F5F7" }}>{n.tag}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {tab === "photos" && (
                        <div>
                          <p className="text-[12px] uppercase tracking-wider text-[#8A8F98] font-bold mb-4">
                            {d.photosCaption}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="relative rounded-xl overflow-hidden aspect-[4/3] border border-[#E5E7EB]">
                              <img src={PHOTO_1} alt="chantier" className="w-full h-full object-cover" />
                            </div>
                            <div className="relative rounded-xl overflow-hidden aspect-[4/3] border border-[#E5E7EB]">
                              <img src={PHOTO_2} alt="chantier" className="w-full h-full object-cover" />
                            </div>
                            <div className="relative rounded-xl overflow-hidden aspect-[4/3] border border-[#E5E7EB]">
                              <img src={AVATAR} alt="client" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-6 md:px-8 py-4 bg-[#FAFAFB] border-t border-[#E5E7EB] flex items-center justify-between text-[12px] text-[#8A8F98]">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {lang === "fr" ? "Synchronisé à l'instant" : "Synced just now"}
                  </span>
                  <span className="font-mono">MemoryHub · v0.9 beta</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
});

SearchDemo.displayName = "SearchDemo";
