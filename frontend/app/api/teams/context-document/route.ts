import { NextRequest, NextResponse } from 'next/server';
import { ContextOwnerType, ContextSourceType } from '@prisma/client';
import { prisma } from '@/db/client';
import { auth } from '@/auth';
import { canAccessTeam } from '@/server/auth/access';
import { createAuditLog } from '@/features/audit/service';

const MAX_FILE_BYTES = 1_500_000;
const MAX_EMBEDDING_INPUT_CHARS = 12_000;
const ALLOWED_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'json', 'csv', 'log', 'text']);

function isSupportedTextFile(file: File) {
  const mime = (file.type || '').toLowerCase();
  if (mime.startsWith('text/')) return true;
  if (mime === 'application/json') return true;
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  return Boolean(ext && ALLOWED_EXTENSIONS.has(ext));
}

function extractTextFromBuffer(input: ArrayBuffer) {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(input).trim();
}

async function createEmbedding(input: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input,
    }),
  });

  if (!res.ok) {
    const payload = await res.text();
    throw new Error(`Embedding request failed: ${payload}`);
  }

  const payload = await res.json();
  const vector = payload?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || !vector.length) throw new Error('Embedding vector could not be created.');
  return vector as number[];
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const teamId = String(formData.get('teamId') ?? '');
  const file = formData.get('file');

  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file.' }, { status: 400 });
  if (!(await canAccessTeam(session.user.id, teamId))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'File is too large.' }, { status: 400 });
  if (!isSupportedTextFile(file)) return NextResponse.json({ error: 'Unsupported file type. Please upload a text-based document.' }, { status: 400 });

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, organizationId: true } });
  if (!team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const buffer = await file.arrayBuffer();
  const text = extractTextFromBuffer(buffer);
  if (!text) return NextResponse.json({ error: 'Document content is empty or unsupported.' }, { status: 400 });

  const embeddingInput = text.slice(0, MAX_EMBEDDING_INPUT_CHARS);
  const embedding = await createEmbedding(embeddingInput);
  const metadata = {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    uploadedBy: session.user.id,
    uploadedAt: new Date().toISOString(),
    originalLength: text.length,
    ownerType: 'TEAM',
    ownerId: team.id,
  };

  const source = await prisma.contextSource.create({
    data: {
      organizationId: team.organizationId,
      ownerType: ContextOwnerType.TEAM,
      ownerId: team.id,
      title: file.name,
      type: ContextSourceType.DOCUMENT_REFERENCE,
      content: text,
      metadata,
    },
  });

  const vectorLiteral = `[${embedding.join(',')}]`;
  await prisma.$executeRaw`UPDATE "ContextSource" SET "embedding" = ${vectorLiteral}::vector WHERE "id" = ${source.id}`;

  await createAuditLog({
    actorId: session.user.id,
    organizationId: team.organizationId,
    action: 'CONTEXT_SOURCE_CREATED',
    subjectType: 'ContextSource',
    subjectId: source.id,
    metadata: { ownerType: 'TEAM', ownerId: team.id, fileName: file.name },
  });

  return NextResponse.json({ id: source.id, title: source.title });
}

