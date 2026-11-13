/**
 * The password chosen while registering. It lives only in memory (never in the URL, never on
 * disk) between the sign-up and the code screen and is cleared as soon as it is used.
 */
let draft: { email: string; password: string } | null = null;

export function setSignupDraft(email: string, password: string): void {
  draft = { email, password };
}

/** Returns the password for this e-mail address once, then forgets it. */
export function takeSignupPassword(email: string): string | null {
  const current = draft;
  draft = null;
  return current && current.email === email ? current.password : null;
}

export function clearSignupDraft(): void {
  draft = null;
}
