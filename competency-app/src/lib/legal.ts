/**
 * Version courante des CGU et helpers de tracage d'acceptation.
 *
 * Workflow :
 *   1. A chaque login (cf. (protected)/layout.tsx), on compare le
 *      `legal_accepted_version` du profil a `LEGAL_VERSION` ci-dessous.
 *   2. Si different (ou vide) -> redirect /legal/accept.
 *   3. La page /legal/accept appelle l'action recordLegalAcceptance()
 *      qui met a jour profiles.legal_accepted_version + _at.
 *
 * Pour publier une revision : bumper LEGAL_VERSION + LEGAL_DATE + mettre
 * a jour les pages /legal/cgu, /legal/confidentialite, /legal/mentions-legales.
 */

export const LEGAL_VERSION = '1.0'
export const LEGAL_DATE = '2026-05-12'
