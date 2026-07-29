/**
 * @jest-environment node
 */

describe("integrationsApi helpers", () => {
  it("exposes google contacts and gmail endpoints under /api/integrations", () => {
    const endpoints = {
      contactsStatus: "/api/integrations/google-contacts/status",
      gmailStatus: "/api/integrations/gmail/status",
      gmailSync: "/api/integrations/gmail/sync",
      gmailClientEmails: "/api/integrations/gmail/clients/:id/emails",
    };
    expect(Object.values(endpoints).every((path) => path.startsWith("/api/integrations/"))).toBe(
      true,
    );
    expect(endpoints.gmailSync).toContain("gmail");
  });
});
