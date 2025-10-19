import { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { WorkoutList } from './components/WorkoutList';
import { ProgressScreen } from './components/Progress';
import { LearnScreen } from './components/Learn';
// import { CoachNotes } from './components/CoachNotes';
import { ProfileScreen } from './components/Profile';
import { CoachNotes } from './components/CoachNotes';
import { DataExportImport } from './components/DataExportImport';
import { Navigation } from './components/Navigation';
import { supabase } from './lib/supabase';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { Analyzer } from './components/Analyzer';

function App() {
  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // Use a session-scoped flag to show onboarding only immediately after signup
  const [justSignedUp, setJustSignedUp] = useState<boolean>(() => {
    try { return sessionStorage.getItem('veridia_just_signed_up') === '1'; } catch { return false; }
  });

  useEffect(() => {
    // Refresh flag after auth state changes (e.g., right after signup completes)
    try { setJustSignedUp(sessionStorage.getItem('veridia_just_signed_up') === '1'); } catch {}

    const ensureProfile = async () => {
      if (!user) return;
      setProfileLoading(true);
      try {
        const { data: existing, error: fetchErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (fetchErr && fetchErr.code !== 'PGRST116') {
          // Unexpected fetch error; log and continue to app to avoid hard block
          console.warn('Error fetching profile:', fetchErr);
        }

        let profile = existing || null;

        if (!profile) {
          const { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .insert([
              {
                id: user.id,
                email: user.email || '',
                full_name: user.user_metadata?.full_name || null,
                onboarding_complete: false,
              },
            ])
            .select()
            .single();
          if (!insertErr) profile = inserted;
        }

        const onboardingDone = Boolean(profile?.onboarding_complete);
        // Only show onboarding right after signup
        setNeedsOnboarding(justSignedUp && !onboardingDone);
      } catch (e) {
        console.warn('Error ensuring profile:', e);
      } finally {
        setProfileLoading(false);
      }
    };

    ensureProfile();
  }, [user?.id, justSignedUp]);

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

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparing your experience...</p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return <OnboardingFlow user={user} onComplete={() => { setNeedsOnboarding(false); try { sessionStorage.removeItem('veridia_just_signed_up'); } catch {}; setJustSignedUp(false); } } />;
  }

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
        return <Dashboard user={user} onNavigate={setCurrentScreen} />;
      case 'workouts':
        return <WorkoutList user={user} />;
      case 'progress':
        return <ProgressScreen user={user} />;
      case 'learn':
        return <LearnScreen />;
      case 'analyzer':
        return <Analyzer />;
      case 'notes':
        return <CoachNotes user={user} />;
      case 'profile':
        return <ProfileScreen user={user} onNavigate={setCurrentScreen} />;
      case 'data':
        return <DataExportImport user={user} />;
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