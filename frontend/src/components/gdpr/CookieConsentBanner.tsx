/**
 * GDPR Cookie Consent Banner Component
 * Implements compliant cookie consent collection with granular controls
 */

import React, { useState, useEffect } from 'react';
import { X, Settings, Shield, BarChart, Target, Cookie } from 'lucide-react';

interface ConsentPreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface CookieConsentBannerProps {
  onConsentUpdate: (consents: ConsentPreferences) => void;
  initialConsents?: ConsentPreferences;
  showBanner?: boolean;
}

const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onConsentUpdate,
  initialConsents,
  showBanner = true
}) => {
  const [isVisible, setIsVisible] = useState(showBanner);
  const [showDetails, setShowDetails] = useState(false);
  const [consents, setConsents] = useState<ConsentPreferences>(
    initialConsents || {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false
    }
  );

  const cookieCategories = {
    essential: {
      icon: Shield,
      title: 'Essential Cookies',
      description: 'Required for basic platform functionality including authentication, security, and core features.',
      required: true,
      examples: ['Authentication tokens', 'Security settings', 'Session management']
    },
    functional: {
      icon: Settings,
      title: 'Functional Cookies',
      description: 'Enhance your experience with personalized features like language preferences and dashboard customization.',
      required: false,
      examples: ['Language preferences', 'Theme settings', 'Dashboard layout']
    },
    analytics: {
      icon: BarChart,
      title: 'Analytics Cookies',
      description: 'Help us understand platform usage patterns to improve our services and user experience.',
      required: false,
      examples: ['Page views', 'Feature usage', 'Performance metrics']
    },
    marketing: {
      icon: Target,
      title: 'Marketing Cookies',
      description: 'Enable personalized content and advertising relevant to your interests and platform activity.',
      required: false,
      examples: ['Campaign tracking', 'Social media integration', 'Personalized content']
    }
  };

  useEffect(() => {
    setIsVisible(showBanner);
  }, [showBanner]);

  const handleConsentChange = (category: keyof ConsentPreferences, value: boolean) => {
    const newConsents = { ...consents, [category]: value };
    setConsents(newConsents);
  };

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: true
    };
    setConsents(allAccepted);
    onConsentUpdate(allAccepted);
    setIsVisible(false);
  };

  const handleAcceptSelected = () => {
    onConsentUpdate(consents);
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    const essentialOnly = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false
    };
    setConsents(essentialOnly);
    onConsentUpdate(essentialOnly);
    setIsVisible(false);
  };

  const handleClose = () => {
    // Only allow close if some consent decision has been made
    if (consents.functional || consents.analytics || consents.marketing) {
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" />
      
      {/* Banner */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 max-h-[80vh] overflow-y-auto">
        <div className="container mx-auto px-4 py-6">
          {!showDetails ? (
            /* Simple Banner View */
            <div className="max-w-4xl mx-auto">
              <div className="flex items-start gap-4">
                <Cookie className="h-6 w-6 text-blue-600 mt-1 flex-shrink-0" />
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Cookie Preferences
                  </h3>
                  
                  <p className="text-gray-600 mb-4">
                    We use cookies to enhance your experience on Pitchey. Essential cookies are required for 
                    platform functionality, while optional cookies help us improve our services and provide 
                    personalized features.
                  </p>
                  
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleAcceptAll}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Accept All
                    </button>
                    
                    <button
                      onClick={handleRejectAll}
                      className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Essential Only
                    </button>
                    
                    <button
                      onClick={() => setShowDetails(true)}
                      className="text-blue-600 px-6 py-2 rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      Customize Settings
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-3">
                    By continuing to use this site, you agree to our use of essential cookies. 
                    You can customize your preferences at any time.
                  </p>
                </div>
                
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  disabled={!consents.functional && !consents.analytics && !consents.marketing}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            /* Detailed Settings View */
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Cookie className="h-6 w-6 text-blue-600" />
                  Cookie Preferences
                </h3>
                
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-6">
                {Object.entries(cookieCategories).map(([key, category]) => {
                  const Icon = category.icon;
                  const isChecked = consents[key as keyof ConsentPreferences];
                  
                  return (
                    <div key={key} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Icon className="h-5 w-5 text-gray-600 mt-0.5" />
                          
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">
                              {category.title}
                              {category.required && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded ml-2">
                                  Required
                                </span>
                              )}
                            </h4>
                            
                            <p className="text-sm text-gray-600 mb-3">
                              {category.description}
                            </p>
                            
                            <div className="text-xs text-gray-500">
                              <strong>Examples:</strong> {category.examples.join(', ')}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-shrink-0 ml-4">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleConsentChange(key as keyof ConsentPreferences, e.target.checked)}
                              disabled={category.required}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex flex-wrap gap-3 justify-end">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-600 px-6 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={handleRejectAll}
                    className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Essential Only
                  </button>
                  
                  <button
                    onClick={handleAcceptSelected}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Preferences
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Your preferences will be saved for 13 months. You can change them anytime in your account settings.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CookieConsentBanner;