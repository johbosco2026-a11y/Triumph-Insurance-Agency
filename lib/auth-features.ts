/**
 * Provider-ready security feature map.
 * Enable each capability only after its provider credentials and policy have
 * been configured. Keeping this explicit prevents accidental half-enabled auth.
 */
export const authFeatures = {
  googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  magicLinks: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
  passkeys: false,
  twoFactor: false,
  enterpriseSSO: Boolean(process.env.SAML_ENTRY_POINT && process.env.SAML_ISSUER && process.env.SAML_CERTIFICATE),
} as const;
