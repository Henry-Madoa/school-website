import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth.ts';

/*
 * Whether this browser holds a live admin session — nothing more. The public pages ask after they
 * load, so they can stay cacheable instead of reading the session cookie on the server.
 */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ signedIn: !!user }, { headers: { 'Cache-Control': 'no-store' } });
}
