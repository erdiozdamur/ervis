'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';

type AdminTab = {
  id: string;
  title: string;
  description: string;
};

const TABS: AdminTab[] = [
  { id: 'users', title: 'Kullanıcılar', description: 'Kullanıcı listesi, rol atamaları ve erişim kontrolü.' },
  { id: 'prompts', title: 'Promptlar', description: 'AI prompt metinleri ve sürüm yönetimi.' },
  { id: 'ai-settings', title: 'AI Ayarları', description: 'Model, sağlayıcı ve inference davranışları.' },
  { id: 'system-settings', title: 'Sistem Ayarları', description: 'Genel platform ayarları ve feature flag yapısı.' },
  { id: 'audit-log', title: 'Audit Log', description: 'Admin aksiyonlarının kim-ne-zaman kaydı.' },
];

export function AdminTabs() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0]?.id ?? 'users');
  const active = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {tab.title}
            </button>
          );
        })}
      </div>

      <Card className="p-4">
        <h2 className="text-base font-semibold text-slate-900">{active.title}</h2>
        <p className="mt-2 text-sm text-slate-600">{active.description}</p>
      </Card>
    </section>
  );
}
