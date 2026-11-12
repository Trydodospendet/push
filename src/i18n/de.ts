import {
  APP_NAME,
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  LEGAL,
  SIGN_IN_CODE_LENGTH,
} from '@/config/app';

/** One section of a legal page: heading plus paragraphs. */
export type LegalSection = { title: string; paragraphs: readonly string[] };

const operatorLines = [LEGAL.operatorName, LEGAL.street, `${LEGAL.city}, ${LEGAL.country}`];

const privacySections: readonly LegalSection[] = [
  {
    title: '1. Verantwortlicher',
    paragraphs: [...operatorLines, `E-Mail: ${LEGAL.email}`],
  },
  {
    title: '2. Worum es geht',
    paragraphs: [
      `${APP_NAME} ist eine App, in der du auf deine eigenen Lauf- und Schrittziele setzt. Ob du ein Ziel erreichst, wird automatisch anhand deiner Gesundheitsdaten geprüft.`,
      'Testphase: Es werden ausschließlich virtuelle Credits verwendet. Es gibt keine Zahlungen und keine Auszahlungen.',
    ],
  },
  {
    title: '3. Welche Daten wir verarbeiten',
    paragraphs: [
      'Konto: deine E-Mail-Adresse (für die Anmeldung per Code), dein Anzeigename und deine Zeitzone.',
      'Challenges und Credits: an welchen Challenges du teilnimmst, deine Einsätze, Ergebnisse und die Buchungen deiner virtuellen Credits.',
      'Gesundheits- und Fitnessdaten (Health Connect bzw. Apple Health), nur lesend und nur aus den letzten 45 Tagen: Lauf-Workouts (Beginn, Ende, Distanz, Dauer, Name der aufzeichnenden App und ob der Lauf von Hand eingetragen wurde) sowie deine Schritte pro Tag.',
      `${APP_NAME} schreibt keine Daten in Health Connect oder Apple Health und liest keine anderen Gesundheitsdaten (z. B. keine Herzfrequenz, kein Gewicht, keine GPS-Routen).`,
      'Technische Daten: Bei jeder Verbindung zum Server werden IP-Adresse, Zeitpunkt und Art der Anfrage in Server-Protokollen des Hosting-Anbieters erfasst.',
      'Auf deinem Gerät: deine Anmeldung und der Verbindungsstatus zu den Gesundheitsdaten, gespeichert im verschlüsselten Gerätespeicher.',
    ],
  },
  {
    title: '4. Zwecke und Rechtsgrundlagen',
    paragraphs: [
      'Konto, Challenges und Credits: um dir die App bereitzustellen (Art. 6 Abs. 1 lit. b DSGVO).',
      'Gesundheitsdaten: ausschließlich, um automatisch zu prüfen, ob du die Ziele deiner Challenges erreichst, und um dir deinen Fortschritt anzuzeigen. Rechtsgrundlage ist deine ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a und Art. 6 Abs. 1 lit. a DSGVO), die du mit der Freigabe im Berechtigungsdialog erteilst.',
      'Du kannst die Einwilligung jederzeit widerrufen, indem du den Zugriff in Health Connect bzw. in der Health-App entziehst. Danach kann dein Fortschritt nicht mehr geprüft werden; bereits übertragene Daten bleiben bis zur Löschung deines Kontos gespeichert.',
      'Server-Protokolle: für den sicheren Betrieb und die Fehlersuche (berechtigtes Interesse, Art. 6 Abs. 1 lit. f DSGVO).',
      'Wir nutzen keine Werbung, keine Analyse- oder Tracking-Dienste und verkaufen keine Daten.',
    ],
  },
  {
    title: '5. Health Connect und Apple Health',
    paragraphs: [
      'Die Nutzung von Daten, die über Health Connect empfangen werden, erfolgt gemäß der Health-Connect-Berechtigungsrichtlinie einschließlich der Anforderungen zur eingeschränkten Nutzung („Limited Use“).',
      'Gesundheitsdaten werden nicht für Werbung verwendet, nicht verkauft und nicht an Dritte weitergegeben – außer an den unten genannten Hosting-Anbieter, der sie nur in unserem Auftrag speichert.',
      'Andere Teilnehmer deiner Challenges sehen nur deinen Anzeigenamen, ob du das Ziel erreicht hast und deinen Platz in der Rangliste – nie deine Gesundheitsdaten.',
    ],
  },
  {
    title: '6. Empfänger und Auftragsverarbeiter',
    paragraphs: [
      `Supabase Inc. (Datenbank, Anmeldung, Hosting). Serverstandort: ${LEGAL.supabaseRegion}. Mit Supabase besteht ein Vertrag zur Auftragsverarbeitung; für mögliche Zugriffe aus den USA gelten die EU-Standardvertragsklauseln.`,
      `${LEGAL.emailProvider} (Versand der Anmeldecodes per E-Mail; verarbeitet nur deine E-Mail-Adresse).`,
      'Google (Play Store) bzw. Apple (App Store) stellen die App bereit und verarbeiten dabei Daten in eigener Verantwortung.',
    ],
  },
  {
    title: '7. Speicherdauer',
    paragraphs: [
      'Konto- und Gesundheitsdaten speichern wir, bis du dein Konto löschst.',
      'Teilnahmen und Credit-Buchungen werden bei der Löschung anonymisiert: Der Bezug zu dir wird entfernt, die Beträge bleiben ohne Personenbezug erhalten, damit die Abrechnung der anderen Teilnehmer korrekt bleibt.',
      'Server-Protokolle werden vom Hosting-Anbieter nach kurzer Zeit automatisch gelöscht.',
      'Die Daten auf deinem Gerät werden beim Abmelden bzw. beim Löschen der App entfernt.',
    ],
  },
  {
    title: '8. Konto löschen',
    paragraphs: [
      `In der App: Profil → „Konto löschen“. Ohne App: Schreib eine E-Mail von deiner registrierten Adresse an ${LEGAL.email} mit dem Betreff „Konto löschen“. Anleitung: ${LEGAL.deletionUrl}`,
      'Gelöscht werden: E-Mail-Adresse, Anzeigename, Guthaben und alle Gesundheitsdaten. Noch nicht gestartete Challenges werden dir vorher erstattet; Einsätze in bereits laufenden Challenges verfallen.',
    ],
  },
  {
    title: '9. Deine Rechte',
    paragraphs: [
      'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie auf Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft.',
      `Schreib uns dafür an ${LEGAL.email}. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren.`,
    ],
  },
  {
    title: '10. Sicherheit',
    paragraphs: [
      'Alle Verbindungen sind verschlüsselt (HTTPS). Auf dem Server kann jedes Konto nur seine eigenen Daten lesen; Credits werden ausschließlich vom Server gebucht.',
    ],
  },
  {
    title: '11. Mindestalter',
    paragraphs: [`${APP_NAME} richtet sich ausschließlich an Personen ab 18 Jahren.`],
  },
  {
    title: '12. Stand',
    paragraphs: [`Diese Datenschutzerklärung gilt ab ${LEGAL.updatedAt}.`],
  },
];

