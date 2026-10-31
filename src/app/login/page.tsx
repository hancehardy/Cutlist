import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/AuthForm';
import { currentUser } from '@/lib/auth';
import { countUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in · Cabinet Cutlist' };

export default async function LoginPage() {
  if (await currentUser()) redirect('/');
  // Nothing to sign in to yet: the first visitor sets up the admin account.
  if (countUsers() === 0) redirect('/signup');
  return <AuthForm mode="login" />;
}
