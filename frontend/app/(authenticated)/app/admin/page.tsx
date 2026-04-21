import { Role } from '@prisma/client';
import { ScreenHeader } from '@/components/layout/screen-header';
import { UserRoleManager } from '@/components/admin/user-role-manager';
import { requireCurrentUser } from '@/lib/auth/session';
import { canAccessAdminPanel } from '@/lib/auth/admin';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

type PromptTemplateRow = {
  id: string;
  key: string;
  version: string;
  locale: string;
  systemInstructions: string;
  userTemplate: string;
  isActive: boolean;
  createdAt: Date;
};

type DiffLine = {
  kind: 'added' | 'removed' | 'unchanged';
  text: string;
};

function buildLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  const lines: DiffLine[] = [];

  for (let index = 0; index < max; index += 1) {
    const oldLine = oldLines[index];
    const newLine = newLines[index];

    if (oldLine === newLine && typeof oldLine === 'string') {
      lines.push({ kind: 'unchanged', text: oldLine });
      continue;
    }

    if (typeof oldLine === 'string') {
      lines.push({ kind: 'removed', text: oldLine });
    }

    if (typeof newLine === 'string') {
      lines.push({ kind: 'added', text: newLine });
    }
  }

  if (!(await canAccessAdminPanel(user.id))) {
    notFound();
  }

  return user;
}

async function createPromptVersion(formData: FormData) {
  'use server';

  const user = await assertAdmin();

  const key = String(formData.get('key') ?? '').trim();
  const version = String(formData.get('version') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'tr-TR').trim() || 'tr-TR';
  const systemInstructions = String(formData.get('systemInstructions') ?? '').trim();
  const userTemplate = String(formData.get('userTemplate') ?? '').trim();
  const activateNow = String(formData.get('activateNow') ?? '') === 'on';

  if (!key || !version || !systemInstructions || !userTemplate) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (activateNow) {
      await tx.promptTemplate.updateMany({
        where: {
          key,
          locale,
          isActive: true,
        },
        data: {
          isActive: false,
          updatedBy: user.id,
        },
      });
    }

    await tx.promptTemplate.create({
      data: {
        key,
        version,
        locale,
        systemInstructions,
        userTemplate,
        isActive: activateNow,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
  });

  revalidatePath('/app/admin');
}

async function activatePromptVersion(formData: FormData) {
  'use server';

  const user = await assertAdmin();
  const id = String(formData.get('id') ?? '').trim();

  if (!id) {
    return;
  }

  const target = await prisma.promptTemplate.findUnique({
    where: { id },
    select: { id: true, key: true, locale: true },
  });

  if (!target) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.promptTemplate.updateMany({
      where: {
        key: target.key,
        locale: target.locale,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedBy: user.id,
      },
    });

    await tx.promptTemplate.update({
      where: { id: target.id },
      data: {
        isActive: true,
        updatedBy: user.id,
      },
    });
  });

  revalidatePath('/app/admin');
}

export default async function AdminPage() {
  await assertAdmin();

  const templates: PromptTemplateRow[] = await prisma.promptTemplate.findMany({
    orderBy: [{ key: 'asc' }, { locale: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      key: true,
      version: true,
      locale: true,
      systemInstructions: true,
      userTemplate: true,
      isActive: true,
      createdAt: true,
    },
  });

  const grouped = templates.reduce<Record<string, PromptTemplateRow[]>>((acc, template) => {
    const groupKey = `${template.key}::${template.locale}`;
    const bucket = acc[groupKey] ?? [];
    bucket.push(template);
    acc[groupKey] = bucket;
    return acc;
  }, {});

  const defaultTemplates = getDefaultPromptTemplates();

  return (
    <section className="space-y-4">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Admin yetkileri bu sayfadan yönetilecek." />
      <div className="flex items-center gap-2 border-b border-slate-200">
        <span className="rounded-t-lg border border-b-0 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
          Kullanıcılar
        </span>
      </div>
      <UserRoleManager actorUserId={user.id} roles={Object.values(Role)} />
    </section>
  );
}
