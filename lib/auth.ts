import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma';
import { sendSecurityEmail, escapeHtml } from './email';

const secret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
  throw new Error('BETTER_AUTH_SECRET must be set to a strong 32+ character secret in production.');
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendSecurityEmail(
        user.email,
        'Reset your Triumph password',
        `<p>We received a request to reset the password for your Triumph account.</p><p><a href="${escapeHtml(url)}">Reset your password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`
      );
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: secret ?? 'development-only-secret-replace-before-production-123456',
});
