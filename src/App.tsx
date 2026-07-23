import { useState } from 'react';
import SchedulePage from './pages/SchedulePage';
import PipelinePage from './pages/PipelinePage';
import TasksPage from './pages/TasksPage';
import AnalyticsPage from './pages/AnalyticsPage';

type Tab = 'schedule' | 'pipeline' | 'tasks' | 'analytics';

const NAV_ITEMS: { key: Tab; label: string }[] = [
  { key: 'schedule', label: 'Schedule' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'analytics', label: 'Analytics' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [navOpen, setNavOpen] = useState(false);

  function handleNav(key: Tab) {
    setActiveTab(key);
    setNavOpen(false);
  }

  return (
    <div className="app-layout">
      {/* Mobile hamburger */}
      <button className="hamburger" onClick={() => setNavOpen(!navOpen)} aria-label="Toggle navigation">
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>

      <aside className={`sidebar ${navOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header-mobile">
          <div className="sidebar-logo">MANA</div>
          <button className="sidebar-close" onClick={() => setNavOpen(false)}>✕</button>
        </div>
        <div className="sidebar-logo desktop-only">MANA</div>
        <div className="sidebar-subtitle desktop-only">Performance Dashboard</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => handleNav(item.key)}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} />}

      <main className="main-content">
        {activeTab === 'schedule' && <SchedulePage />}
        {activeTab === 'pipeline' && <PipelinePage />}
        {activeTab === 'tasks' && <TasksPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
      </main>
    </div>
  );
}
