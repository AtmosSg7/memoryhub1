import React, { useRef, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/context/LanguageContext";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { SearchDemo } from "@/components/SearchDemo";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { JoinModal } from "@/components/JoinModal";

const Landing = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const demoRef = useRef(null);

  const openJoin = () => setModalOpen(true);
  const goDemo = () => {
    const el = document.getElementById("demo");
    if (el) el.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => demoRef.current?.replay?.(), 300);
  };

  return (
    <div className="App">
      <Navbar onJoin={openJoin} />
      <Hero onJoin={openJoin} onDemo={goDemo} />
      <SearchDemo ref={demoRef} />
      <Features />
      <HowItWorks />
      <Pricing onJoin={openJoin} />
      <Faq />
      <FinalCta onJoin={openJoin} />
      <Footer />
      <JoinModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
