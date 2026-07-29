"""Bilingual plain-text email copy for MemoryHub outbound messages."""

from dataclasses import dataclass
from typing import Literal, Optional

EmailLang = Literal["fr", "en"]

DEFAULT_TITLES = frozenset(
    {
        "Devis sans titre",
        "Facture sans titre",
        "Quote untitled",
        "Invoice untitled",
    }
)


@dataclass(frozen=True)
class EmailMessage:
    subject: str
    preheader: str
    body: str


def format_amount(cents: int, lang: EmailLang) -> str:
    value = (cents or 0) / 100
    if lang == "fr":
        return f"{value:.2f}".replace(".", ",") + " € TTC"
    return f"€{value:,.2f} incl. VAT"


def resolve_sender_name(
    company_name: Optional[str],
    lang: EmailLang,
    *,
    first_name: str = "",
    last_name: str = "",
) -> str:
    if company_name and company_name.strip():
        return company_name.strip()
    full_name = " ".join(part for part in (first_name, last_name) if part).strip()
    if full_name:
        return full_name
    return "Votre entreprise" if lang == "fr" else "Your business"


def _title_suffix(title: str, lang: EmailLang) -> str:
    clean = (title or "").strip()
    if not clean or clean in DEFAULT_TITLES:
        return ""
    return f" — {clean}" if lang == "en" else f" — {clean}"


def _signature(sender: str, lang: EmailLang) -> str:
    closing = "Cordialement," if lang == "fr" else "Best regards,"
    return f"{closing}\n{sender}"


def _pdf_attachment_hint(lang: EmailLang) -> str:
    if lang == "en":
        return (
            "Download the PDF from MemoryHub (Download PDF button) and attach it to your message."
        )
    return (
        "Téléchargez le PDF depuis MemoryHub (bouton « Télécharger PDF ») et joignez-le à votre message."
    )


def _portal_block(portal_url: str, lang: EmailLang, *, for_quote: bool) -> str:
    if lang == "en":
        if for_quote:
            return (
                f"\nReview and accept online:\n{portal_url}\n"
            )
        return f"\nView online:\n{portal_url}\n"
    if for_quote:
        return (
            f"\nConsulter et accepter en ligne :\n{portal_url}\n"
        )
    return f"\nConsulter en ligne :\n{portal_url}\n"


def build_quote_send_email(
    *,
    lang: EmailLang,
    greeting: str,
    number: str,
    title: str,
    amount_ttc: int,
    sender_name: str,
    portal_url: Optional[str] = None,
) -> EmailMessage:
    amount = format_amount(amount_ttc, lang)
    title_part = _title_suffix(title, lang)
    if lang == "en":
        subject = f"Quote no. {number}"
        preheader = f"Your quote for {amount} — review the details"
        lines = [
            f"Hello {greeting},",
            "",
            f"Please find below quote no. {number}{title_part} for {amount}.",
        ]
        if portal_url:
            lines.append(_portal_block(portal_url, lang, for_quote=True).strip())
        else:
            lines.extend(["", _pdf_attachment_hint(lang)])
        lines.extend(["", "Feel free to reach out if you have any questions.", "", _signature(sender_name, lang)])
        body = "\n".join(lines)
    else:
        subject = f"Devis n°{number}"
        preheader = f"Votre devis pour {amount} — retrouvez le détail ci-dessous"
        lines = [
            f"Bonjour {greeting},",
            "",
            f"Veuillez trouver ci-dessous le devis n°{number}{title_part}, "
            f"pour un montant de {amount}.",
        ]
        if portal_url:
            lines.append(_portal_block(portal_url, lang, for_quote=True).strip())
        else:
            lines.extend(["", _pdf_attachment_hint(lang)])
        lines.extend(
            [
                "",
                "Je reste à votre disposition pour toute question.",
                "",
                _signature(sender_name, lang),
            ]
        )
        body = "\n".join(lines)
    return EmailMessage(subject=subject, preheader=preheader, body=body)


