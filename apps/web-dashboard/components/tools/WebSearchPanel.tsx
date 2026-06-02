'use client';

import { useCallback, useState } from 'react';

import { ExternalUrlActions } from '../ui/ExternalUrlActions';
import { postWebExtract, postWebCrawl, postWebSearch, type WebSearchResponse } from '../../lib/api';
import { saveToolOutputAsMemory } from '../../lib/tools/saveToolOutputAsMemory';

type Props = { projectKey: string };

export function WebSearchPanel({ projectKey }: Props) {
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('all');
  const [timeRange, setTimeRange] = useState<'day' | 'month' | 'year' | ''>('');
  const [safesearch, setSafesearch] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WebSearchResponse | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setActionMsg(null);
    try {
      const res = await postWebSearch({
        query: q,
        language,
        safesearch,
        ...(timeRange ? { time_range: timeRange } : {}),
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query, language, timeRange, safesearch]);

  const saveResult = useCallback(
    async (idx: number) => {
      if (!data?.results?.[idx]) return;
      const r = data.results[idx];
      const body = [`Query: ${data.query}`, `Title: ${r.title}`, `URL: ${r.url}`, '', r.snippet].join('\n');
      try {
        await saveToolOutputAsMemory({
          projectKey,
          title: `Web search: ${r.title}`.slice(0, 500),
          body,
          sourceTool: 'web_search',
        });
        setActionMsg(`Saved [${idx + 1}] to project memory.`);
      } catch (e) {
        setActionMsg(e instanceof Error ? e.message : String(e));
      }
    },
    [data, projectKey],
  );

  const extractUrl = useCallback(async (url: string) => {
    setActionMsg('Extracting…');
    try {
      const ex = await postWebExtract({ url, render_js: true });
      setActionMsg(`Extract OK (${ex.text?.length ?? 0} chars). See browser console or save from capture tool.`);
      console.info('web_search extract', ex);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const crawlUrl = useCallback(async (url: string) => {
    setActionMsg('Crawling (may take a while)…');
    try {
      const cr = await postWebCrawl({ url, max_pages: 8, max_depth: 2 });
      setActionMsg(`Crawl OK: ${cr.pages?.length ?? 0} pages.`);
      console.info('web_search crawl', cr);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div className="space-y-3 text-[11px]">
      <p className="text-app-muted">
        Private SearXNG metasearch (outbound to public engines). Results can be saved to memory or passed to Web
        Capture extract/crawl. Tool-capable agents may search autonomously when <code>use_tools</code> is set on a run.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded border border-app-border bg-app-fill px-2 py-1"
          placeholder="Search query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void runSearch()}
        />
        <select
          className="rounded border border-app-border bg-app-fill px-2 py-1"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="all">all languages</option>
          <option value="en">en</option>
          <option value="fr">fr</option>
          <option value="de">de</option>
        </select>
        <select
          className="rounded border border-app-border bg-app-fill px-2 py-1"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
        >
          <option value="">any time</option>
          <option value="day">past day</option>
          <option value="month">past month</option>
          <option value="year">past year</option>
        </select>
        <select
          className="rounded border border-app-border bg-app-fill px-2 py-1"
          value={String(safesearch)}
          onChange={(e) => setSafesearch(Number(e.target.value))}
        >
          <option value="0">safe: off</option>
          <option value="1">safe: moderate</option>
          <option value="2">safe: strict</option>
        </select>
        <button
          type="button"
          className="rounded bg-app-accent px-3 py-1 text-app-accent-fg disabled:opacity-50"
          disabled={loading || !query.trim()}
          onClick={() => void runSearch()}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>
      {!projectKey ? (
        <p className="text-amber-700 dark:text-amber-300">Select a project in Workspaces to save results to memory.</p>
      ) : null}
      {error ? <p className="text-red-600 dark:text-red-400">{error}</p> : null}
      {actionMsg ? <p className="text-app-muted">{actionMsg}</p> : null}
      {data?.results?.length ? (
        <ul className="space-y-2">
          {data.results.map((r, i) => (
            <li key={`${r.url}-${i}`} className="rounded border border-app-border bg-app-fill/50 p-2">
              <div className="font-medium text-app-text">
                [{i + 1}] {r.title || '(no title)'}
              </div>
              <ExternalUrlActions url={r.url} className="mt-0.5" />
              <p className="mt-1 text-app-muted">{r.snippet}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-app-border px-2 py-0.5 hover:bg-app-fill"
                  disabled={!projectKey}
                  onClick={() => void saveResult(i)}
                >
                  Save to memory
                </button>
                <button
                  type="button"
                  className="rounded border border-app-border px-2 py-0.5 hover:bg-app-fill"
                  onClick={() => void extractUrl(r.url)}
                >
                  Extract
                </button>
                <button
                  type="button"
                  className="rounded border border-app-border px-2 py-0.5 hover:bg-app-fill"
                  onClick={() => void crawlUrl(r.url)}
                >
                  Crawl
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : data ? (
        <p className="text-app-muted">No results.</p>
      ) : null}
    </div>
  );
}
