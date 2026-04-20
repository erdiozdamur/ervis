import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { transcribeMealAudioFile } from '@/services/meal-analysis/audio-transcription-service';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: 'Yetkisiz erişim.' }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const audioFile = formData?.get('audio');

  if (!(audioFile instanceof File)) {
    return NextResponse.json({ ok: false, message: 'Ses dosyası bulunamadı.' }, { status: 400 });
  }

  const transcription = await transcribeMealAudioFile(audioFile);

  if (transcription.status !== 'completed') {
    return NextResponse.json(
      {
        ok: false,
        message: transcription.message ?? 'Ses kaydı şu anda çözümlenemedi.',
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    transcription,
  });
}
