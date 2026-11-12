import { LegalDocument } from '@/features/legal/legal-document';
import { de } from '@/i18n/de';

export default function ImprintScreen() {
  return <LegalDocument sections={de.legal.imprint} />;
}
