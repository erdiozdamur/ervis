import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { isAdminEmail } from '@/lib/auth/admin';
import { isAdminManagedSecretKey } from '@/lib/secrets/secret-catalog';
import { rotateSecretWithAudit } from '@/services/secrets/secret-rotation-service';

const rotateSecretSchema = z.object({
  value: z.string().min(1, 'Secret değeri boş olamaz.'),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request, context: { params: { secretKey: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const { secretKey } = context.params;

  if (!isAdminManagedSecretKey(secretKey)) {
    return NextResponse.json({ message: 'Desteklenmeyen secret anahtarı.' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = rotateSecretSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? 'Geçersiz istek gövdesi.' },
      { status: 400 },
    );
  }

  try {
    const result = await rotateSecretWithAudit({
      key: secretKey,
      value: parsed.data.value,
      note: parsed.data.note ?? null,
      actorUserId: session.user.id,
      actorEmail: session.user.email ?? 'unknown',
    });

    return NextResponse.json(
      {
        ok: true,
        key: result.key,
        source: result.source,
        rotatedAt: result.rotatedAt,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Secret rotasyonu sırasında hata oluştu.',
      },
      { status: 501 },
    );
  }
}
