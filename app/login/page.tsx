import Link from 'next/link';
import { AuthForm } from '@/app/auth-form';
export default function LoginPage() { return <main className="page"><div className="container auth-wrap"><AuthForm mode="login" /><p style={{ textAlign: 'center' }}>New to Triumph? <Link className="card-link" href="/signup">Create an account</Link></p></div></main>; }