def build_invoice_send_email(
    *,
    lang: EmailLang,
    greeting: str,
    number: str,
    amount_ttc: int,
    sender_name: str,
    portal_url: Optional[str] = None,
) -> EmailMessage:
    amount = format_amount(amount_ttc, lang)
    if lang == "en":
        subject = f"Invoice no. {number}"
        preheader = f"Invoice for {amount}"
        lines = [
            f"Hello {greeting},",
            "",
            f"Please find below invoice no. {number} for {amount}.",
        ]
        if portal_url:
            lines.append(_portal_block(portal_url, lang, for_quote=False).strip())
        else:
            lines.extend(["", _pdf_attachment_hint(lang)])
        lines.extend(["", _signature(sender_name, lang)])
        body = "\n".join(lines)
    else:
        subject = f"Facture n°{number}"
        preheader = f"Facture pour {amount}"
        lines = [
            f"Bonjour {greeting},",
            "",
            f"Veuillez trouver ci-dessous la facture n°{number}, pour un montant de {amount}.",
        ]
        if portal_url:
            lines.append(_portal_block(portal_url, lang, for_quote=False).strip())
        else:
            lines.extend(["", _pdf_attachment_hint(lang)])
        lines.extend(["", _signature(sender_name, lang)])
        body = "\n".join(lines)
    return EmailMessage(subject=subject, preheader=preheader, body=body)


def build_quote_follow_up_email(
    *,
    lang: EmailLang,
    greeting: str,
    number: str,
    title: str,
    amount_ttc: int,
    sender_name: str,
    portal_url: Optional[str] = None,
) -> EmailMessage:
    amount = format_amount(amount_ttc, lang)
    title_part = _title_suffix(title, lang)
    if lang == "en":
        subject = f"Following up — quote no. {number}"
        preheader = f"Quote no. {number} for {amount}"
        lines = [
            f"Hello {greeting},",
            "",
            f"I am following up on quote no. {number}{title_part} for {amount}.",
            "",
            "Have you had a chance to review it? I am happy to answer any questions.",
        ]
        if portal_url:
            lines.append(_portal_block(portal_url, lang, for_quote=True).strip())
        lines.extend(["", _signature(sender_name, lang)])
        body = "\n".join(lines)
    else:
        subject = f"Rappel — devis n°{number}"
        preheader = f"Devis n°{number} pour {amount}"
        lines = [
            f"Bonjour {greeting},",
            "",
            f"Je me permets de revenir vers vous au sujet du devis n°{number}{title_part}, "
            f"pour un montant de {amount}.",
            "",
            "Avez-vous eu l'occasion de le consulter ? Je reste disponible pour toute question.",
        ]
        if portal_url:
            lines.append(_portal_block(portal_url, lang, for_quote=True).strip())
        lines.extend(["", _signature(sender_name, lang)])
        body = "\n".join(lines)
    return EmailMessage(subject=subject, preheader=preheader, body=body)


def build_invoice_follow_up_email(
    *,
    lang: EmailLang,
    greeting: str,
    number: str,
    amount_ttc: int,
    amount_due: int,
    sender_name: str,
) -> EmailMessage:
    total = format_amount(amount_ttc, lang)
    due = format_amount(amount_due, lang)
    partial = amount_due < amount_ttc
    if lang == "en":
        subject = f"Payment reminder — invoice no. {number}"
        preheader = f"Balance due: {due}" if partial else f"Invoice for {total}"
        if partial:
            intro = (
                f"Invoice no. {number} (total {total}) still shows an outstanding balance of {due}."
            )
        else:
            intro = f"Invoice no. {number} for {total} appears to be outstanding."
        body = "\n".join(
            [
                f"Hello {greeting},",
                "",
                intro,
                "",
                "Please let me know when payment is expected, or contact me if you need help.",
                "",
                _signature(sender_name, lang),
            ]
        )
    else:
        subject = f"Rappel — facture n°{number}"
        preheader = f"Reste à régler : {due}" if partial else f"Facture pour {total}"
        if partial:
            intro = (
                f"La facture n°{number} (montant total {total}) présente un reste à régler de {due}."
            )
        else:
            intro = f"La facture n°{number} d'un montant de {total} semble toujours en attente de règlement."
        body = "\n".join(
            [
                f"Bonjour {greeting},",
                "",
                intro,
                "",
                "Merci de m'indiquer la date prévue de règlement, ou de me contacter en cas de difficulté.",
                "",
                _signature(sender_name, lang),
            ]
        )
    return EmailMessage(subject=subject, preheader=preheader, body=body)


