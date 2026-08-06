/** Deterministic E2E users from backend/scripts/seed_e2e.py — never production. */

module.exports = {
  artisanA: {
    email: "artisan-a@e2e.example.com",
    password: "E2ePassw0rd!A",
    existingClientName: "Client E2E Dupont",
  },
  artisanB: {
    email: "artisan-b@e2e.example.com",
    password: "E2ePassw0rd!B",
  },
  admin: {
    email: "admin@e2e.example.com",
    password: "E2eAdminPass1!",
  },
};
