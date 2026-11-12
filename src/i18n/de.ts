import {
  APP_NAME,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  SIGN_IN_CODE_LENGTH,
} from '@/config/app';

/** All user-facing texts of the app. Screens and components never hard-code strings. */
export const de = {
  common: {
    loading: 'Wird geladen',
    retry: 'Erneut versuchen',
    credits: 'Credits',
    genericError: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    networkError: 'Keine Verbindung zum Server. Prüfe deine Internetverbindung.',
    virtualCreditsNotice: 'Testphase: Credits sind virtuell und können nicht ausgezahlt werden.',
  },
  welcome: {
    logo: `${APP_NAME}.`,
    claim: 'YOUR GOALS. YOUR STAKES.',
    start: 'Loslegen',
  },
  signIn: {
    title: 'Anmelden',
    intro:
      'Gib deine E-Mail-Adresse ein. Wir schicken dir einen Code zum Anmelden – ohne Passwort.',
    emailLabel: 'E-Mail-Adresse',
    emailPlaceholder: 'name@beispiel.de',
    submit: 'Code senden',
    invalidEmail: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    rateLimited: 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.',
  },
  verify: {
    title: 'Code eingeben',
    intro: (email: string) =>
      `Wir haben einen ${SIGN_IN_CODE_LENGTH}-stelligen Code an ${email} geschickt.`,
    codeLabel: `${SIGN_IN_CODE_LENGTH}-stelliger Code`,
    submit: 'Anmelden',
    resend: 'Code erneut senden',
    resent: 'Neuer Code ist unterwegs.',
    changeEmail: 'Andere E-Mail-Adresse',
    invalidCode: `Der Code besteht aus ${SIGN_IN_CODE_LENGTH} Ziffern.`,
    wrongCode: 'Der Code ist falsch oder abgelaufen. Fordere bei Bedarf einen neuen an.',
    missingEmail: 'Die E-Mail-Adresse fehlt. Bitte starte die Anmeldung erneut.',
  },
  onboarding: {
    nameTitle: 'Wie sollen wir dich nennen?',
    nameIntro: 'Dein Anzeigename ist für andere Teilnehmer deiner Challenges sichtbar.',
    nameLabel: 'Anzeigename',
    namePlaceholder: 'z. B. Lauf-Lisa',
    nameHint: `${DISPLAY_NAME_MIN_LENGTH} bis ${DISPLAY_NAME_MAX_LENGTH} Zeichen`,
    nameSubmit: 'Weiter',
    nameInvalid: `Der Name muss ${DISPLAY_NAME_MIN_LENGTH} bis ${DISPLAY_NAME_MAX_LENGTH} Zeichen lang sein.`,
  },
  session: {
    profileError: 'Dein Profil konnte nicht geladen werden.',
    signOut: 'Abmelden',
  },
  tabs: {
    home: 'Home',
    challenges: 'Challenges',
    wallet: 'Wallet',
    profile: 'Profil',
  },
  home: {
    label: 'DEINE CHALLENGE',
    emptyTitle: 'Noch keine Challenge',
    emptyText: 'Such dir eine Challenge aus und setz auf dein Ziel.',
    findChallenge: 'Challenge finden',
  },
  challenges: {
    title: 'Challenges',
    placeholder: 'Hier findest du bald offene Challenges zum Mitmachen.',
  },
  wallet: {
    label: 'GUTHABEN',
    balanceAccessibility: (amount: string) => `Guthaben: ${amount} Credits`,
    error: 'Dein Guthaben konnte nicht geladen werden.',
  },
  profile: {
    label: 'PROFIL',
    emailLabel: 'E-Mail',
    signOut: 'Abmelden',
    signOutError: 'Abmelden hat nicht geklappt. Prüfe deine Internetverbindung.',
    error: 'Dein Profil konnte nicht geladen werden.',
  },
} as const;
