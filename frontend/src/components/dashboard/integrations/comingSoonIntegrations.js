import {
  AppleContactsLogo,
  DropboxLogo,
  GoogleCalendarLogo,
  GoogleDriveLogo,
  OutlookLogo,
  WhatsAppLogo,
} from "@/components/dashboard/integrations/integrationLogos";

export const COMING_SOON_INTEGRATIONS = [
  { id: "whatsapp", Logo: WhatsAppLogo, nameKey: "integrations.comingSoon.whatsapp.name", descKey: "integrations.comingSoon.whatsapp.desc" },
  { id: "google-calendar", Logo: GoogleCalendarLogo, nameKey: "integrations.comingSoon.googleCalendar.name", descKey: "integrations.comingSoon.googleCalendar.desc" },
  { id: "outlook", Logo: OutlookLogo, nameKey: "integrations.comingSoon.outlook.name", descKey: "integrations.comingSoon.outlook.desc" },
  { id: "apple-contacts", Logo: AppleContactsLogo, nameKey: "integrations.comingSoon.appleContacts.name", descKey: "integrations.comingSoon.appleContacts.desc" },
  { id: "google-drive", Logo: GoogleDriveLogo, nameKey: "integrations.comingSoon.googleDrive.name", descKey: "integrations.comingSoon.googleDrive.desc" },
  { id: "dropbox", Logo: DropboxLogo, nameKey: "integrations.comingSoon.dropbox.name", descKey: "integrations.comingSoon.dropbox.desc" },
];
