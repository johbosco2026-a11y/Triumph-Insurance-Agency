import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/security/request';

const schema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().max(254), phone: z.string().trim().max(40).optional(), type: z.string().trim().min(1).max(80), message: z.string().trim().min(2).max(4000) });

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const limitError = await enforceRateLimit(req, 'public-quote', 5); if (limitError) return limitError;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Please complete all required fields.' }, { status: 400 });
  const r = await prisma.insuranceRequest.create({ data: parsed.data });
  return NextResponse.json({ id: r.id }, { status: 201 });
}
