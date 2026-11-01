import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { currentUser } from '@/lib/auth';
import { countUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign up · Cabinet Cutlist' };

export default async function SignupPage() {
  if (await currentUser()) redirect('/');
  return <AuthForm mode="signup" first={countUsers() === 0} />;
}
