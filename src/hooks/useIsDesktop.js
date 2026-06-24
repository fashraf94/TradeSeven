// src/hooks/useIsDesktop.js
//
// Viewport breakpoint hook — mirrors the App.jsx:2435 desktop split
// (window.innerWidth > 768) so a desktop-only surface can gate on the same line
// the app already uses for DashboardDesktop / the sidebar.

import React from 'react';

export function useIsDesktop(breakpoint = 768) {
  const [isDesktop, setIsDesktop] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth > breakpoint : false,
  );
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setIsDesktop(window.innerWidth > breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isDesktop;
}
