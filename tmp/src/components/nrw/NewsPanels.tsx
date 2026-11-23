import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, ChevronDown, Landmark, Newspaper } from 'lucide-react';
import {
 categoryLabels, isRegion, newsDateFormats, regionLabels, relativeNewsTime,
 type News, type NewsCategory, type NewsLocale, type NewsRegion, type NewsState,
} from './newsData';
import { RegionMap } from './RegionMap';

type Copy = (value: string) => string;
type Formats = ReturnType<typeof newsDateFormats>;
const NEWS_PREVIEW_COUNT = 8;
const BOCHUM_DIRECTORY_PREVIEW_COUNT = 3;

function Tag({ category, children }: { category: NewsCategory; children: string }) {
 return <span className={`nrw-news-tag nrw-news-tag--${category}`}>{children}</span>;
}

function NewsRows({ items, formats, now }: { items: News[]; formats: Formats; now: number }) {
 return <ul className="nrw-news-rows">
  {items.map(item => <li key={item.url}>
   <a href={item.url} target="_blank" rel="noopener noreferrer" className="nrw-news-row">
    <span className="nrw-news-headline" title={item.source}>
     <Tag category={item.category}>{item.shortName}</Tag>
     <strong>{item.title}</strong>
    </span>
    <span className="nrw-news-time">
     {item.publishedAt && <time dateTime={item.publishedAt} title={formats.absolute.format(new Date(item.publishedAt))}>
      {relativeNewsTime(formats.relative, item.publishedAt, now)}
     </time>}
     <ArrowUpRight size={14} aria-hidden="true"/>
    </span>
   </a>
  </li>)}
 </ul>;
}

function FeaturedNews({ item, formats, now }: { item: News; formats: Formats; now: number }) {
 const absolute = item.publishedAt && formats.absolute.format(new Date(item.publishedAt));
 return <a href={item.url} target="_blank" rel="noopener noreferrer" className="nrw-news-row nrw-news-featured">
  <span className="nrw-news-headline" title={item.source}>
   <Tag category={item.category}>{item.shortName}</Tag>
   <strong>{item.title}</strong>
   {item.publishedAt && absolute && <time dateTime={item.publishedAt} title={absolute}>
    <span>{relativeNewsTime(formats.relative, item.publishedAt, now)}</span>
    <span>{absolute}</span>
   </time>}
  </span>
  <ArrowUpRight size={18} aria-hidden="true"/>
 </a>;
}

function NewsStatus({ loading, error, tr }: { loading: boolean; error: boolean; tr: Copy }) {
 if (loading) return <div className="nrw-news-loading" role="status" aria-label={tr('Nachrichten werden geladen …')}>
  {Array.from({ length: 5 }, (_, index) => <div key={index} className="nrw-news-skeleton" aria-hidden="true"><span/></div>)}
 </div>;
 return <div className="nrw-news-status" role="status">
  <p>{tr(error ? 'Nachrichten derzeit nicht verfügbar.' : 'Keine aktuellen Meldungen verfügbar.')}</p>
  <a href="#nrw-main-sources">{tr('Zu den Quellen')} <ArrowRight size={14} aria-hidden="true"/></a>
 </div>;
}

