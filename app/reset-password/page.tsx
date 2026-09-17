import Link from 'next/link';
import { AuthForm } from '@/app/auth-form';
export default function ResetPasswordPage() { return <main className="page"><div className="container auth-wrap"><AuthForm mode="reset" /><p style={{ textAlign: 'center' }}><Link className="card-link" href="/login">Back to sign in</Link></p></div></main>; }
