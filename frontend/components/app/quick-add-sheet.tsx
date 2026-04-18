'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, buttonStyles } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ListItem } from '@/components/ui/list-item';

const options = [
  {
    title: 'Snap a photo',
    description: 'Best for plated meals, packaging, or restaurant dishes.',
    icon: 'photo' as const,
  },
  {
    title: 'Describe the meal',
    description: 'Fastest when you already know what you ate.',
    icon: 'text' as const,
  },
  {
    title: 'Build it manually',
    description: 'Great for maximum control and precise edits.',
    icon: 'plus' as const,
  },
];

export function QuickAddSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonStyles({ variant: 'primary', fullWidth: true })} onClick={() => setOpen(true)}>
        Choose input method
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Start a meal draft"
        description="Every method leads into an editable review step before anything is saved."
        footer={
          <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        {options.map((option) => (
          <ListItem
            key={option.title}
            leading={<Icon name={option.icon} className="h-5 w-5" />}
            title={option.title}
            description={option.description}
            trailing={<Icon name="chevronRight" className="h-4 w-4" />}
          />
        ))}
      </BottomSheet>
    </>
  );
}