const imprintSections: readonly LegalSection[] = [
  {
    title: 'Angaben gemäß § 5 DDG',
    paragraphs: [...operatorLines, LEGAL.register, LEGAL.vatId],
  },
  {
    title: 'Kontakt',
    paragraphs: [`E-Mail: ${LEGAL.email}`, `Telefon: ${LEGAL.phone}`],
  },
  {
    title: 'Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV',
    paragraphs: operatorLines,
  },
  {
    title: 'Verbraucherstreitbeilegung',
    paragraphs: [
      'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
    ],
  },
];

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
  health: {
    source: {
      ios: 'Apple Health',
      android: 'Health Connect',
    },
    introTitle: 'Automatisch geprüft statt behauptet',
    introText: (source: string) =>
      `${APP_NAME} liest deine Läufe und Tagesschritte aus ${source}. So wird dein Fortschritt automatisch geprüft – niemand kann sein Ergebnis selbst eintragen.`,
    introPoints: [
      'Gelesen werden nur Lauf-Workouts, die Distanz dazu und deine Tagesschritte der letzten 45 Tage.',
      `${APP_NAME} schreibt nichts in deine Gesundheitsdaten.`,
      'Manuell eingetragene Läufe und Schritte zählen nicht.',
      'Andere Teilnehmer sehen nur, ob du dein Ziel geschafft hast – keine Gesundheitsdaten.',
    ],
    introAndroidPoint:
      'Enthält eine App an einem Tag manuell eingetragene Schritte, zählen die Schritte dieser App an diesem Tag nicht.',
    connect: (source: string) => `${source} verbinden`,
    skip: 'Später',
    skipHint: 'Ohne Verbindung kann dein Fortschritt nicht geprüft werden.',
    statusLabel: 'GESUNDHEITSDATEN',
    connected: (source: string) => `${source} ist verbunden.`,
    notConnected: (source: string) => `${source} ist nicht verbunden.`,
    reconnect: 'Erneut verbinden',
    syncNow: 'Jetzt synchronisieren',
    banner: (source: string) =>
      `${source} ist nicht verbunden. Dein Fortschritt kann so nicht geprüft werden.`,
    lastSync: (time: string) => `Zuletzt synchronisiert: ${time}`,
    neverSynced: 'Noch nicht synchronisiert',
    syncing: 'Synchronisiere …',
    errors: {
      health_unavailable: 'Auf diesem Gerät sind keine Gesundheitsdaten verfügbar.',
      health_connect_missing:
        'Health Connect ist nicht installiert oder muss aktualisiert werden. Installiere es aus dem Play Store.',
      health_build_required:
        'Diese App-Version kann keine Gesundheitsdaten lesen. Installiere den neuesten Build.',
      health_permission:
        'Der Zugriff auf die Gesundheitsdaten fehlt. Erlaube Läufe, Distanz und Schritte und verbinde erneut.',
      health_missing_origin:
        'Bei einigen Gesundheitsdaten fehlt die Quelle. Die Synchronisierung wurde abgebrochen.',
      invalid_health_payload: 'Die Gesundheitsdaten konnten nicht verarbeitet werden.',
      health_batch_too_large: 'Zu viele Gesundheitsdaten auf einmal. Bitte versuche es erneut.',
      health_outside_window: 'Es können nur Daten der letzten 45 Tage synchronisiert werden.',
    },
  },
  progress: {
    barLabel: 'Fortschritt der Challenge',
    unitKm: 'km',
    unitDays: 'Tage geschafft',
    spoken: (current: string, target: string) => `${current} von ${target}`,
    days: (count: number) => (count === 1 ? '1 Tag' : `${count} Tage`),
    remainingDays: (count: number) => (count === 1 ? 'Noch 1 Tag' : `Noch ${count} Tage`),
    remainingHours: (count: number) => (count === 1 ? 'Noch 1 Stunde' : `Noch ${count} Stunden`),
    remainingMinutes: (count: number) => (count === 1 ? 'Noch 1 Minute' : `Noch ${count} Minuten`),
    ended: 'Zeitraum beendet',
    startsOn: (date: string) => `Startet am ${date}`,
    goalReached: 'Ziel erreicht',
    of: (goal: string) => `von ${goal}`,
  },
  activities: {
    runsTitle: 'DEINE LÄUFE IM ZEITRAUM',
    stepsTitle: 'DEINE TAGE IM ZEITRAUM',
    invalidTitle: 'NICHT GEZÄHLT',
    runsEmpty: 'Im Zeitraum wurde noch kein Lauf gefunden.',
    stepsEmpty: 'Für den Zeitraum liegen noch keine Schritte vor.',
    error: 'Deine Aktivitäten konnten nicht geladen werden.',
    run: (distance: string, minutes: number) => `Lauf · ${distance} · ${minutes} Min.`,
    counted: 'zählt',
    notCounted: 'zählt nicht',
    dayDone: 'geschafft',
    dayOpen: 'zu wenig',
    reason: {
      manual_entry: 'Manuell eingetragen – manuelle Einträge zählen nie.',
      too_fast: 'Zu schnell für einen Lauf (schneller als 2:30 min/km).',
      too_slow: 'Zu langsam für einen Lauf (langsamer als 15:00 min/km).',
      invalid_data: 'Unvollständige oder unplausible Daten.',
    },
    unknownReason: 'Diese Aktivität wurde nicht anerkannt.',
    stepsInvalid: 'Unplausibel viele Schritte (über 80.000) – der Tag zählt nicht.',
    stepsExcluded:
      'Eine App mit manuell eingetragenen Schritten wurde an diesem Tag nicht mitgezählt.',
  },
  session: {
    profileError: 'Dein Profil konnte nicht geladen werden.',
    signOut: 'Abmelden',
  },
  tabs: {
    home: 'Home',
    solo: 'Solo',
    ranked: 'Ranked',
    wallet: 'Wallet',
    profile: 'Profil',
  },
  mode: {
    solo: 'Solo',
    ranked: 'Ranked',
  },
  solo: {
    title: 'Solo',
    intro:
      'Setz dir ein eigenes Ziel und wette auf dich selbst. Schaffst du es, bekommst du deinen Einsatz zurück. Sonst verfällt er.',
    create: 'Solo-Ziel setzen',
    current: 'LAUFENDE ZIELE',
    finished: 'ABGESCHLOSSEN',
    error: 'Deine Solo-Ziele konnten nicht geladen werden.',
  },
  home: {
    label: 'DEINE CHALLENGES',
    primaryLabel: 'AKTUELLE CHALLENGE',
    moreLabel: 'WEITERE CHALLENGES',
    emptyTitle: 'Noch keine Challenge',
    emptyText: 'Such dir eine Challenge aus und setz auf dein Ziel.',
    findChallenge: 'Challenge finden',
    error: 'Deine Challenges konnten nicht geladen werden.',
  },
  intro: {
    skip: 'Überspringen',
    next: 'Weiter',
    start: "Los geht's",
    pageOf: (page: number, total: number) => `Seite ${page} von ${total}`,
    pages: (source: string) =>
      [
        {
          icon: 'flag' as const,
          title: "So funktioniert's",
          text: 'Such dir ein Lauf- oder Schrittziel aus und setz Credits darauf. Schaffst du es, bekommst du deinen Einsatz zurück. Bei Ranked-Challenges teilst du dir zusätzlich die Einsätze derer, die es nicht geschafft haben.',
        },
        {
          icon: 'shield-checkmark' as const,
          title: `Automatisch geprüft über ${source}`,
          text: `Deine Läufe und Schritte kommen direkt aus ${source}. Niemand kann sein Ergebnis selbst behaupten – und von Hand eingetragene Einträge zählen nie.`,
        },
        {
          icon: 'wallet' as const,
          title: 'So wird ausgezahlt',
          text: 'Nach dem Ende rechnet der Server automatisch ab: Wer sein Ziel geschafft hat, bekommt den Einsatz plus den Anteil am Topf gutgeschrieben. Aktuell sind Credits virtuell und können nicht ausgezahlt werden.',
        },
      ] as const,
  },
  stats: {
    streak: (days: number) => (days === 1 ? '1 Tag in Folge' : `${days} Tage in Folge`),
    streakNone: 'Starte heute deine Serie',
    streakHint: 'Ein Tag zählt mit einem gültigen Lauf oder mindestens 8.000 Schritten.',
    weekLabel: 'DIESE WOCHE',
    weekSummary: (km: string) => `${km} km in den letzten 7 Tagen`,
    recentWinsLabel: 'ZULETZT GEWONNEN',
    recentWinAccessibility: (title: string, amount: string) =>
      `${title}: Auszahlung ${amount} Credits`,
    recentWinsEmptyTitle: 'Noch kein Gewinn',
    recentWinsEmptyText: 'Schaffe dein Ziel, dann steht deine Auszahlung hier.',
    profileLabel: 'DEINE BILANZ',
    totalDistance: 'Kilometer gesamt',
    totalWins: 'Gewonnene Challenges',
    totalWon: 'Gewinn gesamt',
    totalWonHint: 'Credits über deinem Einsatz',
    statsError: 'Die Statistik konnte nicht geladen werden.',
    km: (km: string) => `${km} km`,
  },
  celebration: {
    title: 'GESCHAFFT!',
    withBonus: (bonus: string) => `Dein Einsatz ist zurück – plus ${bonus} Credits Gewinn.`,
    stakeBack: 'Dein Einsatz ist zurück.',
    close: 'Weiter',
    accessibility: (title: string, amount: string) =>
      `Challenge gewonnen: ${title}. Auszahlung ${amount} Credits.`,
  },
  detail: {
    potLabel: 'TOPF',
    potCaption: (count: number) => `${count === 1 ? '1 Person' : `${count} Personen`} im Spiel`,
    possibleWinLabel: 'DEIN MÖGLICHER GEWINN',
    possibleWinHint: 'Höchstens: wenn alle anderen ihr Ziel verfehlen. Dein Einsatz ist inklusive.',
    possibleWinHintSolo: 'Bei einem Solo-Ziel bekommst du nur deinen Einsatz zurück.',
    possibleWinSetting: 'Wird berechnet …',
    verified: 'Automatisch geprüft',
    verifiedHint: (source: string) => `Ergebnisse kommen aus ${source}.`,
  },
  emptyStates: {
    walletTitle: 'Noch keine Buchungen',
    walletText:
      'Sobald du einer Challenge beitrittst, siehst du hier jeden Einsatz und jede Auszahlung.',
    walletAction: 'Challenge finden',
    rankedMineTitle: 'Noch keine Challenge',
    rankedMineText: 'Tritt einer offenen Challenge bei oder tippe oben auf „Erstellen“.',
    rankedOpenTitle: 'Keine offenen Challenges',
    rankedOpenText: 'Erstell die erste und lade andere mit einem Code ein.',
    rankedFinishedTitle: 'Noch nichts abgeschlossen',
    rankedFinishedText: 'Beendete Challenges mit deinem Ergebnis erscheinen hier.',
    soloCurrentTitle: 'Kein Ziel gesetzt',
    soloCurrentText: 'Tippe oben auf „Solo-Ziel setzen“ und wette auf dich selbst.',
    soloFinishedTitle: 'Noch nichts abgeschlossen',
    soloFinishedText: 'Deine erreichten und verpassten Ziele erscheinen hier.',
  },
  challenges: {
    title: 'Ranked',
    intro:
      'Tritt gegen andere an. Wer das Ziel schafft, bekommt den Einsatz zurück und teilt sich die Einsätze der anderen.',
    create: 'Erstellen',
    joinByCode: 'Code eingeben',
    mine: 'MEINE CHALLENGES',
    open: 'OFFENE CHALLENGES',
    finished: 'ABGESCHLOSSEN',
    error: 'Die Challenges konnten nicht geladen werden.',
    joinedBadge: 'Dabei',
    createdBadge: 'Von dir',
  },
  goal: {
    typeLabel: {
      run_single: 'Ein Lauf',
      run_total: 'Gesamtstrecke',
      steps_daily: 'Tägliche Schritte',
    },
    description: {
      run_single: (target: string) => `Ein Lauf über mindestens ${target}`,
      run_total: (target: string) => `Insgesamt ${target} laufen`,
      steps_daily: (target: string) => `Jeden Tag ${target}`,
    },
    rule: {
      run_single: (target: string) =>
        `Du musst im Zeitraum mindestens einen Lauf über ${target} schaffen.`,
      run_total: (target: string) =>
        `Alle deine Läufe im Zeitraum zusammen müssen mindestens ${target} ergeben.`,
      steps_daily: (target: string) =>
        `Du musst an jedem einzelnen Tag im Zeitraum mindestens ${target} gehen.`,
    },
    steps: (formatted: string) => `${formatted} Schritte`,
  },
  status: {
    open: 'Offen',
    active: 'Läuft',
    settling: 'Wird ausgewertet',
    settled: 'Beendet',
    cancelled: 'Abgesagt',
  },
  challenge: {
    headerTitle: 'Challenge',
    notFound: 'Diese Challenge gibt es nicht oder sie ist privat.',
    error: 'Die Challenge konnte nicht geladen werden.',
    goal: 'ZIEL',
    period: 'ZEITRAUM',
    stake: 'EINSATZ',
    participants: 'TEILNEHMER',
    pot: 'TOPF',
    participantCount: (count: number) => (count === 1 ? '1 Person' : `${count} Personen`),
    maxParticipants: (max: number) => `max. ${max}`,
    inviteCode: 'EINLADUNGSCODE',
    shareCode: 'Code teilen',
    shareMessage: (title: string, code: string) =>
      `Mach mit bei meiner Challenge „${title}“! Code in der App eingeben: ${code}`,
    rules: 'REGELN',
    ruleStart: (date: string) => `Start: ${date}, 0:00 Uhr. Ende: nach dem letzten Tag um 24:00.`,
    ruleOnlyPeriod: 'Es zählen nur Aktivitäten, die im Zeitraum beginnen.',
    ruleManual: 'Manuelle Einträge zählen nicht – nur automatisch aufgezeichnete Daten.',
    ruleGrace: (hours: number) =>
      `Nach dem Ende hast du ${hours} Stunden Zeit, deine Daten zu synchronisieren.`,
    ruleMinParticipants: (min: number) =>
      `Sind beim Start weniger als ${min} Personen dabei, wird die Challenge abgesagt und alle bekommen ihren Einsatz zurück.`,
    rulePayout:
      'Wer das Ziel schafft, bekommt den Einsatz zurück und teilt sich zu gleichen Teilen die Einsätze der anderen.',
    ruleAllWin: 'Schaffen es alle, bekommen alle genau ihren Einsatz zurück.',
    ruleNobody: 'Schafft es niemand, verfallen alle Einsätze.',
    ruleFee: (percent: string) => `Von den verlorenen Einsätzen gehen ${percent} Gebühr ab.`,
    ruleRounding: 'Lässt sich der Topf nicht in ganze Cent teilen, verfällt der Rest.',
    ruleRanking: 'Die Rangliste zeigt nur die Reihenfolge – ausgezahlt wird nicht nach Platz.',
    ruleSoloWin: 'Schaffst du dein Ziel, bekommst du deinen Einsatz vollständig zurück.',
    ruleSoloLose: 'Schaffst du es nicht, verfällt dein Einsatz.',
    ruleLeave: 'Bis zum Start kannst du jederzeit aussteigen und bekommst deinen Einsatz zurück.',
    ranking: 'RANGLISTE',
    rankingEmpty: 'Die Rangliste erscheint, sobald die Challenge läuft.',
    rankingError: 'Die Rangliste konnte nicht geladen werden.',
    rank: (rank: number) => `${rank}.`,
    result: 'ERGEBNIS',
    resultWon: 'Ziel geschafft!',
    resultWonPayout: (amount: string) => `Dir wurden ${amount} Credits gutgeschrieben.`,
    resultLost: 'Ziel nicht geschafft.',
    resultLostText: 'Dein Einsatz ist verfallen.',
    resultCancelled: 'Challenge abgesagt.',
    resultRefundText: (amount: string) => `Dein Einsatz von ${amount} Credits wurde erstattet.`,
    resultPending: 'Die Auswertung läuft. Das Ergebnis erscheint nach der Synchronisierungsfrist.',
    yourProgress: 'DEIN FORTSCHRITT',
    progressPending: 'Dein Fortschritt erscheint hier, sobald die Challenge läuft.',
    progressCancelled: 'Die Challenge wurde abgesagt.',
    participantList: 'WER IST DABEI',
    participantsHidden: 'Die Teilnehmerliste siehst du, sobald du dabei bist.',
    you: '(du)',
    resultDone: 'geschafft',
    resultOpen: 'offen',
    resultFailed: 'nicht geschafft',
    resultRefunded: 'erstattet',
    join: 'Beitreten',
    joined: 'Du bist dabei',
    notJoinable: 'Beitreten ist nur vor dem Start möglich.',
    leave: 'Challenge verlassen',
    deletedAccount: 'Gelöschtes Konto',
    creatorHint: 'Du hast diese Challenge erstellt. Tritt selbst bei, um mitzumachen.',
  },
  joinSheet: {
    title: 'Challenge beitreten',
    stake: (amount: string) =>
      `Du setzt ${amount} Credits. Erreichst du dein Ziel, bekommst du sie zurück plus deinen Anteil am Topf.`,
    balance: (amount: string) => `Dein Guthaben: ${amount} Credits`,
    confirm: 'Jetzt beitreten',
    cancel: 'Abbrechen',
    soloTitle: 'Solo-Ziel setzen',
    soloStake: (amount: string) =>
      `Du setzt ${amount} Credits auf dich selbst. Erreichst du dein Ziel, bekommst du sie zurück. Sonst verfallen sie.`,
    soloConfirm: 'Einsatz setzen',
  },
  leaveSheet: {
    title: 'Challenge verlassen?',
    text: (amount: string) =>
      `Du bekommst deinen Einsatz von ${amount} Credits zurück. Danach kannst du dieser Challenge nicht erneut beitreten.`,
    confirm: 'Verlassen',
    cancel: 'Dabei bleiben',
  },
  create: {
    title: 'Challenge erstellen',
    soloTitle: 'Solo-Ziel',
    soloSubmit: 'Weiter zum Einsatz',
    soloHint: 'Nur du machst mit. Der Einsatz wird beim Setzen des Ziels abgebucht.',
    goalType: 'ZIELTYP',
    target: 'ZIEL',
    start: 'START',
    duration: 'DAUER',
    stake: 'EINSATZ',
    visibility: 'SICHTBARKEIT',
    public: 'Öffentlich',
    private: 'Privat',
    publicHint: 'Alle können die Challenge finden und mitmachen.',
    privateHint: 'Nur wer den Einladungscode hat, kann mitmachen.',
    titleLabel: 'Titel',
    titleHint: 'Wird automatisch vorgeschlagen, du kannst ihn ändern.',
    tomorrow: 'Morgen',
    dayAfterTomorrow: 'Übermorgen',
    days: (count: number) => (count === 1 ? '1 Tag' : `${count} Tage`),
    summary: (start: string, end: string) => `Vom ${start} bis einschließlich ${end}`,
    submit: 'Challenge erstellen',
    afterCreateHint:
      'Der Ersteller tritt nicht automatisch bei. Danach kannst du selbst beitreten.',
    invalidTitle: 'Der Titel muss 3 bis 60 Zeichen lang sein.',
    invalidInput: 'Bitte prüfe deine Angaben.',
  },
  joinByCode: {
    title: 'Mit Code beitreten',
    intro: 'Gib den 6-stelligen Einladungscode ein, den du bekommen hast.',
    codeLabel: 'Einladungscode',
    submit: 'Challenge anzeigen',
    invalidCode: 'Der Code besteht aus 6 Buchstaben und Ziffern.',
  },
  wallet: {
    label: 'GUTHABEN',
    balanceAccessibility: (amount: string) => `Guthaben: ${amount} Credits`,
    error: 'Dein Guthaben konnte nicht geladen werden.',
    history: 'BUCHUNGEN',
    historyError: 'Die Buchungen konnten nicht geladen werden.',
    entryType: {
      signup_bonus: 'Startguthaben',
      stake: 'Einsatz',
      payout: 'Auszahlung',
      refund: 'Erstattung',
      fee: 'Gebühr',
      rounding: 'Rundung',
      forfeit: 'Verfallener Einsatz',
    },
    unknownChallenge: 'Challenge',
  },
  serverErrors: {
    challenge_not_found: 'Diese Challenge gibt es nicht oder sie ist privat.',
    challenge_not_open: 'Diese Challenge hat schon begonnen oder ist beendet.',
    already_joined: 'Du bist bereits dabei.',
    cannot_rejoin: 'Du hast diese Challenge verlassen und kannst nicht erneut beitreten.',
    challenge_full: 'Diese Challenge ist leider voll.',
    insufficient_funds: 'Dein Guthaben reicht für diesen Einsatz nicht aus.',
    invalid_invite_code: 'Zu diesem Code gibt es keine Challenge.',
    not_joined: 'Du bist bei dieser Challenge nicht dabei.',
    invalid_mode: 'Diese Art von Challenge gibt es nicht.',
  },
  profile: {
    label: 'PROFIL',
    emailLabel: 'E-Mail',
    signOut: 'Abmelden',
    signOutError: 'Abmelden hat nicht geklappt. Prüfe deine Internetverbindung.',
    error: 'Dein Profil konnte nicht geladen werden.',
    legalLabel: 'RECHTLICHES',
    privacy: 'Datenschutz',
    imprint: 'Impressum',
    howItWorks: "So funktioniert's",
    accountLabel: 'KONTO',
    deleteAccount: 'Konto löschen',
  },
  deleteAccount: {
    title: 'Konto endgültig löschen?',
    intro: 'Das kann nicht rückgängig gemacht werden.',
    points: [
      'Gelöscht werden deine E-Mail-Adresse, dein Anzeigename, dein Guthaben und alle synchronisierten Gesundheitsdaten.',
      'Challenges, die noch nicht begonnen haben, verlässt du automatisch. Deinen Einsatz bekommst du vorher zurück.',
      'In Challenges, die schon laufen, verfällt dein Einsatz. Er bleibt im Topf und wird regulär an die Gewinner verteilt.',
      'Deine Buchungen bleiben ohne Bezug zu dir erhalten, damit die Abrechnungen der anderen stimmen.',
    ],
    healthHint: (source: string) =>
      `Den Zugriff auf deine Gesundheitsdaten kannst du zusätzlich in ${source} entfernen.`,
    confirm: 'Endgültig löschen',
    cancel: 'Abbrechen',
    networkError: 'Löschen hat nicht geklappt. Prüfe deine Internetverbindung.',
  },
  legal: {
    privacyTitle: 'Datenschutz',
    imprintTitle: 'Impressum',
    privacy: privacySections,
    imprint: imprintSections,
  },
} as const;
