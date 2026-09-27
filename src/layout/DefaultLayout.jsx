/**
 * DefaultLayout Component
 *
 * Main application layout wrapper that composes the primary UI structure
 * for authenticated/protected routes.
 *
 * Layout structure:
 * - AppSidebar: Collapsible navigation sidebar
 * - AppHeader: Top navigation bar with user menu and theme switcher
 * - AppContent: Main content area with route rendering
 * - AppFooter: Footer with links and copyright
 *
 * This layout is used for all routes defined in routes.js, providing
 * a consistent structure across the application.
 *
 * @component
 * @example
 * // Used in App.js for protected routes
 * <Route path="*" element={<DefaultLayout />} />
 */

import React from 'react'
import { AppContent, AppSidebar, AppFooter, AppHeader } from '../components/index'
import NotificationToasts from '../components/NotificationToasts'
import WelcomeModal from '../components/WelcomeModal'
import { NotificationProvider } from '../context/NotificationContext'

/**
 * DefaultLayout functional component
 *
 * Renders the main application layout with:
 * - Fixed sidebar navigation
 * - Sticky header
 * - Flexible content area
 * - Footer at bottom
 *
 * Uses flexbox for proper content stretching and footer positioning.
 *
 * @returns {React.ReactElement} Complete application layout
 */
const DefaultLayout = () => {
  return (
    <NotificationProvider>
      <div>
        {/* Primer elemento enfocable del documento: con teclado, saltar la
            navegacion lateral (que son decenas de enlaces) sin tener que
            tabular por ella en cada pagina. Va oculto de verdad con
            clip-path, no con display:none, porque display:none lo saca del
            orden de tabulacion y el enlace se volveria inalcanzable. */}
        <a href="#contenido-principal" className="skip-link">
          Ir al contenido principal
        </a>
        <AppSidebar />
        <div className="wrapper d-flex flex-column min-vh-100">
          <AppHeader />
          <main id="contenido-principal" className="body flex-grow-1" tabIndex={-1}>
            <AppContent />
          </main>
          <AppFooter />
        </div>
        <NotificationToasts />
        <WelcomeModal />
      </div>
    </NotificationProvider>
  )
}

export default DefaultLayout
