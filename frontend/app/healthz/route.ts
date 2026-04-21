import { NextResponse } from 'next/server';
import { getHealthPayload } from '@/services/health/health-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getHealthPayload(), { status: 200 });
}
