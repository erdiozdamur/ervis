import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { isAdminEmail } from '@/lib/auth/admin';
import { analysisRuleSetSchema } from '@/lib/analysis-rules/schema';
import { getAnalysisRules, saveAnalysisRules } from '@/services/meal-analysis/analysis-rule-repository';

function ensureAdminEmail(email?: string | null) {
  return isAdminEmail(email);
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const snapshot = await getAnalysisRules();
  return NextResponse.json({ ok: true, rules: snapshot.rules, source: snapshot.source });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!ensureAdminEmail(session?.user?.email)) {
    return NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = analysisRuleSetSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Kural JSON şeması doğrulanamadı. Değişiklik canlıya alınmadı.',
        fieldErrors: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const saved = await saveAnalysisRules(parsed.data);
  if (!saved.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Kural JSON şeması doğrulanamadı. Değişiklik canlıya alınmadı.',
        fieldErrors: saved.errors,
      },
      { status: 400 },
    );
  }

  revalidatePath('/app/admin');

  return NextResponse.json({ ok: true, rules: saved.rules }, { status: 200 });
}
