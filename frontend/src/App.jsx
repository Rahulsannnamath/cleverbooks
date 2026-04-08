import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Upload from './components/Upload';
import Settlements from './components/Settlements';
import JobLogs from './components/JobLogs';
import Notifications from './components/Notifications';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  function renderPage() {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'upload':
        return <Upload onUploadComplete={() => {}} />;
      case 'settlements':
        return <Settlements />;
      case 'jobs':
        return <JobLogs />;
      case 'notifications':
        return <Notifications />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a2035',
            color: '#f1f5f9',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#f43f5e', secondary: '#fff' },
          },
        }}
      />
      <div className="app-layout">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="main-content">{renderPage()}</main>
      </div>
    </>
  );
}

export default App;
