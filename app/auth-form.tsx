'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export function AuthForm({ mode }: { mode: 'login' | 'signup' | 'forgot' | 'reset' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); setPending(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'signup') {
        if (values.password !== values.confirmPassword) throw new Error('Passwords do not match.');
        const result = await authClient.signUp.email({ name: String(values.name), email: String(values.email), password: String(values.password), callbackURL: '/dashboard' });
        if (result.error) throw new Error(result.error.message ?? 'Unable to create account.');
        await fetch('/api/onboarding', { method: 'POST' }); router.push('/dashboard');
      } else if (mode === 'login') {
        const result = await authClient.signIn.email({ email: String(values.email), password: String(values.password), callbackURL: '/dashboard' });
        if (result.error) throw new Error(result.error.message ?? 'Invalid email or password.');
        router.push('/dashboard');
      } else if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({ email: String(values.email), redirectTo: '/reset-password' });
        if (result.error) throw new Error(result.error.message ?? 'Unable to send reset email.');
        setMessage('If an account exists for that email, a reset link is on its way.');
      } else {
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) throw new Error('This reset link is missing or expired.');
        const result = await authClient.resetPassword({ newPassword: String(values.password), token });
        if (result.error) throw new Error(result.error.message ?? 'Unable to reset password.');
        setMessage('Password updated. You can now sign in.');
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.'); }
    finally { setPending(false); }
  }

  const titles = { login: 'Welcome back.', signup: 'Create your account.', forgot: 'Reset your password.', reset: 'Choose a new password.' };
  async function signInWithGoogle() {
    setError(''); setMessage(''); setPending(true);
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
      if (result.error) throw new Error(result.error.message ?? 'Google sign-in is not available right now.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Google sign-in is not available right now.'); setPending(false); }
  }

  return <form className="auth-card" onSubmit={submit}>
    <p className="eyebrow">Customer portal</p><h1>{titles[mode]}</h1>
    {mode === 'signup' && <div className="field" style={{ marginTop: 18 }}><label htmlFor="name">Full name</label><input id="name" name="name" required autoComplete="name" /></div>}
    {mode !== 'reset' && <div className="field" style={{ marginTop: 18 }}><label htmlFor="email">Email address</label><input id="email" name="email" type="email" required autoComplete="email" /></div>}
    {(mode === 'login' || mode === 'signup' || mode === 'reset') && <div className="field" style={{ marginTop: 14 }}><label htmlFor="password">Password</label><input id="password" name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>}
    {mode === 'signup' && <div className="field" style={{ marginTop: 14 }}><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" /></div>}
    {error && <div className="notice error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}
    <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={pending}>{pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Update password'}</button>
    {mode === 'login' && <><button type="button" className="btn btn-outline" style={{ width: '100%', marginTop: 10 }} onClick={signInWithGoogle} disabled={pending}>Continue with Google</button><p style={{ textAlign: 'center', marginBottom: 0 }}><a className="card-link" href="/forgot-password">Forgot password?</a></p></>}
  </form>;
}
