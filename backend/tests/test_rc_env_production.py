"""Release Candidate — production environment guardrails."""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent


def _run_validation(env: dict) -> subprocess.CompletedProcess:
    merged = {
        "DEV_CREDIT_PURCHASES_ENABLED": "false",
        "E2E_DISABLE_RATE_LIMIT": "false",
        "ALLOW_E2E_SEED": "false",
        **env,
    }
    script = (
        "import os; "
        "os.environ.update({"
        + ",".join(f"{k!r}:{v!r}" for k, v in merged.items())
        + "}); "
        "from env_validation import validate_production_env; "
        "validate_production_env()"
    )
    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=str(BACKEND_ROOT),
        capture_output=True,
        text=True,
    )


def _base_production_env() -> dict:
    return {
        "ENV": "production",
        "MONGO_URL": "mongodb://user:pass@mongo:27017/memoryhub?authSource=admin",
        "DB_NAME": "memoryhub",
        "JWT_SECRET": "prod-jwt-secret-at-least-32-characters-long",
        "FRONTEND_URL": "https://app.memoryhub.example",
        "CORS_ORIGINS": "https://app.memoryhub.example",
        "BACKEND_PUBLIC_URL": "https://api.memoryhub.example",
        "SENTRY_USER_SALT": "prod-sentry-salt-not-default",
        "LOCAL_UPLOAD_DIR": "/app/uploads",
        "CREDITS_ENFORCED": "true",
        "ANALYZER_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-test-key",
        "EMAIL_PROVIDER": "smtp",
        "SMTP_HOST": "smtp.example.com",
        "SMTP_FROM_EMAIL": "noreply@memoryhub.example",
        "SUPPORT_EMAIL": "support@memoryhub.example",
        "STRIPE_SECRET_KEY": "sk_live_testkey1234567890",
        "STRIPE_WEBHOOK_SECRET": "whsec_testsecret1234567890",
        "STRIPE_PRICE_SOLO": "price_solo",
        "STRIPE_PRICE_PRO": "price_pro",
        "STRIPE_PRICE_TEAM": "price_team",
        "STRIPE_SUCCESS_URL": "https://app.memoryhub.example/billing/success",
        "STRIPE_CANCEL_URL": "https://app.memoryhub.example/billing/cancel",
        "DEV_CREDIT_PURCHASES_ENABLED": "false",
        "E2E_DISABLE_RATE_LIMIT": "false",
        "ALLOW_E2E_SEED": "false",
        # Pin product flags so a polluted parent shell (local E2E) cannot fail RC guards.
        "STRIPE_BACKEND": "stripe",
        "COMMUNICATION_INTELLIGENCE_ENABLED": "false",
        "COMMUNICATION_INTELLIGENCE_PROVIDER": "mock",
        "ACTION_ENGINE_ENABLED": "true",
        "GMAIL_AUTO_SYNC_ENABLED": "false",
    }


def test_production_rejects_mock_analyzer():
    env = _base_production_env()
    env["ANALYZER_PROVIDER"] = "mock"
    env.pop("OPENAI_API_KEY", None)
    result = _run_validation(env)
    assert result.returncode != 0
    assert "ANALYZER_PROVIDER" in result.stderr


def test_production_rejects_fake_email_provider():
    env = _base_production_env()
    env["EMAIL_PROVIDER"] = "fake"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "EMAIL_PROVIDER" in result.stderr


def test_production_accepts_minimal_valid_config():
    env = _base_production_env()
    result = _run_validation(env)
    assert result.returncode == 0, result.stderr


def test_staging_rejects_mock_analyzer():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["ANALYZER_PROVIDER"] = "mock"
    env.pop("OPENAI_API_KEY", None)
    result = _run_validation(env)
    assert result.returncode != 0
    assert "ANALYZER_PROVIDER" in result.stderr


def test_staging_rejects_fake_stripe_backend():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["STRIPE_BACKEND"] = "fake"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "STRIPE_BACKEND" in result.stderr


def test_staging_rejects_live_stripe_key():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_live_testkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env.pop("BACKEND_PUBLIC_URL", None)
    result = _run_validation(env)
    assert result.returncode != 0
    assert "sk_test_" in result.stderr


def test_production_rejects_test_stripe_key():
    env = _base_production_env()
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "sk_live_" in result.stderr


def test_production_rejects_e2e_rate_limit_bypass():
    env = _base_production_env()
    env["E2E_DISABLE_RATE_LIMIT"] = "1"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "E2E_DISABLE_RATE_LIMIT" in result.stderr


