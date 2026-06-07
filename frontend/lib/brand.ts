/**
 * Single source of truth for product naming.
 * Rename the product here and it updates everywhere in the UI.
 */
export const BRAND = {
  name: "Arelis",
  tagline: "Shielded invoicing & compliance on Zcash",
  /** Short one-liner used under the logo and in empty states. */
  promise:
    "Private from competitors by default. Provable to the auditor on your terms.",
} as const;