def build_email_verification_email(
    *,
    lang: EmailLang,
    greeting: str,
    verify_url: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Confirm your email — MemoryHub",
            preheader="One click to activate your MemoryHub account",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    "Welcome to MemoryHub. Please confirm your email address to secure your account:",
                    "",
                    verify_url,
                    "",
                    "If you did not create an account, you can ignore this message.",
                    "",
                    "Best regards,",
                    "The MemoryHub team",
                ]
            ),
        )
    return EmailMessage(
        subject="Confirmez votre adresse e-mail — MemoryHub",
        preheader="Un clic pour activer votre compte MemoryHub",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                "Bienvenue sur MemoryHub. Confirmez votre adresse e-mail pour sécuriser votre compte :",
                "",
                verify_url,
                "",
                "Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.",
                "",
                "Cordialement,",
                "L'équipe MemoryHub",
            ]
        ),
    )


def build_password_reset_email(
    *,
    lang: EmailLang,
    greeting: str,
    reset_url: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Reset your password — MemoryHub",
            preheader="Secure link to choose a new password",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    "We received a request to reset your MemoryHub password.",
                    "Choose a new password using the link below (valid for 1 hour):",
                    "",
                    reset_url,
                    "",
                    "If you did not request this, you can safely ignore this email.",
                    "",
                    "Best regards,",
                    "The MemoryHub team",
                ]
            ),
        )
    return EmailMessage(
        subject="Réinitialisation de votre mot de passe — MemoryHub",
        preheader="Lien sécurisé pour choisir un nouveau mot de passe",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                "Vous avez demandé la réinitialisation de votre mot de passe MemoryHub.",
                "Choisissez un nouveau mot de passe via le lien ci-dessous (valable 1 heure) :",
                "",
                reset_url,
                "",
                "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
                "",
                "Cordialement,",
                "L'équipe MemoryHub",
            ]
        ),
    )


def build_welcome_email(
    *,
    lang: EmailLang,
    greeting: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Welcome to MemoryHub",
            preheader="Your account is ready — start managing your clients",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    "Your MemoryHub account is active. You can sign in and start organizing clients, quotes, and invoices.",
                    "",
                    "Best regards,",
                    "The MemoryHub team",
                ]
            ),
        )
    return EmailMessage(
        subject="Bienvenue sur MemoryHub",
        preheader="Votre compte est prêt — gérez vos clients sereinement",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                "Votre compte MemoryHub est actif. Connectez-vous pour organiser vos clients, devis et factures.",
                "",
                "Cordialement,",
                "L'équipe MemoryHub",
            ]
        ),
    )


def build_password_changed_email(
    *,
    lang: EmailLang,
    greeting: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your password was changed — MemoryHub",
            preheader="If you did not make this change, contact support immediately",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    "Your MemoryHub password was changed successfully.",
                    "",
                    "If you did not make this change, contact our support team right away.",
                    "",
                    "Best regards,",
                    "The MemoryHub team",
                ]
            ),
        )
    return EmailMessage(
        subject="Votre mot de passe a été modifié — MemoryHub",
        preheader="Si vous n'êtes pas à l'origine de ce changement, contactez le support",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                "Votre mot de passe MemoryHub a été modifié avec succès.",
                "",
                "Si vous n'êtes pas à l'origine de ce changement, contactez immédiatement notre support.",
                "",
                "Cordialement,",
                "L'équipe MemoryHub",
            ]
        ),
    )


