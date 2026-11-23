import { useId, type KeyboardEvent } from 'react';
import { regionLabels, type NewsRegion } from './newsData';

type MapRegion = Exclude<NewsRegion, 'nrw' | 'bochum'>;

// Hand-drawn schematic. Adjacent regions share border vertices.
const regions = [
 { region: 'niederrhein', label: [67, 73], path: 'M45 35 64 32 80 43 96 42 101 57 118 69 109 85 93 87 86 103 68 105 55 93 41 93 33 76 20 71 21 55 34 51Z' },
 { region: 'muensterland', label: [142, 44], path: 'M80 43 89 30 107 25 117 13 139 19 153 10 173 21 192 18 200 29 202 44 185 54 181 68 162 64 152 74 118 69 101 57 96 42Z' },
 { region: 'owl', label: [231, 43], path: 'M192 18 210 21 225 15 235 20 254 16 265 28 282 33 274 48 281 59 266 63 254 75 239 71 222 61 202 44 200 29Z' },
 { region: 'ruhrgebiet', label: [123, 91], path: 'M118 69 152 74 162 64 181 68 178 81 191 91 181 100 157 106 133 105 116 120 98 115 86 103 93 87 109 85Z' },
 { region: 'mittelrhein', label: [99, 140], path: 'M86 103 98 115 116 120 133 105 157 106 152 122 139 132 145 145 128 151 119 164 99 161 89 169 72 154 57 151 64 137 54 129 68 105Z' },
 { region: 'suedwestfalen', label: [213, 121], path: 'M181 68 185 54 202 44 222 61 239 71 254 75 249 88 261 98 258 110 275 120 264 134 245 134 232 151 214 151 200 163 179 151 165 153 145 145 139 132 152 122 157 106 181 100 191 91 178 81Z' },
] as const satisfies readonly { region: MapRegion; label: readonly [number, number]; path: string }[];

type Props = {
 counts: ReadonlyMap<NewsRegion, number>;
 selected: NewsRegion | '';
 onSelect: (region: NewsRegion) => void;
 tr: (key: string) => string;
 number: Intl.NumberFormat;
};

export function RegionMap({ counts, selected, onSelect, tr, number }: Props) {
 const glowId = useId();
 const control = (region: NewsRegion) => {
  const count = counts.get(region) ?? 0;
  const label = tr('{region} · {count} Meldungen')
   .replace('{region}', tr(regionLabels[region])).replace('{count}', number.format(count));

  return {
   role: 'button',
   tabIndex: count > 0 ? 0 : undefined,
   'aria-label': label,
   'aria-disabled': count === 0,
   'aria-pressed': selected === region,
   'data-nrw-map-region': region,
   onClick: count > 0 ? () => onSelect(region) : undefined,
   onKeyDown: count > 0 ? (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) onSelect(region);
   } : undefined,
  } as const;
 };

 return <figure className="nrw-region-map">
  {['tl', 'tr', 'bl', 'br'].map(corner => <span key={corner} className={`nrw-region-map-corner nrw-region-map-corner--${corner}`} aria-hidden="true"/>)}
  <svg viewBox="0 0 300 180" role="group" aria-label={tr('NRW-Regionenkarte')}>
   <defs>
    <radialGradient id={glowId} r="70%">
     <stop offset="45%" stopColor="#3A3328"/>
     <stop offset="100%" stopColor="#4E3D2D"/>
    </radialGradient>
   </defs>
   {regions.map(({ region, label: [x, y], path }) => {
    const regionControl = control(region);
    return <g className="nrw-region-map-area" key={region} {...regionControl}>
     <title>{regionControl['aria-label']}</title>
     <path d={path} style={selected === region ? { fill: `url(#${glowId})` } : undefined}/>
     <text className="nrw-region-map-name" x={x} y={y - 9} aria-hidden="true">
      {region === 'owl' ? 'OWL' : tr(regionLabels[region])}
     </text>
     <rect className="nrw-region-map-count" x={x - 12} y={y - 6} width="24" height="16" rx="8" aria-hidden="true"/>
     <text className="nrw-region-map-count-text" x={x} y={y + 5} aria-hidden="true">
      {number.format(counts.get(region) ?? 0)}
     </text>
    </g>;
   })}
   <g className="nrw-region-map-bochum" {...control('bochum')}>
    <rect x="143" y="79" width="94" height="30" rx="6" className="nrw-region-map-bochum-hit" aria-hidden="true"/>
    <circle cx="155" cy="94" r="9" className="nrw-region-map-ring" aria-hidden="true"/>
    <circle cx="155" cy="94" r="9" className="nrw-region-map-pulse" aria-hidden="true"/>
    <circle cx="155" cy="94" r="5" className="nrw-region-map-dot" aria-hidden="true"/>
    <foreignObject x="168" y="84" width="69" height="20" className="nrw-region-map-bochum-label" aria-hidden="true">
     <span className="nrw-region-map-bochum-pill">{tr('Bochum')}</span>
    </foreignObject>
   </g>
  </svg>
  <figcaption>{tr('Schematische Darstellung')}</figcaption>
 </figure>;
}
