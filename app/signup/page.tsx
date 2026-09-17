import Link from 'next/link';
import { AuthForm } from '@/app/auth-form';
export default function SignupPage() { return <main className="page"><div className="container auth-wrap"><AuthForm mode="signup" /><p style={{ textAlign: 'center' }}>Already registered? <Link className="card-link" href="/login">Sign in</Link></p></div></main>; }
