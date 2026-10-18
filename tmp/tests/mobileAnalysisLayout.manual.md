# Mobile Analysis: one screen, no page scrolling or menu overlap

Regression: on a short mobile viewport, the four move controls overlapped the
fixed bottom navigation. Tapping them could leave Analysis for another route.
A first fix introduced page scrolling and hid either the header or controls.

Use the PR Preview in a browser; start with viewport sizes 360x640, 393x727,
393x852, 430x932, and landscape 844x390 (CSS pixels).
The one-screen mobile checks apply below 768px; at 844px verify that the
existing desktop/tablet breakpoint is unchanged.

1. Open `/game` and play e4, e5, Nf3 so all history controls can be exercised.
2. In Analysis, confirm that the header, two engine lines, square board,
   entire four-button row and site menu are visible simultaneously. Swiping
   the page up/down must not move the header or hide the controls. There must
   be a clear gap above the menu; the board fits the remaining height.
3. Tap the centre and lower edge of each control. First/previous/next/last
   must change the reviewed position and must keep the route at `/game`.
4. Repeat in Moves, with a long move list, and while reviewing an older move
   (the resume banner adds height above the board).
5. Repeat with browser text scaling at 125% and 150%, browser address bar
   expanded/collapsed, and after rotating the phone. Oversized content must
   fit within the viewport, with the square board adapting to the remaining
   space. Neither page scrolling nor menu overlap may reappear. The long move
   list may scroll inside its own panel; engine variations may scroll sideways.
6. On a device/emulator with a bottom safe-area inset, confirm that the menu
   remains above the system gesture area and the controls remain above it.
7. Tap each site-menu link deliberately: navigation must still work. Return
   to Analysis and verify that history is restored as before.
8. At widths 768, 1024, and 1440 pixels, compare with the parent Preview:
   desktop/tablet board, panel, sidebar and scrolling must remain unchanged.
9. Check `/home`, `/play`, `/profile`, and `/settings` on mobile: their
   existing layout must remain unchanged.

The current Node test suite has no browser layout/hit-testing infrastructure.
Its passing result does not verify these geometry and touch-target checks.
