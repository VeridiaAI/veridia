//
import { useAuth } from '../hooks/useAuth';
import { Home, Dumbbell, User, LineChart, BookOpen, Notebook, LogOut, ActivitySquare } from 'lucide-react';

interface NavigationProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export function Navigation({ currentScreen, onNavigate }: NavigationProps) {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = [
    { key: 'dashboard', label: 'Home', icon: Home },
    { key: 'workouts', label: 'Workouts', icon: Dumbbell },
    { key: 'progress', label: 'Progress', icon: LineChart },
    { key: 'learn', label: 'Learn', icon: BookOpen },
    { key: 'analyzer', label: 'Analyzer', icon: ActivitySquare },
    { key: 'notes', label: 'Notes', icon: Notebook },
    { key: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 md:relative md:border-t-0 md:bg-transparent md:px-0 md:py-0">
      <div className="flex items-center justify-around md:justify-start md:gap-6 max-w-4xl mx-auto">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = currentScreen === item.key;
          
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 px-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <IconComponent className="w-5 h-5" />
              <span className="text-xs md:text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
        
        <button
          onClick={handleSignOut}
          className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 px-3 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 md:ml-auto"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-xs md:text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </nav>
  );
}