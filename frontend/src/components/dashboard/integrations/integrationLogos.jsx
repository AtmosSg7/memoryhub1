import { Phone } from "lucide-react";
import { PiMicrosoftOutlookLogo } from "react-icons/pi";
import {
  SiApple,
  SiDropbox,
  SiGmail,
  SiGoogle,
  SiGooglecalendar,
  SiGoogledrive,
  SiWhatsapp,
} from "react-icons/si";

const logoClass = "w-8 h-8 shrink-0";

export function GoogleContactsLogo({ className = logoClass }) {
  return <SiGoogle className={className} style={{ color: "#4285F4" }} aria-hidden />;
}

export function GmailLogo({ className = logoClass }) {
  return <SiGmail className={className} style={{ color: "#EA4335" }} aria-hidden />;
}

export function PhoneLogo({ className = logoClass }) {
  return <Phone className={className} style={{ color: "#0A2540" }} aria-hidden />;
}

export function WhatsAppLogo({ className = logoClass }) {
  return <SiWhatsapp className={className} style={{ color: "#25D366" }} aria-hidden />;
}

export function GoogleCalendarLogo({ className = logoClass }) {
  return <SiGooglecalendar className={className} style={{ color: "#4285F4" }} aria-hidden />;
}

export function OutlookLogo({ className = logoClass }) {
  return <PiMicrosoftOutlookLogo className={className} style={{ color: "#0078D4" }} aria-hidden />;
}

export function AppleContactsLogo({ className = logoClass }) {
  return <SiApple className={className} style={{ color: "#000000" }} aria-hidden />;
}

export function GoogleDriveLogo({ className = logoClass }) {
  return <SiGoogledrive className={className} style={{ color: "#4285F4" }} aria-hidden />;
}

export function DropboxLogo({ className = logoClass }) {
  return <SiDropbox className={className} style={{ color: "#0061FF" }} aria-hidden />;
}
