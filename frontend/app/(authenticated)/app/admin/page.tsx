import { prisma } from '@/db/prisma';
import { isAdminEmail } from '@/lib/auth/admin';
import { requireCurrentUser } from '@/lib/auth/session';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatePanel } from '@/components/ui/state-panel';
import { getDefaultPromptTemplates } from '@/services/meal-analysis/prompt-template-service';
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

  return lines;
}

async function assertAdmin() {
  const user = await requireCurrentUser();
  if (!isAdminEmail(user.email)) {
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
    <section className="space-y-6">
      <ScreenHeader
        eyebrow="Yönetim"
        title="Promptlar"
        description="PromptTemplate sürümlerini oluştur, aktif sürümü değiştir ve geçmiş sürümlerin farklarını incele."
      />

      <Card className="space-y-4 p-4">
        <h2 className="text-base font-semibold">Yeni prompt versiyonu oluştur</h2>
        <form action={createPromptVersion} className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 md:col-span-1">
            <span className="text-sm font-medium">Key</span>
            <Input name="key" placeholder="meal-analysis.stage1.image-itemizer.primary" required />
          </label>
          <label className="space-y-1 md:col-span-1">
            <span className="text-sm font-medium">Version</span>
            <Input name="version" placeholder="v2" required />
          </label>
          <label className="space-y-1 md:col-span-1">
            <span className="text-sm font-medium">Locale</span>
            <Input name="locale" defaultValue="tr-TR" required />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">System Instructions</span>
            <Textarea name="systemInstructions" rows={6} required />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium">User Template</span>
            <Textarea name="userTemplate" rows={6} required />
          </label>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" name="activateNow" />
            Oluşturduktan sonra aktif yap
          </label>
          <div className="md:col-span-2">
            <Button type="submit">Versiyon oluştur</Button>
          </div>
        </form>
      </Card>

      {Object.keys(grouped).length === 0 ? (
        <StatePanel
          variant="empty"
          title="Henüz prompt kaydı yok"
          description="İlk versiyonu oluşturabilir veya fallback default promptlarla devam edebilirsiniz."
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([groupKey, versions]: [string, PromptTemplateRow[]]) => {
            const active = versions.find((entry) => entry.isActive) ?? null;
            const sorted = [...versions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            const previous = active ? sorted.find((entry) => entry.id !== active.id) ?? null : sorted[1] ?? null;
            const instructionDiff = active && previous ? buildLineDiff(previous.systemInstructions, active.systemInstructions) : [];
            const userTemplateDiff = active && previous ? buildLineDiff(previous.userTemplate, active.userTemplate) : [];

            return (
              <Card key={groupKey} className="space-y-4 p-4">
                <div>
                  <h3 className="font-semibold">{groupKey.replace('::', ' / ')}</h3>
                  <p className="text-sm text-slate-500">Toplam versiyon: {versions.length}</p>
                </div>

                <div className="space-y-2">
                  {sorted.map((version) => (
                    <form key={version.id} action={activatePromptVersion} className="flex items-center justify-between gap-3 rounded border p-2">
                      <input type="hidden" name="id" value={version.id} />
                      <div className="text-sm">
                        <p className="font-medium">
                          {version.version} {version.isActive ? '(aktif)' : ''}
                        </p>
                        <p className="text-slate-500">{version.createdAt.toISOString()}</p>
                      </div>
                      <Button type="submit" variant={version.isActive ? 'ghost' : 'secondary'} disabled={version.isActive}>
                        {version.isActive ? 'Aktif' : 'Aktif yap'}
                      </Button>
                    </form>
                  ))}
                </div>

                {active && previous ? (
                  <div className="space-y-3">
                    <h4 className="font-medium">Aktif sürüm diff ({previous.version} → {active.version})</h4>
                    <div>
                      <p className="mb-1 text-sm font-medium">System Instructions</p>
                      <pre className="max-h-56 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-200">
                        {instructionDiff
                          .map((line) => `${line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '} ${line.text}`)
                          .join('\n')}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">User Template</p>
                      <pre className="max-h-56 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-200">
                        {userTemplateDiff
                          .map((line) => `${line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '} ${line.text}`)
                          .join('\n')}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Card className="space-y-3 p-4">
        <h2 className="text-base font-semibold">Fallback default promptlar</h2>
        <p className="text-sm text-slate-500">DB erişimi olmadığında uygulama bu gömülü promptları kullanır.</p>
        <ul className="list-inside list-disc text-sm">
          {defaultTemplates.map((template) => (
            <li key={`${template.key}-${template.version}`}>
              {template.key} / {template.version} / {template.locale}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
