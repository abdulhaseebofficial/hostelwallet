import { useCallback, useEffect, useState } from 'react';
import { CalendarRange, Lightbulb, MessageSquare, RefreshCw, Sparkles, WifiOff } from 'lucide-react';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/Skeleton';
import ChatBox from '../components/ai/ChatBox';
import AdviceCard from '../components/ai/AdviceCard';
import { useAuth } from '../context/AuthContext';
import useMutation from '../hooks/useMutation';
import aiService from '../services/aiService';
import { cn } from '../utils/format';

const TABS = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'advice', label: 'Monthly advice', icon: Lightbulb },
  { key: 'weekly', label: 'Weekly wrap-up', icon: CalendarRange },
];

export default function AIAdvisor() {
  const { user, currency } = useAuth();
  const [tab, setTab] = useState('chat');
  const [status, setStatus] = useState(null);

  const [advice, setAdvice] = useState(null);
  const { saving: adviceLoading, run: runAdvice } = useMutation();

  const [weekly, setWeekly] = useState(null);
  const { saving: weeklyLoading, run: runWeekly } = useMutation();

  useEffect(() => {
    aiService.status().then(setStatus).catch(() => setStatus({ configured: false }));
  }, []);

  // Each tab keeps its own in-flight flag, so opening one does not grey out the other.
  const loadAdvice = useCallback(
    () => runAdvice(() => aiService.advice({ tipCount: 4 }), { onDone: setAdvice }),
    [runAdvice]
  );

  const loadWeekly = useCallback(
    () => runWeekly(() => aiService.weeklySummary(), { onDone: setWeekly }),
    [runWeekly]
  );

  // Fetch a tab's data the first time it is opened, not before.
  useEffect(() => {
    if (tab === 'advice' && !advice && !adviceLoading) loadAdvice();
    if (tab === 'weekly' && !weekly && !weeklyLoading) loadWeekly();
  }, [tab, advice, weekly, adviceLoading, weeklyLoading, loadAdvice, loadWeekly]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Advisor"
        badge={
          status && !status.configured ? (
            <Badge tone="warning" icon={WifiOff}>
              Offline mode
            </Badge>
          ) : null
        }
        subtitle={
          status && status.configured
            ? `Advice written from your actual expenses, budgets and goals${status.model ? ` · ${status.model}` : ''}.`
            : 'No API key on the server, so the built-in rule-based advisor is answering.'
        }
      />

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              tab === option.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            <option.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && <ChatBox userName={user ? user.name : 'You'} />}

      {tab === 'advice' && (
        <Card>
          <CardHeader
            title="This month's advice"
            subtitle={advice && advice.context ? advice.context.monthLabel : undefined}
            icon={Sparkles}
            action={
              <Button variant="ghost" size="sm" icon={RefreshCw} loading={adviceLoading} onClick={loadAdvice}>
                Refresh
              </Button>
            }
          />

          {adviceLoading && !advice ? (
            <SkeletonCard lines={8} className="border-0 p-0 shadow-none" />
          ) : (
            <AdviceCard advice={advice} currency={currency} />
          )}
        </Card>
      )}

      {tab === 'weekly' && (
        <Card>
          <CardHeader
            title="Your last 7 days"
            icon={CalendarRange}
            action={
              <Button variant="ghost" size="sm" icon={RefreshCw} loading={weeklyLoading} onClick={loadWeekly}>
                Refresh
              </Button>
            }
          />

          {weeklyLoading && !weekly ? (
            <SkeletonCard lines={5} className="border-0 p-0 shadow-none" />
          ) : weekly ? (
            <div className="space-y-4">
              <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                {weekly.summary}
              </p>

              {weekly.breakdown && weekly.breakdown.length > 0 && (
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {weekly.breakdown.map((row) => (
                    <li key={row.category} className="flex justify-between py-2">
                      <span className="text-slate-600 dark:text-slate-400">{row.category}</span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {row.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