export function NewsFeed({ state, language, tr, detail = false }: {
 state: NewsState; language: NewsLocale; tr: Copy; detail?: boolean;
}) {
 const [query] = useSearchParams();
 const requestedRegion = detail ? query.get('region') : null;
 const initialRegion = isRegion(requestedRegion) ? requestedRegion : '';
 const [selection, setSelection] = useState<{ query: string | null; value: NewsRegion | '' }>();
 const [category, setCategory] = useState<NewsCategory | ''>('');
 const [expanded, setExpanded] = useState(false);
 const listId = useId();
 const formats = newsDateFormats(language);
 const { news, updatedAt, sourcesOk, newsLoading, newsError } = state;
 const counts = new Map<NewsRegion, number>();
 for (const item of news) counts.set(item.region, (counts.get(item.region) || 0) + 1);
 const selectedRegion = selection && selection.query === requestedRegion ? selection.value : initialRegion;
 const region = selectedRegion && (counts.has(selectedRegion) || initialRegion === selectedRegion) ? selectedRegion : '';
 const filtered = news.filter(item => (!region || item.region === region) && (!category || item.category === category));
 const visible = detail || expanded ? filtered : filtered.slice(0, NEWS_PREVIEW_COUNT);
 const [featured, ...remaining] = visible;
 const showMap = import.meta.env.VITE_NRW_REGION_MAP_ENABLED === 'true';
 const chooseRegion = (value: NewsRegion | '') => {
  setSelection({ query: requestedRegion, value });
  setExpanded(false);
 };
 const update = updatedAt && sourcesOk !== null
  ? tr('Stand {time} · {count} Quellen')
   .replace('{time}', formats.clock.format(new Date(updatedAt)))
   .replace('{count}', formats.number.format(sourcesOk))
  : null;

 return <section className={`nrw-news nrw-news-feed${detail ? ' nrw-card--news' : ''}`} aria-labelledby="nrw-club-news">
  <div className="nrw-news-heading">
   <h2 id="nrw-club-news">
    <Newspaper size={22} aria-hidden="true"/>
    <span>{tr('Schach-Nachrichten aus NRW')}</span>
   </h2>
   {update && <time dateTime={updatedAt!}>{update}</time>}
  </div>
  <div className="nrw-news-content" id={listId}>
   {(showMap || featured) && <div className="nrw-news-lead">
    {showMap && <RegionMap counts={counts} selected={region} onSelect={chooseRegion} tr={tr} number={formats.number}/>}
    {featured && <FeaturedNews item={featured} formats={formats} now={state.now}/>}
   </div>}
   {(news.length > 0 || detail && initialRegion) && <div className="nrw-news-filters" role="group" aria-label={tr('Nach Region filtern')}>
    <button type="button" data-nrw-filter-region="" aria-pressed={!region} onClick={() => chooseRegion('')}>
     {tr('Alle')} <span>{formats.number.format(news.length)}</span>
    </button>
    {(Object.keys(regionLabels) as NewsRegion[]).filter(key => counts.has(key) || key === initialRegion).map(key =>
     <button type="button" key={key} data-nrw-filter-region={key} aria-pressed={key === region} onClick={() => chooseRegion(key)}>
      {tr(regionLabels[key])} <span>{formats.number.format(counts.get(key) ?? 0)}</span>
     </button>)}
   </div>}
   {detail && news.length > 0 && <div className="nrw-news-filters" role="group" aria-label={tr('Nach Kategorie filtern')}>
    <button type="button" aria-pressed={!category} onClick={() => setCategory('')}>{tr('Alle')}</button>
    {(Object.keys(categoryLabels) as NewsCategory[]).map(key =>
     <button type="button" key={key} aria-pressed={key === category} onClick={() => setCategory(key)}>
      {tr(categoryLabels[key])}
     </button>)}
   </div>}
   {remaining.length > 0 && <NewsRows items={remaining} formats={formats} now={state.now}/>}
   {!featured && <NewsStatus loading={newsLoading} error={newsError} tr={tr}/>}
  </div>
  {!detail && <div className="nrw-news-controls">
   <ul className="nrw-news-legend" aria-label={tr('Nachrichtenkategorien')}>
    {(Object.keys(categoryLabels) as NewsCategory[]).map(key => <li key={key}><Tag category={key}>{tr(categoryLabels[key])}</Tag></li>)}
   </ul>
   <div className="nrw-news-links">
    {filtered.length > NEWS_PREVIEW_COUNT && <button type="button" aria-controls={listId} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
     {expanded ? tr('Weniger anzeigen') : tr('{count} weitere anzeigen').replace('{count}', formats.number.format(filtered.length - NEWS_PREVIEW_COUNT))}
    </button>}
    <Link to="/region/nrw/news">{tr('Alle Nachrichten')}<ArrowRight size={15} aria-hidden="true"/></Link>
   </div>
  </div>}
 </section>;
}

type DirectoryEntry = { name: string; url: string; description: string };

function DirectoryRows({ entries, tr }: { entries: readonly DirectoryEntry[]; tr: Copy }) {
 return <ul>
  {entries.map(({ name, url, description }) => <li key={url}>
   <a href={url} target="_blank" rel="noopener noreferrer">
    <span className="nrw-bochum-directory-copy">
     <strong>{name}</strong>
     <span>{tr(description)}</span>
    </span>
    <ArrowUpRight size={14} aria-hidden="true"/>
   </a>
  </li>)}
 </ul>;
}

export function BochumNews({ state, language, tr, directory }: {
 state: NewsState;
 language: NewsLocale;
 tr: Copy;
 directory: readonly DirectoryEntry[];
}) {
 const [directoryExpanded, setDirectoryExpanded] = useState(false);
 const extraDirectoryId = useId();
 const items = state.news.filter(item => item.region === 'bochum');
 const sources = Array.from(new Set(items.map(item => item.source)));
 const extra = directory.slice(BOCHUM_DIRECTORY_PREVIEW_COUNT);

 return <section className="nrw-bochum" aria-labelledby="nrw-bochum-title">
  <div className="nrw-bochum-emblem">
   <div className="nrw-bochum-badge"><Landmark size={19} aria-hidden="true"/>{tr('Unsere Stadt')}</div>
  </div>
  <h2 id="nrw-bochum-title">{tr('Schach in Bochum')}</h2>
  {items.length > 0 && <NewsRows items={items.slice(0, 3)} formats={newsDateFormats(language)} now={state.now}/>}
  <section className="nrw-bochum-directory" aria-labelledby="nrw-bochum-directory-title">
   <h3 id="nrw-bochum-directory-title">{tr('Schachleben in Bochum')}</h3>
   <DirectoryRows entries={directory.slice(0, BOCHUM_DIRECTORY_PREVIEW_COUNT)} tr={tr}/>
   {extra.length > 0 && <>
    <button className="nrw-bochum-directory-toggle" type="button" aria-expanded={directoryExpanded}
     aria-controls={extraDirectoryId} onClick={() => setDirectoryExpanded(value => !value)}>
     {directoryExpanded ? tr('Weniger anzeigen') : tr('Alle Seiten ({count})')
      .replace('{count}', newsDateFormats(language).number.format(directory.length))}
     <ChevronDown size={15} aria-hidden="true"/>
    </button>
    <div className="nrw-bochum-directory-extra" id={extraDirectoryId} data-expanded={directoryExpanded} inert={!directoryExpanded}>
     <div><DirectoryRows entries={extra} tr={tr}/></div>
    </div>
   </>}
  </section>
  <div className="nrw-bochum-footer">
   {sources.length > 0 && <span>{new Intl.ListFormat(language === 'ua' ? 'uk' : language).format(sources)}</span>}
   <Link to="/region/nrw/news?region=bochum">{tr('Alle Bochumer Nachrichten')}<ArrowRight size={15} aria-hidden="true"/></Link>
  </div>
 </section>;
}
