import { ScreenHeader } from '@/components/layout/screen-header';
import { requireCurrentUser } from '@/lib/auth/session';
import { requireAdminPageAccess } from '@/lib/auth/admin';
import { notFound } from 'next/navigation';
import { getAnalysisRules } from '@/services/meal-analysis/analysis-rule-repository';
import { AnalysisRulesEditor } from '@/components/admin/analysis-rules-editor';

export default async function AdminPage() {
  const user = await requireCurrentUser();
  const hasAccess = await requireAdminPageAccess(user.id);

  if (!hasAccess) {
    notFound();
  }

  const ruleSnapshot = await getAnalysisRules();

  return (
    <section className="space-y-4">
      <ScreenHeader eyebrow="Yönetim" title="Yönetim Paneli" description="Analiz pipeline ayarları burada yönetilir." />
      {ruleSnapshot.source === 'default_invalid_stored' ? (
        <StatePanel
          variant="warning"
          title="Kayıtlı kural seti geçersiz"
          description="Geçersiz JSON prod akışına uygulanmadı; varsayılan kurallar aktif. Lütfen kuralları doğrulayarak yeniden kaydet."
        />
      ) : null}
      <AnalysisRulesEditor initialRules={ruleSnapshot.rules} />
    </section>
  );
}
