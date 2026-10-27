import type { SVGProps } from 'react';

// ChessAZ brand king: a distinct cross, flared crown, slender stem and rounded base.
// Metallic silver dominates; champagne-gold is limited to narrow edge highlights.
export default function ChessKingMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 56 86"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient id="chessaz-king-metal" x1="7" y1="46" x2="49" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3E4D5A" />
          <stop offset=".22" stopColor="#C7D0D8" />
          <stop offset=".44" stopColor="#FAF8F3" />
          <stop offset=".65" stopColor="#87949F" />
          <stop offset=".87" stopColor="#D2C3AB" />
          <stop offset="1" stopColor="#84705A" />
        </linearGradient>
        <linearGradient id="chessaz-king-champagne" x1="16" y1="5" x2="39" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D1DCE6" />
          <stop offset=".42" stopColor="#F2EEE5" />
          <stop offset=".83" stopColor="#B7A080" />
          <stop offset="1" stopColor="#7A6654" />
        </linearGradient>
        <linearGradient id="chessaz-king-base" x1="7" y1="70" x2="49" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#586978" />
          <stop offset=".31" stopColor="#E4EDF2" />
          <stop offset=".61" stopColor="#8D9BA9" />
          <stop offset=".83" stopColor="#D8BC8E" />
          <stop offset="1" stopColor="#514E4D" />
        </linearGradient>
      </defs>
      <path
        d="M25 3.5h6v8h8v6h-8v8h-6v-8h-8v-6h8v-8Z"
        fill="url(#chessaz-king-champagne)" stroke="#D6DCE0" strokeWidth=".9" strokeLinejoin="round"
      />
      <path d="M19 29Q23 25 28 29Q33 25 37 29Q43 26 49 30L43 43H13L7 30Q13 26 19 29Z"
        fill="url(#chessaz-king-metal)" stroke="#B5C0C8" strokeWidth="1.2" strokeLinejoin="round"
      />
      <path d="M11 30Q15 28 19 31M37 31Q42 28 46 30" stroke="#F4E6C9" strokeWidth="1" strokeLinecap="round" opacity=".75" />
      <path d="M14 43H42L40 47H16L14 43Z" fill="url(#chessaz-king-base)" stroke="#B6C0CA" strokeWidth=".8" />
      <rect x="16" y="47" width="24" height="4" rx="2" fill="url(#chessaz-king-champagne)" />
      <path d="M22 51H34L37.5 65Q38.5 69 43 71H13Q17.5 69 18.5 65L22 51Z"
        fill="url(#chessaz-king-metal)" stroke="#A1ACB8" strokeWidth="1" />
      <path d="M24 54L21 65" stroke="#F8FAF9" strokeWidth="1.5" strokeLinecap="round" opacity=".66" />
      <path d="M13 70H43L47 74Q48 76 46 77H10Q8 76 9 74L13 70Z"
        fill="url(#chessaz-king-base)" stroke="#B9C4CD" strokeWidth="1" />
      <path d="M10 76Q7 77 7 80Q7 82 11 82H45Q49 82 49 80Q49 77 46 76H10Z"
        fill="url(#chessaz-king-metal)" stroke="#D2C1A9" strokeWidth="1.1" />
      <path d="M11 79H45" stroke="#F5E6CB" strokeWidth=".8" opacity=".8" />
    </svg>
  );
}
