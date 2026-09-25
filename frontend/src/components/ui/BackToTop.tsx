import { useEffect, useState } from 'react';

/**
 * Round button that brings a long page back to its top, shown once the page
 * has scrolled past about one screen. Dialogs have their own (AppModal).
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      className="page-back-to-top btn btn-light shadow rounded-circle"
      aria-label="Revenir en haut"
      title="Revenir en haut"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <i className="bi bi-arrow-up" aria-hidden="true" />
    </button>
  );
}