def _subscription_signature(lang: EmailLang) -> str:
    if lang == "en":
        return "Best regards,\nThe MemoryHub team"
    return "Cordialement,\nL'équipe MemoryHub"


def build_subscription_trial_started_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub trial has started",
            preheader=f"Plan: {plan_name}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your trial on the {plan_name} plan is now active.",
                    "Explore MemoryHub and manage your clients with confidence.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre essai MemoryHub a démarré",
        preheader=f"Offre : {plan_name}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre essai sur l'offre {plan_name} est maintenant actif.",
                "Découvrez MemoryHub et gérez vos clients sereinement.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_activated_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub subscription is active",
            preheader=f"Plan: {plan_name}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your subscription to the {plan_name} plan is now active.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre abonnement MemoryHub est actif",
        preheader=f"Offre : {plan_name}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre abonnement à l'offre {plan_name} est maintenant actif.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_renewed_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub subscription was renewed",
            preheader=f"Plan: {plan_name}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your {plan_name} subscription has been renewed successfully.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre abonnement MemoryHub a été renouvelé",
        preheader=f"Offre : {plan_name}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre abonnement {plan_name} a été renouvelé avec succès.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_plan_changed_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub plan was updated",
            preheader=f"New plan: {plan_name}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your subscription is now on the {plan_name} plan.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre offre MemoryHub a été modifiée",
        preheader=f"Nouvelle offre : {plan_name}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre abonnement est désormais sur l'offre {plan_name}.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_cancellation_scheduled_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
    period_end: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub cancellation is scheduled",
            preheader=f"Active until {period_end}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your {plan_name} subscription will end on {period_end}.",
                    "You keep access until that date.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre annulation MemoryHub est programmée",
        preheader=f"Actif jusqu'au {period_end}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre abonnement {plan_name} prendra fin le {period_end}.",
                "Vous conservez l'accès jusqu'à cette date.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_cancelled_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub subscription has ended",
            preheader=f"Plan: {plan_name}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your {plan_name} subscription has ended.",
                    "You can reactivate anytime from your billing settings.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre abonnement MemoryHub est terminé",
        preheader=f"Offre : {plan_name}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre abonnement {plan_name} est terminé.",
                "Vous pouvez le réactiver à tout moment depuis vos paramètres de facturation.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_reactivated_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub subscription is active again",
            preheader=f"Plan: {plan_name}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your {plan_name} subscription is active again.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre abonnement MemoryHub est réactivé",
        preheader=f"Offre : {plan_name}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre abonnement {plan_name} est de nouveau actif.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_payment_failed_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
    billing_url: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Payment failed — action required",
            preheader="Update your billing details to keep your subscription",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"We could not process the payment for your {plan_name} subscription.",
                    "Please update your billing details to avoid interruption:",
                    "",
                    billing_url,
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Échec de paiement — action requise",
        preheader="Mettez à jour vos informations de facturation",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Nous n'avons pas pu traiter le paiement de votre abonnement {plan_name}.",
                "Mettez à jour vos informations de facturation pour éviter une interruption :",
                "",
                billing_url,
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_subscription_expired_email(
    *,
    lang: EmailLang,
    greeting: str,
    plan_name: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject="Your MemoryHub subscription has expired",
            preheader=f"Plan: {plan_name}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"Your {plan_name} subscription has expired due to unpaid invoices.",
                    "Reactivate from your billing settings when ready.",
                    "",
                    _subscription_signature(lang),
                ]
            ),
        )
    return EmailMessage(
        subject="Votre abonnement MemoryHub a expiré",
        preheader=f"Offre : {plan_name}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"Votre abonnement {plan_name} a expiré suite à des factures impayées.",
                "Réactivez-le depuis vos paramètres de facturation lorsque vous le souhaitez.",
                "",
                _subscription_signature(lang),
            ]
        ),
    )


