import type { ReactNode } from 'react';
import NavbarComponent from './NavbarComponent';
import { BackToTop } from '../ui';

interface PageLayoutProps {
  children: ReactNode;
}

/**
 * Layout for regular (scrolling) pages: shared navbar plus a content area
 * padded to clear the fixed-top navbar. The map page does not use it because
 * it renders full-screen underneath the navbar.
 */
export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <>
      <NavbarComponent />
      <main className="page-content">{children}</main>
      <BackToTop />
    </>
  );
}
