import manifest from '../../brand/product.manifest.json';

export type ProductManifest = typeof manifest;

/** Canonical product copy — keep in sync with brand/product.manifest.json */
export const PRODUCT_MANIFEST: ProductManifest = manifest;

export const PRODUCT_NAME = manifest.name;
export const PRODUCT_TAGLINE = manifest.tagline;
export const PRODUCT_PRIVACY_SUMMARY = manifest.privacy.summary;
export const PRODUCT_CHROME_DESCRIPTION = manifest.messaging.chromeExtensionDescription;
export const PRODUCT_ONBOARDING_LEAD = manifest.messaging.onboardingLead;
export const PRODUCT_SETTINGS_PRIVACY_HEADING = manifest.messaging.settingsPrivacyHeading;
export const PRODUCT_SETTINGS_PRIVACY_LEAD = manifest.messaging.settingsPrivacyLead;