def build_quote_accepted_email(
    *,
    lang: EmailLang,
    greeting: str,
    client_name: str,
    number: str,
    amount_ttc: int,
) -> EmailMessage:
    amount = format_amount(amount_ttc, lang)
    if lang == "en":
        return EmailMessage(
            subject=f"Quote no. {number} accepted",
            preheader=f"{client_name} accepted your quote for {amount}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"{client_name} accepted quote no. {number} ({amount}) via the client portal.",
                    "",
                    "Best regards,",
                    "MemoryHub",
                ]
            ),
        )
    return EmailMessage(
        subject=f"Devis n°{number} accepté",
        preheader=f"{client_name} a accepté votre devis pour {amount}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"{client_name} a accepté le devis n°{number} ({amount}) via l'espace client.",
                "",
                "Cordialement,",
                "MemoryHub",
            ]
        ),
    )


def build_quote_rejected_email(
    *,
    lang: EmailLang,
    greeting: str,
    client_name: str,
    number: str,
    amount_ttc: int,
) -> EmailMessage:
    amount = format_amount(amount_ttc, lang)
    if lang == "en":
        return EmailMessage(
            subject=f"Quote no. {number} declined",
            preheader=f"{client_name} declined your quote for {amount}",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"{client_name} declined quote no. {number} ({amount}) via the client portal.",
                    "",
                    "Best regards,",
                    "MemoryHub",
                ]
            ),
        )
    return EmailMessage(
        subject=f"Devis n°{number} refusé",
        preheader=f"{client_name} a refusé votre devis pour {amount}",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"{client_name} a refusé le devis n°{number} ({amount}) via l'espace client.",
                "",
                "Cordialement,",
                "MemoryHub",
            ]
        ),
    )


def build_payment_recorded_email(
    *,
    lang: EmailLang,
    greeting: str,
    number: str,
    amount: int,
    amount_due: int,
    portal_url: Optional[str] = None,
) -> EmailMessage:
    paid = format_amount(amount, lang)
    due = format_amount(amount_due, lang)
    if lang == "en":
        subject = f"Payment recorded — invoice no. {number}"
        preheader = f"Payment of {paid} recorded"
        lines = [
            f"Hello {greeting},",
            "",
            f"A payment of {paid} was recorded on invoice no. {number}.",
            f"Remaining balance: {due}.",
        ]
        if portal_url:
            lines.extend(["", f"View your invoice online:\n{portal_url}"])
        lines.extend(["", "Best regards,", "MemoryHub"])
        body = "\n".join(lines)
    else:
        subject = f"Paiement enregistré — facture n°{number}"
        preheader = f"Paiement de {paid} enregistré"
        lines = [
            f"Bonjour {greeting},",
            "",
            f"Un paiement de {paid} a été enregistré sur la facture n°{number}.",
            f"Reste à régler : {due}.",
        ]
        if portal_url:
            lines.extend(["", f"Consulter votre facture en ligne :\n{portal_url}"])
        lines.extend(["", "Cordialement,", "MemoryHub"])
        body = "\n".join(lines)
    return EmailMessage(subject=subject, preheader=preheader, body=body)


def build_portal_access_email(
    *,
    lang: EmailLang,
    greeting: str,
    sender_name: str,
    portal_url: str,
) -> EmailMessage:
    if lang == "en":
        return EmailMessage(
            subject=f"Your client portal — {sender_name}",
            preheader="View your quotes and invoices online",
            body="\n".join(
                [
                    f"Hello {greeting},",
                    "",
                    f"{sender_name} has shared a secure link to view your quotes and invoices:",
                    "",
                    portal_url,
                    "",
                    "This link is private — do not share it with others.",
                    "",
                    "Best regards,",
                    sender_name,
                ]
            ),
        )
    return EmailMessage(
        subject=f"Votre espace client — {sender_name}",
        preheader="Consultez vos devis et factures en ligne",
        body="\n".join(
            [
                f"Bonjour {greeting},",
                "",
                f"{sender_name} vous partage un lien sécurisé pour consulter vos devis et factures :",
                "",
                portal_url,
                "",
                "Ce lien est personnel — ne le partagez pas.",
                "",
                "Cordialement,",
                sender_name,
            ]
        ),
    )
