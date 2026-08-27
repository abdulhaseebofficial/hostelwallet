import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import aiService from '../../services/aiService';
import { getErrorMessage } from '../../services/api';
import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import { cn, initials } from '../../utils/format';

const SUGGESTIONS = [
  'How can I save more this month?',
  'Where am I overspending?',
  'Is my food spending normal for a hostel student?',
  'Help me save 5000 before next month',
];

export default function ChatBox({ userName = 'You' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    aiService
      .history()
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (text) => {
    const question = (text || input).trim();
    if (!question || sending) return;

    setInput('');
    setMessages((current) => [...current, { role: 'user', content: question, _id: `local-${Date.now()}` }]);
    setSending(true);

    try {
      const { reply } = await aiService.chat(question);
      setMessages((current) => [...current, { role: 'assistant', content: reply, _id: `local-${Date.now()}-a` }]);
    } catch (error) {
      toast.error(getErrorMessage(error));
      // Put the question back so nothing is lost.
      setMessages((current) => current.slice(0, -1));
      setInput(question);
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    try {
      await aiService.clearChat();
      setMessages([]);
      toast.success('Conversation cleared');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="hw-card flex h-[68vh] min-h-[420px] flex-col overflow-hidden p-0">
      <header className="flex items-center gap-2.5 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your money coach</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Answers based on your real spending</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clear}
            title="Clear conversation"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-danger/10 hover:text-danger dark:hover:bg-danger/15"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
              <Sparkles className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </span>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Ask me anything about your money
            </h3>
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
              I can see your expenses, budgets and goals, so the answers are about your actual numbers.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message._id || message.createdAt}
              className={cn('flex gap-2.5', message.role === 'user' && 'flex-row-reverse')}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                  message.role === 'user'
                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                    : 'bg-brand-600 text-white'
                )}
                aria-hidden="true"
              >
                {message.role === 'user' ? initials(userName) : <Sparkles className="h-4 w-4" />}
              </span>

              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'rounded-tr-sm bg-brand-600 text-white'
                    : 'rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                )}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {sending && (
          <div className="flex gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {messages.length === 0 && !loading && (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => send(suggestion)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-800"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter starts a new line.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Ask about your spending..."
          aria-label="Your question"
          className="hw-input max-h-32 min-h-[44px] flex-1 resize-none py-3"
        />
        <Button type="submit" icon={Send} loading={sending} disabled={!input.trim()} className="h-11 px-4">
          <span className="sr-only sm:not-sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
