import { redirect } from 'next/navigation';

type HistoryPageProps = {
  searchParams?: {
    day?: string | string[];
  };
};

export default function HistoryPage({ searchParams }: HistoryPageProps) {
  const dayCandidate = Array.isArray(searchParams?.day) ? searchParams?.day[0] : searchParams?.day;

  if (dayCandidate) {
    redirect(`/app?day=${encodeURIComponent(dayCandidate)}`);
  }

  redirect('/app');
}
