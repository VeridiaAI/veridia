import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { WorkoutList } from './components/WorkoutList';
import { Navigation } from './components/Navigation';

function App() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard user={user} onNavigate={setCurrentScreen} />;
      case 'workouts':
        return <WorkoutList user={user} />;
      default:
        return <Dashboard user={user} onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Navigation */}
      <div className="hidden md:block">
        <div className="bg-white shadow-sm border-b border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <Navigation currentScreen={currentScreen} onNavigate={setCurrentScreen} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pb-20 md:pb-0">
        {renderCurrentScreen()}
      </main>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <Navigation currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      </div>
    </div>
  );
}

export default App;