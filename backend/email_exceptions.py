"""Exceptions for the transactional email system."""

from __future__ import annotations


class EmailError(Exception):
    """Base email error."""


class EmailValidationError(EmailError):
    """Invalid recipient, subject, or template input."""


class EmailConfigurationError(EmailError):
    """SMTP or provider configuration is invalid or missing."""


class EmailTemporaryFailure(EmailError):
    """Transient delivery failure — safe to retry."""

    def __init__(self, message: str = "Temporary delivery failure", *, code: str = "temporary"):
        super().__init__(message)
        self.code = code


class EmailPermanentFailure(EmailError):
    """Permanent delivery failure — do not retry."""

    def __init__(self, message: str = "Permanent delivery failure", *, code: str = "permanent"):
        super().__init__(message)
        self.code = code
