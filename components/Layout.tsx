
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppContext } from '../App';
import { UserRole, MenuItem } from '../types';
import { MENU_ITEMS_CONFIG } from '../constants'; // Updated import
import { Bars3Icon, XMarkIcon, UserCircleIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { useLocale } from '../LocaleContext'; // Import useLocale
import { getTranslatedUserRole } from '../locales'; // Import helper
import PohiSvgLogo from './PohiSvgLogo'; // Import the new SVG logo component

const PohiLogo: React.FC = () => (
  <div className="flex items-center text-2xl font-bold">
    <PohiSvgLogo className="h-8 w-8 mr-2" /> {/* Use PohiSvgLogo here */}
    <span className="text-cyan-400">P</span>
    <span className="text-white">ohi AI </span>
    <span className="text-cyan-400">Pro</span>
  </div>
);

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userRole, logout } = useAppContext();
  const { locale, setLocale, t } = useLocale(); // Use locale context
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole) {
      // Translate menu item labels
      const currentMenuItems = MENU_ITEMS_CONFIG[userRole].map(item => ({
        ...item,
        label: t(item.labelKey)
      }));
      setMenu(currentMenuItems);
    }
  }, [userRole, t, locale]); // Add locale to dependency array to re-translate on lang change

  const handleLogout = () => {
    logout();
    navigate('/'); 
  };

  const translatedUserRoleString = userRole ? getTranslatedUserRole(userRole, t) : '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      <header className="bg-slate-800 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <NavLink to="/" className="flex-shrink-0">
                <PohiLogo />
              </NavLink>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                {menu.map((item) => (
                  <NavLink
                    key={item.label} // Label is already translated here
                    to={item.path}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-md text-sm font-medium hover-glow flex items-center ${
                        isActive
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`
                    }
                  >
                    {item.icon && <span className="mr-2">{item.icon}</span>}
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4">
              <span className="text-sm text-slate-400 flex items-center">
                <UserCircleIcon className="h-5 w-5 mr-1 text-cyan-400" />
                {translatedUserRoleString}
              </span>
              <div className="text-sm">
                <button 
                  onClick={() => setLocale('hu')}
                  className={`px-2 py-1 rounded-md ${locale === 'hu' ? 'text-cyan-400 font-semibold' : 'text-slate-300 hover:text-white'}`}
                >
                  HU
                </button>|
                <button 
                  onClick={() => setLocale('en')}
                  className={`px-2 py-1 rounded-md ${locale === 'en' ? 'text-cyan-400 font-semibold' : 'text-slate-300 hover:text-white'}`}
                >
                  EN
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white hover-glow flex items-center"
                title={t('logout')}
              >
                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="-mr-2 flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                type="button"
                className="bg-slate-700 inline-flex items-center justify-center p-2 rounded-md text-cyan-400 hover:text-white hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden" id="mobile-menu">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {menu.map((item) => (
                <NavLink
                  key={item.label}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-base font-medium flex items-center ${
                      isActive
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`
                  }
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="pt-4 pb-3 border-t border-slate-700">
              <div className="flex items-center px-5">
                <UserCircleIcon className="h-8 w-8 mr-2 text-cyan-400" />
                <div>
                  <div className="text-base font-medium leading-none text-white">{translatedUserRoleString}</div>
                </div>
              </div>
              <div className="mt-3 px-2 space-y-1">
                 <div className="text-sm px-3 py-1">
                    <button 
                      onClick={() => { setLocale('hu'); setMobileMenuOpen(false); }}
                      className={`px-1 py-1 rounded-md ${locale === 'hu' ? 'text-cyan-400 font-semibold' : 'text-slate-300 hover:text-white'}`}
                    >
                      HU
                    </button>|
                    <button 
                      onClick={() => { setLocale('en'); setMobileMenuOpen(false); }}
                      className={`px-1 py-1 rounded-md ${locale === 'en' ? 'text-cyan-400 font-semibold' : 'text-slate-300 hover:text-white'}`}
                    >
                      EN
                    </button>
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  {t('logout')}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-slate-800 text-center p-4 text-sm text-slate-400">
        © {new Date().getFullYear()} {t('appName')}. {t('layout_footerPrototype')}
      </footer>
    </div>
  );
};