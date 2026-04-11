export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

/** Align with Supabase Auth → Email → minimum password length if you change it there. */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: "len", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "One number", test: (p) => /\d/.test(p) },
  { id: "symbol", label: "One symbol (e.g. !@#$%)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function passwordMeetsPolicy(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password));
}

export function passwordPolicyFailureMessage(): string {
  return "Please meet all password requirements below.";
}