def test_staging_rejects_allow_e2e_seed():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env.pop("BACKEND_PUBLIC_URL", None)
    env["ALLOW_E2E_SEED"] = "1"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "ALLOW_E2E_SEED" in result.stderr


def test_production_rejects_e2e_db_name():
    env = _base_production_env()
    env["DB_NAME"] = "memoryhub_e2e"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "memoryhub_e2e" in result.stderr


def test_production_rejects_ci_enabled_with_mock_provider():
    env = _base_production_env()
    env["COMMUNICATION_INTELLIGENCE_ENABLED"] = "true"
    env["COMMUNICATION_INTELLIGENCE_PROVIDER"] = "mock"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "COMMUNICATION_INTELLIGENCE_PROVIDER" in result.stderr


def test_production_accepts_ci_disabled_even_if_provider_mock():
    env = _base_production_env()
    env["COMMUNICATION_INTELLIGENCE_ENABLED"] = "false"
    env["COMMUNICATION_INTELLIGENCE_PROVIDER"] = "mock"
    result = _run_validation(env)
    assert result.returncode == 0, result.stderr


def test_staging_accepts_valid_config():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env.pop("BACKEND_PUBLIC_URL", None)
    result = _run_validation(env)
    assert result.returncode == 0, result.stderr


def test_staging_rejects_partial_google_credentials():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env.pop("BACKEND_PUBLIC_URL", None)
    env["GOOGLE_CLIENT_ID"] = "google-client-id"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "GOOGLE_CLIENT_SECRET" in result.stderr


def test_staging_requires_integrations_token_key_when_google_configured():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env["GOOGLE_CLIENT_ID"] = "google-client-id"
    env["GOOGLE_CLIENT_SECRET"] = "google-client-secret"
    env["GOOGLE_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/google-contacts/callback"
    env["GOOGLE_GMAIL_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/gmail/callback"
    env["INTEGRATIONS_CONTACTS_PROVIDER"] = ""
    env["INTEGRATIONS_GMAIL_PROVIDER"] = ""
    env["INTEGRATIONS_TOKEN_KEY"] = ""
    result = _run_validation(env)
    assert result.returncode != 0
    assert "INTEGRATIONS_TOKEN_KEY" in result.stderr


def test_staging_rejects_weak_integrations_token_key():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env["GOOGLE_CLIENT_ID"] = "google-client-id"
    env["GOOGLE_CLIENT_SECRET"] = "google-client-secret"
    env["GOOGLE_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/google-contacts/callback"
    env["GOOGLE_GMAIL_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/gmail/callback"
    env["INTEGRATIONS_TOKEN_KEY"] = "too-short"
    result = _run_validation(env)
    assert result.returncode != 0
    assert "INTEGRATIONS_TOKEN_KEY" in result.stderr


def test_staging_rejects_integrations_token_key_same_as_jwt():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env["GOOGLE_CLIENT_ID"] = "google-client-id"
    env["GOOGLE_CLIENT_SECRET"] = "google-client-secret"
    env["GOOGLE_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/google-contacts/callback"
    env["GOOGLE_GMAIL_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/gmail/callback"
    env["INTEGRATIONS_TOKEN_KEY"] = env["JWT_SECRET"]
    result = _run_validation(env)
    assert result.returncode != 0
    assert "JWT_SECRET" in result.stderr


def test_staging_accepts_complete_google_config():
    env = _base_production_env()
    env["ENV"] = "staging"
    env["STRIPE_SECRET_KEY"] = "sk_test_stagingkey1234567890"
    env["FRONTEND_URL"] = "https://staging.memoryhub.example"
    env["CORS_ORIGINS"] = "https://staging.memoryhub.example"
    env["GOOGLE_CLIENT_ID"] = "google-client-id"
    env["GOOGLE_CLIENT_SECRET"] = "google-client-secret"
    env["GOOGLE_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/google-contacts/callback"
    env["GOOGLE_GMAIL_REDIRECT_URI"] = "https://api.staging.memoryhub.example/api/integrations/gmail/callback"
    env["INTEGRATIONS_TOKEN_KEY"] = "dedicated-integrations-token-key-32chars"
    env["INTEGRATIONS_CONTACTS_PROVIDER"] = ""
    env["INTEGRATIONS_GMAIL_PROVIDER"] = ""
    result = _run_validation(env)
    assert result.returncode == 0, result.stderr
