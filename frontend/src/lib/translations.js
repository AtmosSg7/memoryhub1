export const translations = {
  fr: {
    nav: {
      features: "Fonctionnalités",
      how: "Fonctionnement",
      pricing: "Tarifs",
      faq: "FAQ",
      cta: "Rejoindre la bêta",
      myAccount: "Mon espace",
    },
    hero: {
      pill: "Bêta privée · Réservé aux artisans & indépendants",
      title_1: "Toute l'histoire client,",
      title_2: "en moins de 5 secondes.",
      subtitle:
        "MemoryHub connecte Gmail, Google Drive et Notion pour retrouver instantanément chaque email, devis, facture, note et document lié à un client. Zéro dossier oublié.",
      primary: "Rejoindre la bêta",
      secondary: "Voir une démo",
      trust: "Utilisé par des artisans, freelances et TPE partout en France.",
    },
    search: {
      kicker: "La démo",
      title: "Votre client appelle…",
      subtitle:
        "Tapez son nom. MemoryHub rassemble tous ses emails, devis, factures, notes Notion, documents Drive et photos — sur un seul écran.",
      placeholder: "Rechercher un client, un projet, une facture…",
      hint: "Appuyez sur Entrée",
    },
    dashboard: {
      status: "Client actif",
      job: "Menuiserie · Rénovation",
      city: "Nantes, Loire-Atlantique",
      contact: "Contact",
      lastInteraction: "Dernière interaction",
      ago: "il y a 2 jours",
      tabs: {
        summary: "Résumé IA",
        emails: "Emails",
        quotes: "Devis",
        invoices: "Factures",
        drive: "Google Drive",
        notion: "Notes Notion",
        photos: "Photos",
      },
      ai: {
        title: "Résumé généré par MemoryHub AI",
        body:
          "Didier Martin est client depuis mars 2023. Chantier en cours : rénovation d'une bibliothèque en chêne massif (livraison prévue le 22 janvier). Devis #DM-142 accepté pour 4 850 € HT. Dernier échange : demande de modification sur la teinte. Deux factures réglées, une en attente. Sensible aux délais, préfère un contact téléphonique en fin de journée.",
        chips: ["Client fidèle", "Paiement à 30 jours", "Chantier prioritaire"],
      },
      emails: [
        { from: "Didier Martin", subj: "Re: Modification teinte bibliothèque", time: "09:24", snippet: "Bonjour Julien, j'aimerais finalement partir sur un chêne un peu plus foncé, style noyer clair…" },
        { from: "Didier Martin", subj: "Confirmation rendez-vous jeudi", time: "Hier", snippet: "Parfait pour jeudi 14h. Ma femme sera présente pour valider avec vous les finitions…" },
        { from: "Didier Martin", subj: "Devis reçu — merci", time: "12 déc.", snippet: "Bien reçu le devis, c'est validé. Vous pouvez lancer la commande du bois." },
      ],
      quotes: [
        { ref: "DM-142", label: "Bibliothèque chêne massif", amount: "4 850 €", status: "Accepté" },
        { ref: "DM-118", label: "Table de salle à manger", amount: "2 300 €", status: "Accepté" },
        { ref: "DM-097", label: "Étagères murales sur mesure", amount: "890 €", status: "Payé" },
      ],
      invoices: [
        { ref: "FA-2025-014", label: "Acompte bibliothèque", amount: "2 425 €", status: "Payée" },
        { ref: "FA-2025-011", label: "Table salle à manger", amount: "2 300 €", status: "Payée" },
        { ref: "FA-2025-020", label: "Solde bibliothèque", amount: "2 425 €", status: "En attente" },
      ],
      drive: [
        { name: "Plan_bibliotheque_V3.pdf", meta: "PDF · 2,3 Mo · Modifié il y a 3 j" },
        { name: "Contrat_Martin_signe.pdf", meta: "PDF · 480 Ko · 12 déc." },
        { name: "Photos_chantier.zip", meta: "Archive · 84 Mo · 09 déc." },
        { name: "Devis_DM-142.docx", meta: "Document · 210 Ko · 03 déc." },
      ],
      notion: [
        { title: "Brief chantier Martin", tag: "Projet", meta: "Mis à jour hier" },
        { title: "Préférences client (teintes, contact, horaires)", tag: "CRM", meta: "Mis à jour il y a 5 j" },
        { title: "Suivi livraison bois de chêne", tag: "Logistique", meta: "Mis à jour il y a 1 sem." },
      ],
      photosCaption: "Chantier — 3 photos récentes",
    },
    features: {
      kicker: "Fonctionnalités",
      title: "Un cerveau connecté à toute votre activité client.",
      subtitle:
        "MemoryHub relie vos outils du quotidien et transforme le chaos en une fiche client parfaitement organisée.",
      items: [
        { title: "Recherche universelle", body: "Un seul champ pour trouver n'importe quel email, devis ou document — en moins de 5 secondes." },
        { title: "Résumé IA par client", body: "Une synthèse claire de l'historique, des préférences et des points à suivre, générée automatiquement." },
        { title: "Timeline unifiée", body: "Emails, devis, factures et notes Notion regroupés dans un fil chronologique par client." },
        { title: "Intégrations natives", body: "Gmail, Google Drive et Notion sont connectés en 2 minutes, sans configuration technique." },
        { title: "Confidentialité stricte", body: "Vos données restent chiffrées, hébergées en Europe, et jamais utilisées pour entraîner un modèle." },
        { title: "Mobile-first", body: "Retrouvez l'historique complet d'un client depuis votre téléphone, entre deux rendez-vous chantier." },
      ],
    },
    how: {
      kicker: "Comment ça marche",
      title: "Trois étapes. Zéro effort.",
      steps: [
        { n: "01", title: "Connectez vos outils", body: "Un clic pour lier Gmail, Google Drive et Notion. MemoryHub lit uniquement, ne modifie rien." },
        { n: "02", title: "L'IA range pour vous", body: "MemoryHub identifie chaque client, regroupe les documents et génère un résumé intelligent." },
        { n: "03", title: "Cherchez, retrouvez, servez", body: "Tapez un nom. Retrouvez toute l'histoire du client, prêt à répondre en 5 secondes." },
      ],
    },
    pricing: {
      kicker: "Tarifs",
      title: "Un prix simple. Sans surprise.",
      subtitle: "Essai gratuit 14 jours. Sans carte bancaire. Annulez à tout moment.",
      per: "/mois",
      cta: "Rejoindre la bêta",
      most: "Le plus populaire",
      plans: [
        {
          name: "Solo",
          price: "19",
          desc: "Pour l'artisan ou le freelance qui gère tout seul.",
          features: ["Jusqu'à 200 clients", "Gmail + Drive + Notion", "Recherche universelle", "Résumés IA basiques"],
        },
        {
          name: "Pro",
          price: "49",
          desc: "Pour l'indépendant établi avec un volume client soutenu.",
          features: ["Clients illimités", "Résumés IA avancés", "Alertes de relance intelligentes", "Historique complet 5 ans", "Support prioritaire"],
        },
        {
          name: "Team",
          price: "99",
          desc: "Pour la TPE ou l'atelier avec plusieurs collaborateurs.",
          features: ["Jusqu'à 5 utilisateurs", "Fiches partagées en équipe", "Permissions par rôle", "Intégrations sur mesure", "Onboarding dédié"],
        },
      ],
    },
    faq: {
      kicker: "FAQ",
      title: "Questions fréquentes.",
      items: [
        { q: "Est-ce que MemoryHub modifie mes emails ou mes fichiers ?", a: "Non. MemoryHub accède en lecture seule à vos comptes Gmail, Drive et Notion. Rien n'est modifié, rien n'est supprimé." },
        { q: "Où sont hébergées mes données ?", a: "Les données sont chiffrées et hébergées exclusivement en Europe (Paris & Francfort). Elles ne servent jamais à entraîner un modèle IA." },
        { q: "Combien de temps pour connecter mes outils ?", a: "Environ 2 minutes. Un clic pour Gmail, un clic pour Drive, un clic pour Notion. MemoryHub s'occupe du reste." },
        { q: "Puis-je annuler à tout moment ?", a: "Oui. Aucun engagement, aucune carte bancaire pour l'essai. Vous pouvez arrêter en un clic depuis les paramètres." },
        { q: "Est-ce que ça marche pour un artisan seul ?", a: "Oui, le plan Solo est pensé pour les artisans et freelances qui veulent gagner du temps sans complexifier leur quotidien." },
      ],
    },
    finalCta: {
      title: "Ne cherchez plus. Retrouvez.",
      subtitle: "Rejoignez la bêta privée. Places limitées à 300 artisans et indépendants.",
      cta: "Rejoindre la bêta",
      note: "Sans carte bancaire · Configuration en 2 minutes",
    },
    footer: {
      tagline: "Le cerveau client des artisans et indépendants.",
      product: "Produit",
      company: "Société",
      legal: "Légal",
      about: "À propos",
      contact: "Contact",
      privacy: "Confidentialité",
      terms: "Conditions",
      legalNotice: "Mentions légales",
      cookies: "Cookies",
      rights: "Tous droits réservés.",
    },
    legal: {
      layout: {
        backHome: "Retour à l'accueil",
        lastUpdatedLabel: "Dernière mise à jour",
      },
      notice: {
        title: "Mentions légales",
        metaDescription:
          "Mentions légales de MemoryHub — éditeur, hébergement, propriété intellectuelle et contact.",
        lastUpdated: "4 juillet 2026",
        sections: [
          {
            heading: "Éditeur du site",
            paragraphs: [
              "Le site memoryhub.fr (ci-après « le Site ») est édité par [NOM DE LA SOCIÉTÉ], [FORME JURIDIQUE] au capital de [CAPITAL SOCIAL] euros, immatriculée au Registre du Commerce et des Sociétés de [VILLE] sous le numéro [SIRET].",
              "Siège social : [ADRESSE].",
              "Directeur de la publication : [NOM DU DIRECTEUR DE PUBLICATION].",
              "Contact : [EMAIL CONTACT].",
            ],
          },
          {
            heading: "Activité",
            paragraphs: [
              "MemoryHub est un logiciel en ligne (SaaS) destiné aux artisans, freelances et TPE, permettant de centraliser et rechercher l'historique client à partir d'intégrations avec Gmail, Google Drive et Notion.",
            ],
          },
          {
            heading: "Hébergement",
            paragraphs: [
              "Le Site et les services associés sont hébergés par [HÉBERGEUR], [ADRESSE HÉBERGEUR].",
              "Les données applicatives sont stockées exclusivement au sein de l'Union européenne (régions Paris et Francfort).",
            ],
          },
          {
            heading: "Propriété intellectuelle",
            paragraphs: [
              "L'ensemble des éléments du Site (textes, graphismes, logo, icônes, images, logiciels, base de données, structure) est protégé par le droit de la propriété intellectuelle et reste la propriété exclusive de [NOM DE LA SOCIÉTÉ] ou de ses partenaires.",
              "Toute reproduction, représentation, modification ou exploitation, totale ou partielle, sans autorisation écrite préalable est interdite.",
            ],
          },
          {
            heading: "Limitation de responsabilité",
            paragraphs: [
              "[NOM DE LA SOCIÉTÉ] s'efforce d'assurer l'exactitude des informations publiées sur le Site. Toutefois, elle ne saurait garantir l'absence d'erreurs ou d'omissions.",
              "L'utilisation du Site se fait sous la responsabilité exclusive de l'utilisateur. [NOM DE LA SOCIÉTÉ] ne pourra être tenue responsable des dommages directs ou indirects résultant de l'accès ou de l'utilisation du Site.",
            ],
          },
          {
            heading: "Droit applicable",
            paragraphs: [
              "Les présentes mentions légales sont régies par le droit français. En cas de litige, et à défaut de résolution amiable, les tribunaux compétents seront ceux du ressort du siège social de l'éditeur, sous réserve des dispositions impératives applicables aux consommateurs.",
            ],
          },
        ],
      },
      privacy: {
        title: "Politique de confidentialité",
        metaDescription:
          "Politique de confidentialité MemoryHub — données collectées, finalités, durées de conservation et vos droits RGPD.",
        lastUpdated: "4 juillet 2026",
        sections: [
          {
            heading: "Responsable du traitement",
            paragraphs: [
              "Le responsable du traitement des données personnelles est [NOM DE LA SOCIÉTÉ], [ADRESSE], joignable à [EMAIL CONTACT].",
              "MemoryHub traite des données dans le cadre de la fourniture de son service de recherche et de centralisation d'historique client pour les artisans et indépendants.",
            ],
          },
          {
            heading: "Données collectées",
            paragraphs: [
              "Selon votre utilisation du Site et du service, nous pouvons traiter les catégories de données suivantes :",
            ],
            list: [
              "Données d'identification et de contact (nom, prénom, adresse e-mail professionnelle, nom d'entreprise) lors de l'inscription à la bêta ou de la création d'un compte.",
              "Données de connexion aux services tiers que vous autorisez (Gmail, Google Drive, Notion) — MemoryHub accède en lecture seule aux contenus nécessaires au fonctionnement du service.",
              "Données techniques (adresse IP, logs, identifiants de session, type de navigateur) à des fins de sécurité et de bon fonctionnement.",
              "Données d'usage et de navigation via des cookies analytics (voir notre politique cookies).",
            ],
          },
          {
            heading: "Finalités et bases légales",
            paragraphs: [
              "Vos données sont traitées pour les finalités suivantes, sur les bases légales indiquées :",
            ],
            list: [
              "Fourniture du service MemoryHub et exécution du contrat (base légale : exécution du contrat).",
              "Gestion de la liste d'attente bêta et communication relative au service (base légale : intérêt légitime ou consentement selon le canal).",
              "Sécurité, prévention de la fraude et maintenance technique (base légale : intérêt légitime).",
              "Mesure d'audience et amélioration du produit via PostHog, sous réserve de votre consentement lorsque requis (base légale : consentement).",
              "Respect des obligations légales et réponse aux demandes des autorités compétentes (base légale : obligation légale).",
            ],
          },
          {
            heading: "Données issues des intégrations",
            paragraphs: [
              "Lorsque vous connectez Gmail, Google Drive ou Notion, MemoryHub indexe et organise les contenus autorisés (e-mails, documents, notes) afin de vous permettre de retrouver rapidement l'historique d'un client.",
              "MemoryHub n'utilise pas vos données pour entraîner des modèles d'intelligence artificielle généralistes. Les résumés IA sont générés dans le cadre exclusif de votre compte et de votre usage du service.",
              "Vous pouvez révoquer l'accès à tout moment depuis les paramètres de votre compte ou depuis les interfaces des services tiers concernés.",
            ],
          },
          {
            heading: "Durées de conservation",
            paragraphs: [
              "Les données de compte sont conservées pendant la durée de la relation contractuelle, puis archivées ou supprimées conformément aux obligations légales applicables.",
              "Les données de la liste d'attente bêta sont conservées jusqu'à 24 mois après votre dernière interaction, sauf demande de suppression anticipée.",
              "Les logs techniques sont conservés pour une durée maximale de 12 mois.",
            ],
          },
          {
            heading: "Destinataires et sous-traitants",
            paragraphs: [
              "Vos données sont accessibles uniquement aux personnes habilitées de [NOM DE LA SOCIÉTÉ] et à nos sous-traitants strictement nécessaires à la fourniture du service, notamment :",
            ],
            list: [
              "[HÉBERGEUR] — hébergement de l'infrastructure.",
              "PostHog — mesure d'audience et analytics (données pseudonymisées lorsque possible).",
              "Prestataires d'e-mailing et de support client, le cas échéant.",
            ],
          },
          {
            heading: "Transferts hors Union européenne",
            paragraphs: [
              "MemoryHub vise un hébergement et un traitement des données au sein de l'Union européenne. Si un sous-traitant implique un transfert hors UE, celui-ci est encadré par des garanties appropriées (Clauses Contractuelles Types de la Commission européenne ou décision d'adéquation).",
            ],
          },
          {
            heading: "Vos droits",
            paragraphs: [
              "Conformément au Règlement (UE) 2016/679 (RGPD) et à la loi Informatique et Libertés, vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données.",
              "Pour exercer vos droits, contactez-nous à [EMAIL CONTACT]. Vous pouvez également introduire une réclamation auprès de la CNIL (www.cnil.fr).",
            ],
          },
        ],
      },
      terms: {
        title: "Conditions Générales d'Utilisation",
        metaDescription:
          "CGU MemoryHub — conditions d'accès, d'utilisation du service SaaS et responsabilités.",
        lastUpdated: "4 juillet 2026",
        sections: [
          {
            heading: "Objet",
            paragraphs: [
              "Les présentes Conditions Générales d'Utilisation (ci-après « CGU ») régissent l'accès et l'utilisation du site memoryhub.fr et du service MemoryHub édité par [NOM DE LA SOCIÉTÉ].",
              "MemoryHub est un outil SaaS permettant aux artisans, freelances et TPE de rechercher et centraliser l'historique client à partir d'intégrations avec Gmail, Google Drive et Notion.",
            ],
          },
          {
            heading: "Acceptation",
            paragraphs: [
              "L'accès au Site ou l'utilisation du service implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le service.",
              "Des conditions particulières (offre bêta, abonnement payant) peuvent compléter les présentes CGU ; en cas de contradiction, les conditions particulières prévalent.",
            ],
          },
          {
            heading: "Accès au service",
            paragraphs: [
              "MemoryHub est actuellement proposé en bêta privée. L'accès peut être soumis à inscription sur liste d'attente et validation par [NOM DE LA SOCIÉTÉ].",
              "Nous nous réservons le droit de suspendre, limiter ou interrompre l'accès au service pour maintenance, mise à jour ou raison de sécurité, avec un préavis raisonnable lorsque possible.",
            ],
          },
          {
            heading: "Compte utilisateur",
            paragraphs: [
              "Vous vous engagez à fournir des informations exactes lors de la création de votre compte et à maintenir la confidentialité de vos identifiants.",
              "Vous êtes responsable de toute activité réalisée depuis votre compte. En cas de suspicion d'usage frauduleux, contactez-nous immédiatement à [EMAIL CONTACT].",
            ],
          },
          {
            heading: "Utilisation autorisée",
            paragraphs: [
              "Vous vous engagez à utiliser MemoryHub conformément aux lois et réglementations en vigueur, notamment en matière de protection des données et de propriété intellectuelle.",
            ],
            list: [
              "Ne pas tenter d'accéder de manière non autorisée aux systèmes ou aux données d'autres utilisateurs.",
              "Ne pas utiliser le service à des fins illicites, diffamatoires ou portant atteinte aux droits de tiers.",
              "Ne pas procéder à de l'ingénierie inverse, au scraping massif ou à toute utilisation abusive de l'API.",
            ],
          },
          {
            heading: "Intégrations tierces",
            paragraphs: [
              "MemoryHub se connecte à des services tiers (Google, Notion) via des autorisations que vous accordez. Vous garantissez disposer des droits nécessaires sur les données importées et indexées.",
              "MemoryHub accède en lecture seule aux contenus autorisés et ne modifie ni ne supprime vos fichiers ou e-mails sources.",
            ],
          },
          {
            heading: "Propriété intellectuelle",
            paragraphs: [
              "Le service, son interface, son code, sa marque et sa documentation restent la propriété exclusive de [NOM DE LA SOCIÉTÉ]. Aucune cession de droits de propriété intellectuelle n'est consentie au titre des présentes CGU.",
              "Vous conservez l'ensemble des droits sur vos données et contenus. Vous accordez à [NOM DE LA SOCIÉTÉ] une licence limitée de traitement de ces contenus aux seules fins de fourniture du service.",
            ],
          },
          {
            heading: "Disponibilité et responsabilité",
            paragraphs: [
              "MemoryHub est fourni « en l'état » pendant la phase bêta. Nous mettons en œuvre des moyens raisonnables pour assurer la disponibilité du service, sans garantie de disponibilité ininterrompue.",
              "Dans les limites autorisées par la loi, la responsabilité de [NOM DE LA SOCIÉTÉ] est limitée aux dommages directs prouvés et ne couvre pas les pertes indirectes (perte de chiffre d'affaires, perte de données due à une mauvaise configuration de votre part, etc.).",
            ],
          },
          {
            heading: "Résiliation",
            paragraphs: [
              "Vous pouvez cesser d'utiliser le service et demander la suppression de votre compte à tout moment en contactant [EMAIL CONTACT].",
              "[NOM DE LA SOCIÉTÉ] peut suspendre ou résilier votre accès en cas de violation des présentes CGU, après notification lorsque la situation le permet.",
            ],
          },
          {
            heading: "Modifications et droit applicable",
            paragraphs: [
              "Nous pouvons modifier les présentes CGU. La date de dernière mise à jour est indiquée en haut de cette page. L'utilisation continue du service après modification vaut acceptation des nouvelles conditions.",
              "Les CGU sont soumises au droit français. Tout litige relatif à leur interprétation ou exécution relève des tribunaux compétents du ressort du siège social de [NOM DE LA SOCIÉTÉ], sous réserve des règles impératives de protection des consommateurs.",
            ],
          },
        ],
      },
      cookies: {
        title: "Gestion des cookies",
        metaDescription:
          "Politique cookies MemoryHub — types de cookies, PostHog analytics, liste d'attente bêta et gestion du consentement.",
        lastUpdated: "4 juillet 2026",
        sections: [
          {
            heading: "Qu'est-ce qu'un cookie ?",
            paragraphs: [
              "Un cookie est un petit fichier texte déposé sur votre terminal (ordinateur, tablette, smartphone) lors de la visite d'un site. Il permet de reconnaître votre navigateur et de mémoriser certaines informations.",
              "MemoryHub utilise également des technologies similaires (localStorage, sessionStorage) pour le fonctionnement du site et la mémorisation de vos préférences.",
            ],
          },
          {
            heading: "Cookies strictement nécessaires",
            paragraphs: [
              "Ces cookies sont indispensables au fonctionnement du Site. Ils ne nécessitent pas votre consentement préalable.",
            ],
            list: [
              "Cookie de session et cookies de sécurité (authentification, protection CSRF).",
              "Mémorisation de votre préférence linguistique (FR/EN).",
              "Cookies techniques liés à l'infrastructure d'hébergement [HÉBERGEUR].",
            ],
          },
          {
            heading: "Cookies analytics (PostHog)",
            paragraphs: [
              "MemoryHub utilise PostHog (PostHog Inc.) pour mesurer l'audience, comprendre l'utilisation du Site et améliorer le produit. PostHog peut déposer des cookies ou utiliser des identifiants locaux pour collecter des données pseudonymisées (pages visitées, événements, type d'appareil, durée de session).",
              "Ces cookies ne sont déposés qu'avec votre consentement lorsque la réglementation l'exige. Vous pouvez retirer votre consentement à tout moment via [MÉCANISME DE GESTION DU CONSENTEMENT — ex. bannière cookies ou lien en pied de page].",
            ],
          },
          {
            heading: "Cookies liés à la bêta et à la liste d'attente",
            paragraphs: [
              "Lorsque vous vous inscrivez à la bêta privée, un identifiant technique peut être stocké localement pour éviter les soumissions en double et assurer le suivi de votre demande.",
              "Ces données ne sont pas utilisées à des fins publicitaires et sont conservées pour la durée nécessaire au traitement de votre inscription.",
            ],
          },
          {
            heading: "Durée de conservation",
            paragraphs: [
              "Les cookies de session expirent à la fermeture du navigateur. Les cookies persistants analytics peuvent être conservés jusqu'à 13 mois maximum, conformément aux recommandations de la CNIL.",
            ],
          },
          {
            heading: "Gérer vos préférences",
            paragraphs: [
              "Vous pouvez à tout moment configurer votre navigateur pour refuser les cookies ou être averti de leur dépôt. Le refus de certains cookies peut limiter certaines fonctionnalités du Site.",
              "Pour exercer vos choix concernant PostHog et les cookies non essentiels, utilisez [MÉCANISME DE GESTION DU CONSENTEMENT] ou contactez-nous à [EMAIL CONTACT].",
              {
                link: {
                  before: "Pour en savoir plus sur la protection de vos données, consultez notre ",
                  text: "Politique de confidentialité",
                  href: "/politique-de-confidentialite",
                  after: ".",
                },
              },
            ],
          },
        ],
      },
    },
    joinModal: {
      title: "Rejoindre la bêta privée",
      subtitle: "Laissez votre email, nous vous contactons sous 48h.",
      placeholder: "vous@exemple.fr",
      submit: "M'inscrire",
      loading: "Inscription…",
      success: "Merci ! Vous êtes sur la liste.",
      errorInvalid: "Veuillez entrer une adresse email valide.",
      errorDuplicate: "Cet email est déjà inscrit à la bêta.",
      errorServer: "Une erreur est survenue. Réessayez dans un instant.",
    },
    auth: {
      loading: "Chargement…",
      logout: "Se déconnecter",
      layout: {
        backHome: "Retour à l'accueil",
        backDashboard: "Retour au tableau de bord",
      },
      nav: {
        profile: "Profil",
        settings: "Paramètres",
        billing: "Facturation",
      },
      fields: {
        email: "Adresse email",
        password: "Mot de passe",
        confirmPassword: "Confirmer le mot de passe",
        firstName: "Prénom",
        lastName: "Nom",
        companyName: "Nom de l'entreprise",
      },
      errors: {
        invalidEmail: "Veuillez entrer une adresse email valide.",
        passwordRequired: "Le mot de passe est requis.",
        passwordMin: "Le mot de passe doit contenir au moins 8 caractères.",
        confirmPasswordRequired: "Veuillez confirmer votre mot de passe.",
        passwordMismatch: "Les mots de passe ne correspondent pas.",
        firstNameRequired: "Le prénom est requis.",
        lastNameRequired: "Le nom est requis.",
        companyRequired: "Le nom de l'entreprise est requis.",
        loginFailed: "Email ou mot de passe incorrect.",
        registerFailed: "Impossible de créer le compte.",
        generic: "Une erreur est survenue. Réessayez dans un instant.",
      },
      login: {
        title: "Connexion",
        subtitle: "Accédez à votre espace MemoryHub.",
        submit: "Se connecter",
        loading: "Connexion…",
        forgotPassword: "Mot de passe oublié ?",
        noAccount: "Pas encore de compte ?",
        createAccount: "Créer un compte",
      },
      register: {
        title: "Créer un compte",
        subtitle: "Rejoignez MemoryHub en quelques secondes.",
        submit: "Créer mon compte",
        loading: "Création…",
        hasAccount: "Déjà un compte ?",
        signIn: "Se connecter",
      },
      forgotPassword: {
        title: "Mot de passe oublié",
        subtitle: "Entrez votre email pour recevoir un lien de réinitialisation.",
        submit: "Envoyer le lien",
        loading: "Envoi…",
        successTitle: "Email envoyé",
        successSubtitle: "Consultez votre boîte de réception.",
        successBody: "Si un compte existe pour cette adresse, un lien de réinitialisation vous sera envoyé sous peu.",
        backToLogin: "Retour à la connexion",
      },
      verifyEmail: {
        title: "Vérification de l'email",
        loading: "Vérification en cours…",
        successTitle: "Email vérifié",
        errorTitle: "Échec de la vérification",
        success: "Votre adresse email a été vérifiée avec succès.",
        error: "Ce lien de vérification est invalide ou expiré.",
        missingToken: "Lien de vérification manquant ou invalide.",
        backToLogin: "Retour à la connexion",
      },
      dashboard: {
        badge: "Espace client",
        title: "Tableau de bord bientôt disponible",
        subtitle: "Nous préparons votre espace MemoryHub. Revenez très bientôt.",
        welcome: "Bonjour {name}, bienvenue dans votre espace.",
      },
      settings: {
        badge: "Paramètres",
        title: "Paramètres bientôt disponibles",
        subtitle: "La gestion de votre compte arrive prochainement.",
      },
      billing: {
        badge: "Facturation",
        title: "Facturation bientôt disponible",
        subtitle: "La gestion de votre abonnement arrive prochainement.",
      },
      profile: {
        badge: "Profil",
        title: "Profil bientôt disponible",
        subtitle: "La personnalisation de votre profil arrive prochainement.",
      },
    },
  },
  en: {
    nav: {
      features: "Features",
      how: "How it works",
      pricing: "Pricing",
      faq: "FAQ",
      cta: "Join the Beta",
      myAccount: "My account",
    },
    hero: {
      pill: "Private beta · Built for artisans & freelancers",
      title_1: "Every piece of client history,",
      title_2: "in under 5 seconds.",
      subtitle:
        "MemoryHub connects Gmail, Google Drive and Notion to instantly surface every email, quote, invoice, note and document tied to a client. Nothing slips through.",
      primary: "Join the Beta",
      secondary: "Watch demo",
      trust: "Trusted by artisans, freelancers and small businesses across France.",
    },
    search: {
      kicker: "The demo",
      title: "Your client calls…",
      subtitle:
        "Type their name. MemoryHub pulls together every email, quote, invoice, Notion note, Drive doc and photo — on a single screen.",
      placeholder: "Search a client, a project, an invoice…",
      hint: "Press Enter",
    },
    dashboard: {
      status: "Active client",
      job: "Woodworking · Renovation",
      city: "Nantes, Loire-Atlantique",
      contact: "Contact",
      lastInteraction: "Last interaction",
      ago: "2 days ago",
      tabs: {
        summary: "AI Summary",
        emails: "Emails",
        quotes: "Quotes",
        invoices: "Invoices",
        drive: "Google Drive",
        notion: "Notion notes",
        photos: "Photos",
      },
      ai: {
        title: "Summary generated by MemoryHub AI",
        body:
          "Didier Martin has been a client since March 2023. Current project: a solid oak bookshelf (delivery scheduled Jan 22). Quote #DM-142 accepted for €4,850. Latest exchange: request to darken the wood stain. Two invoices paid, one pending. Timeline-sensitive; prefers late-afternoon phone calls.",
        chips: ["Loyal client", "Net 30", "Priority project"],
      },
      emails: [
        { from: "Didier Martin", subj: "Re: Bookshelf stain change", time: "09:24", snippet: "Hi Julien, I'd like to switch to a slightly darker oak, closer to a light walnut…" },
        { from: "Didier Martin", subj: "Thursday appointment confirmed", time: "Yesterday", snippet: "Thursday 2pm works. My wife will be there to sign off the finishes with you…" },
        { from: "Didier Martin", subj: "Quote received — thanks", time: "Dec 12", snippet: "Got the quote, all good. You can go ahead and order the wood." },
      ],
      quotes: [
        { ref: "DM-142", label: "Solid oak bookshelf", amount: "€4,850", status: "Accepted" },
        { ref: "DM-118", label: "Dining table", amount: "€2,300", status: "Accepted" },
        { ref: "DM-097", label: "Custom wall shelves", amount: "€890", status: "Paid" },
      ],
      invoices: [
        { ref: "INV-2025-014", label: "Bookshelf deposit", amount: "€2,425", status: "Paid" },
        { ref: "INV-2025-011", label: "Dining table", amount: "€2,300", status: "Paid" },
        { ref: "INV-2025-020", label: "Bookshelf balance", amount: "€2,425", status: "Pending" },
      ],
      drive: [
        { name: "Bookshelf_plan_V3.pdf", meta: "PDF · 2.3 MB · Edited 3d ago" },
        { name: "Martin_signed_contract.pdf", meta: "PDF · 480 KB · Dec 12" },
        { name: "Jobsite_photos.zip", meta: "Archive · 84 MB · Dec 09" },
        { name: "Quote_DM-142.docx", meta: "Doc · 210 KB · Dec 03" },
      ],
      notion: [
        { title: "Martin project brief", tag: "Project", meta: "Updated yesterday" },
        { title: "Client preferences (stain, contact, hours)", tag: "CRM", meta: "Updated 5d ago" },
        { title: "Oak wood delivery tracking", tag: "Logistics", meta: "Updated 1w ago" },
      ],
      photosCaption: "Jobsite — 3 recent photos",
    },
    features: {
      kicker: "Features",
      title: "One brain wired to your entire client business.",
      subtitle:
        "MemoryHub connects the tools you already use and turns the chaos into a perfectly organized client record.",
      items: [
        { title: "Universal search", body: "One search field to find any email, quote or document — in under 5 seconds." },
        { title: "AI client summary", body: "A clear synthesis of history, preferences and next steps, generated automatically per client." },
        { title: "Unified timeline", body: "Emails, quotes, invoices and Notion notes stitched into a single chronological feed." },
        { title: "Native integrations", body: "Gmail, Google Drive and Notion connect in 2 minutes. No technical setup." },
        { title: "Strict privacy", body: "Your data stays encrypted, hosted in Europe, and is never used to train any model." },
        { title: "Mobile-first", body: "Pull up the full client history from your phone, between two on-site meetings." },
      ],
    },
    how: {
      kicker: "How it works",
      title: "Three steps. Zero effort.",
      steps: [
        { n: "01", title: "Connect your tools", body: "One click to link Gmail, Google Drive and Notion. MemoryHub reads only — never modifies." },
        { n: "02", title: "AI files everything", body: "MemoryHub identifies each client, groups their documents and writes an intelligent summary." },
        { n: "03", title: "Search, find, serve", body: "Type a name. Get the full client story, ready to reply in 5 seconds flat." },
      ],
    },
    pricing: {
      kicker: "Pricing",
      title: "Simple pricing. No surprises.",
      subtitle: "14-day free trial. No credit card. Cancel anytime.",
      per: "/month",
      cta: "Join the Beta",
      most: "Most popular",
      plans: [
        {
          name: "Solo",
          price: "19",
          desc: "For the artisan or freelancer running the whole show.",
          features: ["Up to 200 clients", "Gmail + Drive + Notion", "Universal search", "Basic AI summaries"],
        },
        {
          name: "Pro",
          price: "49",
          desc: "For the established freelancer with steady client volume.",
          features: ["Unlimited clients", "Advanced AI summaries", "Smart follow-up alerts", "5-year full history", "Priority support"],
        },
        {
          name: "Team",
          price: "99",
          desc: "For small businesses and workshops with multiple team members.",
          features: ["Up to 5 seats", "Shared client records", "Role-based permissions", "Custom integrations", "Dedicated onboarding"],
        },
      ],
    },
    faq: {
      kicker: "FAQ",
      title: "Frequently asked questions.",
      items: [
        { q: "Does MemoryHub modify my emails or files?", a: "No. MemoryHub accesses your Gmail, Drive and Notion accounts in read-only mode. Nothing is modified, nothing is deleted." },
        { q: "Where is my data hosted?", a: "Data is encrypted and hosted exclusively in Europe (Paris & Frankfurt). It is never used to train any AI model." },
        { q: "How long does it take to connect my tools?", a: "About 2 minutes. One click for Gmail, one for Drive, one for Notion. MemoryHub handles the rest." },
        { q: "Can I cancel anytime?", a: "Yes. No commitment, no credit card required for the trial. You can stop in a single click from your settings." },
        { q: "Does it work for a solo artisan?", a: "Yes — the Solo plan is designed for artisans and freelancers who want to save time without adding complexity." },
      ],
    },
    finalCta: {
      title: "Stop searching. Start remembering.",
      subtitle: "Join the private beta. Limited to 300 artisans and freelancers.",
      cta: "Join the Beta",
      note: "No credit card · 2-minute setup",
    },
    footer: {
      tagline: "The client brain for artisans and freelancers.",
      product: "Product",
      company: "Company",
      legal: "Legal",
      about: "About",
      contact: "Contact",
      privacy: "Privacy",
      terms: "Terms",
      legalNotice: "Legal notice",
      cookies: "Cookies",
      rights: "All rights reserved.",
    },
    legal: {
      layout: {
        backHome: "Back to home",
        lastUpdatedLabel: "Last updated",
      },
      notice: {
        title: "Legal Notice",
        metaDescription:
          "MemoryHub legal notice — publisher, hosting, intellectual property and contact information.",
        lastUpdated: "July 4, 2026",
        sections: [
          {
            heading: "Website publisher",
            paragraphs: [
              "The website memoryhub.fr (the \"Site\") is published by [NOM DE LA SOCIÉTÉ], a [FORME JURIDIQUE] with share capital of [CAPITAL SOCIAL] euros, registered with the Trade and Companies Register of [VILLE] under number [SIRET].",
              "Registered office: [ADRESSE].",
              "Publication director: [NOM DU DIRECTEUR DE PUBLICATION].",
              "Contact: [EMAIL CONTACT].",
            ],
          },
          {
            heading: "Business activity",
            paragraphs: [
              "MemoryHub is an online software service (SaaS) designed for artisans, freelancers and small businesses, enabling them to centralize and search client history through integrations with Gmail, Google Drive and Notion.",
            ],
          },
          {
            heading: "Hosting",
            paragraphs: [
              "The Site and related services are hosted by [HÉBERGEUR], [ADRESSE HÉBERGEUR].",
              "Application data is stored exclusively within the European Union (Paris and Frankfurt regions).",
            ],
          },
          {
            heading: "Intellectual property",
            paragraphs: [
              "All elements of the Site (text, graphics, logo, icons, images, software, database, structure) are protected by intellectual property law and remain the exclusive property of [NOM DE LA SOCIÉTÉ] or its partners.",
              "Any reproduction, representation, modification or exploitation, in whole or in part, without prior written authorization is prohibited.",
            ],
          },
          {
            heading: "Limitation of liability",
            paragraphs: [
              "[NOM DE LA SOCIÉTÉ] strives to ensure the accuracy of information published on the Site. However, it cannot guarantee the absence of errors or omissions.",
              "Use of the Site is at the user's sole responsibility. [NOM DE LA SOCIÉTÉ] shall not be liable for direct or indirect damages resulting from access to or use of the Site.",
            ],
          },
          {
            heading: "Applicable law",
            paragraphs: [
              "This legal notice is governed by French law. In the event of a dispute, and failing amicable resolution, the competent courts shall be those within the jurisdiction of the publisher's registered office, subject to mandatory consumer protection rules.",
            ],
          },
        ],
      },
      privacy: {
        title: "Privacy Policy",
        metaDescription:
          "MemoryHub privacy policy — data collected, purposes, retention periods and your GDPR rights.",
        lastUpdated: "July 4, 2026",
        sections: [
          {
            heading: "Data controller",
            paragraphs: [
              "The data controller is [NOM DE LA SOCIÉTÉ], [ADRESSE], reachable at [EMAIL CONTACT].",
              "MemoryHub processes data in connection with providing its client history search and centralization service for artisans and freelancers.",
            ],
          },
          {
            heading: "Data we collect",
            paragraphs: [
              "Depending on your use of the Site and service, we may process the following categories of data:",
            ],
            list: [
              "Identification and contact data (name, professional email address, company name) when signing up for the beta or creating an account.",
              "Connection data from third-party services you authorize (Gmail, Google Drive, Notion) — MemoryHub accesses only the content required for the service, in read-only mode.",
              "Technical data (IP address, logs, session identifiers, browser type) for security and proper operation.",
              "Usage and navigation data via analytics cookies (see our cookie policy).",
            ],
          },
          {
            heading: "Purposes and legal bases",
            paragraphs: [
              "Your data is processed for the following purposes, on the legal bases indicated:",
            ],
            list: [
              "Providing the MemoryHub service and performing the contract (legal basis: contract performance).",
              "Managing the beta waitlist and service-related communications (legal basis: legitimate interest or consent depending on the channel).",
              "Security, fraud prevention and technical maintenance (legal basis: legitimate interest).",
              "Audience measurement and product improvement via PostHog, subject to your consent where required (legal basis: consent).",
              "Compliance with legal obligations and responses to competent authorities (legal basis: legal obligation).",
            ],
          },
          {
            heading: "Data from integrations",
            paragraphs: [
              "When you connect Gmail, Google Drive or Notion, MemoryHub indexes and organizes authorized content (emails, documents, notes) so you can quickly retrieve a client's history.",
              "MemoryHub does not use your data to train general-purpose AI models. AI summaries are generated exclusively within your account and for your use of the service.",
              "You may revoke access at any time from your account settings or from the relevant third-party service interfaces.",
            ],
          },
          {
            heading: "Retention periods",
            paragraphs: [
              "Account data is retained for the duration of the contractual relationship, then archived or deleted in accordance with applicable legal obligations.",
              "Beta waitlist data is retained for up to 24 months after your last interaction, unless you request earlier deletion.",
              "Technical logs are retained for a maximum of 12 months.",
            ],
          },
          {
            heading: "Recipients and subprocessors",
            paragraphs: [
              "Your data is accessible only to authorized personnel of [NOM DE LA SOCIÉTÉ] and subprocessors strictly necessary to provide the service, including:",
            ],
            list: [
              "[HÉBERGEUR] — infrastructure hosting.",
              "PostHog — audience measurement and analytics (pseudonymized data where possible).",
              "Email and customer support providers, where applicable.",
            ],
          },
          {
            heading: "Transfers outside the European Union",
            paragraphs: [
              "MemoryHub aims to host and process data within the European Union. If a subprocessor involves a transfer outside the EU, it is governed by appropriate safeguards (Standard Contractual Clauses or adequacy decision).",
            ],
          },
          {
            heading: "Your rights",
            paragraphs: [
              "Under Regulation (EU) 2016/679 (GDPR) and applicable French data protection law, you have the rights of access, rectification, erasure, restriction, objection and data portability.",
              "To exercise your rights, contact us at [EMAIL CONTACT]. You may also lodge a complaint with the CNIL (www.cnil.fr).",
            ],
          },
        ],
      },
      terms: {
        title: "Terms of Service",
        metaDescription:
          "MemoryHub Terms of Service — access conditions, SaaS usage rules and liability.",
        lastUpdated: "July 4, 2026",
        sections: [
          {
            heading: "Purpose",
            paragraphs: [
              "These Terms of Service (\"Terms\") govern access to and use of the website memoryhub.fr and the MemoryHub service published by [NOM DE LA SOCIÉTÉ].",
              "MemoryHub is a SaaS tool enabling artisans, freelancers and small businesses to search and centralize client history through integrations with Gmail, Google Drive and Notion.",
            ],
          },
          {
            heading: "Acceptance",
            paragraphs: [
              "Accessing the Site or using the service implies full acceptance of these Terms. If you do not accept these conditions, you must not use the service.",
              "Specific conditions (beta offer, paid subscription) may supplement these Terms; in case of conflict, the specific conditions prevail.",
            ],
          },
          {
            heading: "Access to the service",
            paragraphs: [
              "MemoryHub is currently offered as a private beta. Access may require waitlist registration and approval by [NOM DE LA SOCIÉTÉ].",
              "We reserve the right to suspend, limit or discontinue access to the service for maintenance, updates or security reasons, with reasonable notice when possible.",
            ],
          },
          {
            heading: "User account",
            paragraphs: [
              "You agree to provide accurate information when creating your account and to keep your credentials confidential.",
              "You are responsible for all activity on your account. If you suspect fraudulent use, contact us immediately at [EMAIL CONTACT].",
            ],
          },
          {
            heading: "Permitted use",
            paragraphs: [
              "You agree to use MemoryHub in compliance with applicable laws and regulations, particularly regarding data protection and intellectual property.",
            ],
            list: [
              "Do not attempt unauthorized access to systems or other users' data.",
              "Do not use the service for unlawful, defamatory purposes or in ways that infringe third-party rights.",
              "Do not reverse engineer, scrape at scale or otherwise abuse the API.",
            ],
          },
          {
            heading: "Third-party integrations",
            paragraphs: [
              "MemoryHub connects to third-party services (Google, Notion) through permissions you grant. You warrant that you have the necessary rights over imported and indexed data.",
              "MemoryHub accesses authorized content in read-only mode and does not modify or delete your source files or emails.",
            ],
          },
          {
            heading: "Intellectual property",
            paragraphs: [
              "The service, its interface, code, brand and documentation remain the exclusive property of [NOM DE LA SOCIÉTÉ]. No transfer of intellectual property rights is granted under these Terms.",
              "You retain all rights to your data and content. You grant [NOM DE LA SOCIÉTÉ] a limited license to process such content solely to provide the service.",
            ],
          },
          {
            heading: "Availability and liability",
            paragraphs: [
              "MemoryHub is provided \"as is\" during the beta phase. We use reasonable efforts to ensure service availability, without guaranteeing uninterrupted access.",
              "To the extent permitted by law, [NOM DE LA SOCIÉTÉ]'s liability is limited to proven direct damages and does not cover indirect losses (loss of revenue, data loss due to your misconfiguration, etc.).",
            ],
          },
          {
            heading: "Termination",
            paragraphs: [
              "You may stop using the service and request account deletion at any time by contacting [EMAIL CONTACT].",
              "[NOM DE LA SOCIÉTÉ] may suspend or terminate your access in case of violation of these Terms, after notification when circumstances allow.",
            ],
          },
          {
            heading: "Changes and governing law",
            paragraphs: [
              "We may modify these Terms. The last updated date is shown at the top of this page. Continued use of the service after changes constitutes acceptance of the new conditions.",
              "These Terms are governed by French law. Any dispute relating to their interpretation or performance falls under the jurisdiction of the courts within the registered office of [NOM DE LA SOCIÉTÉ], subject to mandatory consumer protection rules.",
            ],
          },
        ],
      },
      cookies: {
        title: "Cookie Policy",
        metaDescription:
          "MemoryHub cookie policy — cookie types, PostHog analytics, beta waitlist and consent management.",
        lastUpdated: "July 4, 2026",
        sections: [
          {
            heading: "What is a cookie?",
            paragraphs: [
              "A cookie is a small text file placed on your device (computer, tablet, smartphone) when you visit a website. It helps recognize your browser and remember certain information.",
              "MemoryHub also uses similar technologies (localStorage, sessionStorage) for site operation and remembering your preferences.",
            ],
          },
          {
            heading: "Strictly necessary cookies",
            paragraphs: [
              "These cookies are essential for the Site to function. They do not require your prior consent.",
            ],
            list: [
              "Session and security cookies (authentication, CSRF protection).",
              "Storage of your language preference (FR/EN).",
              "Technical cookies related to hosting infrastructure [HÉBERGEUR].",
            ],
          },
          {
            heading: "Analytics cookies (PostHog)",
            paragraphs: [
              "MemoryHub uses PostHog (PostHog Inc.) to measure audience, understand Site usage and improve the product. PostHog may set cookies or use local identifiers to collect pseudonymized data (pages visited, events, device type, session duration).",
              "These cookies are only set with your consent where required by regulation. You may withdraw consent at any time via [MÉCANISME DE GESTION DU CONSENTEMENT — e.g. cookie banner or footer link].",
            ],
          },
          {
            heading: "Beta and waitlist cookies",
            paragraphs: [
              "When you sign up for the private beta, a technical identifier may be stored locally to prevent duplicate submissions and track your request.",
              "This data is not used for advertising purposes and is retained only for as long as necessary to process your registration.",
            ],
          },
          {
            heading: "Retention period",
            paragraphs: [
              "Session cookies expire when you close your browser. Persistent analytics cookies may be kept for up to 13 months, in line with CNIL recommendations.",
            ],
          },
          {
            heading: "Managing your preferences",
            paragraphs: [
              "You can configure your browser at any time to refuse cookies or be notified when they are set. Refusing certain cookies may limit some Site features.",
              "To manage PostHog and non-essential cookies, use [MÉCANISME DE GESTION DU CONSENTEMENT] or contact us at [EMAIL CONTACT].",
              {
                link: {
                  before: "For more on data protection, see our ",
                  text: "Privacy Policy",
                  href: "/politique-de-confidentialite",
                  after: ".",
                },
              },
            ],
          },
        ],
      },
    },
    joinModal: {
      title: "Join the private beta",
      subtitle: "Drop your email — we'll reach out within 48 hours.",
      placeholder: "you@example.com",
      submit: "Sign me up",
      loading: "Signing up…",
      success: "Thanks! You're on the list.",
      errorInvalid: "Please enter a valid email address.",
      errorDuplicate: "This email is already on the waitlist.",
      errorServer: "Something went wrong. Please try again in a moment.",
    },
    auth: {
      loading: "Loading…",
      logout: "Log out",
      layout: {
        backHome: "Back to home",
        backDashboard: "Back to dashboard",
      },
      nav: {
        profile: "Profile",
        settings: "Settings",
        billing: "Billing",
      },
      fields: {
        email: "Email address",
        password: "Password",
        confirmPassword: "Confirm password",
        firstName: "First name",
        lastName: "Last name",
        companyName: "Company name",
      },
      errors: {
        invalidEmail: "Please enter a valid email address.",
        passwordRequired: "Password is required.",
        passwordMin: "Password must be at least 8 characters.",
        confirmPasswordRequired: "Please confirm your password.",
        passwordMismatch: "Passwords do not match.",
        firstNameRequired: "First name is required.",
        lastNameRequired: "Last name is required.",
        companyRequired: "Company name is required.",
        loginFailed: "Invalid email or password.",
        registerFailed: "Unable to create account.",
        generic: "Something went wrong. Please try again.",
      },
      login: {
        title: "Sign in",
        subtitle: "Access your MemoryHub workspace.",
        submit: "Sign in",
        loading: "Signing in…",
        forgotPassword: "Forgot password?",
        noAccount: "Don't have an account?",
        createAccount: "Create an account",
      },
      register: {
        title: "Create an account",
        subtitle: "Join MemoryHub in seconds.",
        submit: "Create my account",
        loading: "Creating…",
        hasAccount: "Already have an account?",
        signIn: "Sign in",
      },
      forgotPassword: {
        title: "Forgot password",
        subtitle: "Enter your email to receive a reset link.",
        submit: "Send reset link",
        loading: "Sending…",
        successTitle: "Email sent",
        successSubtitle: "Check your inbox.",
        successBody: "If an account exists for this address, a reset link will be sent shortly.",
        backToLogin: "Back to sign in",
      },
      verifyEmail: {
        title: "Email verification",
        loading: "Verifying…",
        successTitle: "Email verified",
        errorTitle: "Verification failed",
        success: "Your email address has been verified.",
        error: "This verification link is invalid or expired.",
        missingToken: "Missing or invalid verification link.",
        backToLogin: "Back to sign in",
      },
      dashboard: {
        badge: "Workspace",
        title: "Dashboard coming soon",
        subtitle: "We're building your MemoryHub workspace. Check back soon.",
        welcome: "Hello {name}, welcome to your workspace.",
      },
      settings: {
        badge: "Settings",
        title: "Settings coming soon",
        subtitle: "Account management is on the way.",
      },
      billing: {
        badge: "Billing",
        title: "Billing coming soon",
        subtitle: "Subscription management is on the way.",
      },
      profile: {
        badge: "Profile",
        title: "Profile coming soon",
        subtitle: "Profile customization is on the way.",
      },
    },
  },
};
