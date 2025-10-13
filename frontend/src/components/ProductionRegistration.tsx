import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Phone, Globe, MapPin, Hash, AlertCircle, CheckCircle } from 'lucide-react';
import { authAPI } from '../lib/api';
import { validateProductionRegistration } from '../utils/validation';
import { a11y } from '../utils/accessibility';
import { MESSAGES, VALIDATION_MESSAGES, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants/messages';

export default function ProductionRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // Initialize accessibility announcer
  useEffect(() => {
    a11y.announcer.createAnnouncer();
  }, []);
  
  const [formData, setFormData] = useState({
    // Account Info
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    
    // Company Info
    companyName: '',
    registrationNumber: '',
    website: '',
    companyEmail: '',
    companyPhone: '',
    
    // Address
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    
    // Socials (optional)
    linkedin: '',
    twitter: '',
    instagram: '',
    facebook: '',
    
    // Representative Info
    firstName: '',
    lastName: '',
    position: '',
    
    // Terms
    agreeToTerms: false,
    agreeToVetting: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // Real-time validation for touched fields
    if (touched[name]) {
      validateField(name, newValue);
    }
  };
  
  const handleBlur = (fieldName: string) => {
    markFieldTouched(fieldName);
    validateField(fieldName, formData[fieldName as keyof typeof formData]);
  };

  // Real-time field validation
  const validateField = (fieldName: string, value: any) => {
    const result = validateProductionRegistration({ ...formData, [fieldName]: value });
    const errors = result.fieldErrors[fieldName] || [];
    
    setFieldErrors(prev => ({
      ...prev,
      [fieldName]: errors
    }));
    
    return errors.length === 0;
  };
  
  // Mark field as touched
  const markFieldTouched = (fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  };
  
  // Get required fields for current step
  const getStepRequiredFields = (stepNumber: number): string[] => {
    switch(stepNumber) {
      case 1:
        return ['companyName', 'registrationNumber', 'website'];
      case 2:
        return ['companyEmail', 'companyPhone', 'address', 'city', 'state', 'zipCode', 'country'];
      case 3:
        return ['firstName', 'lastName', 'position', 'email', 'username', 'password', 'confirmPassword'];
      case 4:
        return ['agreeToTerms', 'agreeToVetting'];
      default:
        return [];
    }
  };
  
  // Validate current step
  const validateStep = () => {
    const result = validateProductionRegistration(formData);
    const stepFields = getStepRequiredFields(step);
    const stepErrors: string[] = [];
    const stepFieldErrors: Record<string, string[]> = {};
    
    stepFields.forEach(field => {
      if (result.fieldErrors[field]) {
        stepFieldErrors[field] = result.fieldErrors[field];
        stepErrors.push(...result.fieldErrors[field]);
      }
    });
    
    setFieldErrors(prev => ({ ...prev, ...stepFieldErrors }));
    
    if (stepErrors.length > 0) {
      setError(VALIDATION_MESSAGES.FORM_HAS_ERRORS);
      a11y.validation.announceErrors(stepErrors);
      
      // Focus first field with error
      const firstErrorField = stepFields.find(field => stepFieldErrors[field]);
      if (firstErrorField) {
        a11y.focus.focusById(firstErrorField);
      }
      
      return false;
    }
    
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
      a11y.announcer.announce(`Step ${step + 1} of 4: ${getStepTitle(step + 1)}`);
    }
  };
  
  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
      a11y.announcer.announce(`Step ${step - 1} of 4: ${getStepTitle(step - 1)}`);
    } else {
      navigate('/portals');
    }
  };
  
  const getStepTitle = (stepNumber: number): string => {
    switch(stepNumber) {
      case 1: return 'Company Information';
      case 2: return 'Contact Details';
      case 3: return 'Representative Account';
      case 4: return 'Verification & Terms';
      default: return '';
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    
    setLoading(true);
    setError('');
    
    try {
      await authAPI.register({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        userType: 'production',
        companyDetails: {
          companyName: formData.companyName,
          registrationNumber: formData.registrationNumber,
          website: formData.website,
          companyEmail: formData.companyEmail,
          companyPhone: formData.companyPhone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
          socials: {
            linkedin: formData.linkedin,
            twitter: formData.twitter,
            instagram: formData.instagram,
            facebook: formData.facebook
          },
          representative: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            position: formData.position
          }
        }
      });
      
      // Announce success
      a11y.validation.announceSuccess(SUCCESS_MESSAGES.REGISTRATION_SUCCESS);
      
      // Redirect to verification pending page
      navigate('/production/verification-pending');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || ERROR_MESSAGES.UNEXPECTED_ERROR;
      setError(errorMessage);
      a11y.announcer.announce(`Error: ${errorMessage}`, 'assertive');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <Building2 className="w-12 h-12 text-purple-600 mx-auto mb-4" aria-hidden="true" />
            <h1 id="page-title" className="text-3xl font-bold text-gray-900">Production Company Registration</h1>
            <p className="text-gray-600 mt-2">
              Join as a verified production company to access premium features
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-8" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={4} aria-label={`Registration step ${step} of 4`}>
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`flex-1 ${i < 4 ? 'mr-2' : ''}`}
                >
                  <div
                    className={`h-2 rounded-full transition-colors ${
                      i <= step ? 'bg-purple-600' : 'bg-gray-200'
                    }`}
                    aria-hidden="true"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-600">
              <span>Company Info</span>
              <span>Contact Details</span>
              <span>Representative</span>
              <span>Verification</span>
            </div>
            <div className={a11y.classes.srOnly}>
              Current step: {step} of 4 - {getStepTitle(step)}
            </div>
          </div>

          {/* Form Steps */}
          <form noValidate {...a11y.aria.labelledBy('page-title')}>
            <div className="mb-8">
              {step === 1 && (
                <div className="space-y-6">
                  <h2 id="step-1-title" className="text-xl font-semibold text-gray-900 mb-4">Company Information</h2>
                
                <div>
                  <label 
                    {...a11y.formField.getLabelAttributes('companyName', true)}
                  >
                    {MESSAGES.LABELS.COMPANY_NAME}
                  </label>
                  <input
                    {...a11y.formField.getAttributes({
                      id: 'companyName',
                      label: MESSAGES.LABELS.COMPANY_NAME,
                      required: true,
                      invalid: fieldErrors.companyName?.length > 0,
                      errorId: fieldErrors.companyName?.length > 0 ? 'companyName-error' : undefined
                    })}
                    type="text"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('companyName')}
                    placeholder={MESSAGES.PLACEHOLDERS.COMPANY_NAME}
                    className={`w-full px-4 py-2 border rounded-lg transition-colors ${
                      fieldErrors.companyName?.length > 0 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-purple-500'
                    } focus:ring-2 focus:border-transparent ${a11y.classes.focusVisible}`}
                  />
                  {fieldErrors.companyName?.length > 0 && (
                    <div {...a11y.formField.getErrorAttributes('companyName')}>
                      <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                      {fieldErrors.companyName[0]}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Registration Number *
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={handleInputChange}
                      placeholder="123456789"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Your official business registration or tax ID number
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Website *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      placeholder="https://www.yourcompany.com"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Details</h2>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="companyEmail"
                      value={formData.companyEmail}
                      onChange={handleInputChange}
                      placeholder="info@yourcompany.com"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Phone *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      name="companyPhone"
                      value={formData.companyPhone}
                      onChange={handleInputChange}
                      placeholder="+1 (555) 123-4567"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Address *
                  </label>
                  <div className="space-y-3">
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Street Address"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="City"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        placeholder="State/Province"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                        placeholder="ZIP/Postal Code"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        placeholder="Country"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Social Media (Optional)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="url"
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleInputChange}
                      placeholder="LinkedIn URL"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <input
                      type="url"
                      name="twitter"
                      value={formData.twitter}
                      onChange={handleInputChange}
                      placeholder="Twitter/X URL"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Representative Account</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Position/Title *
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleInputChange}
                    placeholder="Head of Development"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <hr className="my-6" />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your.name@company.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="companyname_prod"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Verification & Terms</h2>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-blue-900 mb-1">Verification Process</p>
                      <p className="text-blue-800">
                        Your company information will be verified by our team within 24-48 hours. 
                        This information is strictly for verification purposes and will not be shared 
                        with other users on the platform.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">What Happens Next?</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Verification Review</p>
                        <p className="text-sm text-gray-600">
                          Our team will verify your company information against public records
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Account Activation</p>
                        <p className="text-sm text-gray-600">
                          Once verified, you'll receive full access to production company features
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Enhanced Features</p>
                        <p className="text-sm text-gray-600">
                          Upload pitches, follow creators, request full scripts, and access analytics
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      name="agreeToVetting"
                      checked={formData.agreeToVetting}
                      onChange={handleInputChange}
                      className="mt-1 mr-3"
                    />
                    <span className="text-sm text-gray-700">
                      I understand and agree to the verification process. All information provided 
                      is accurate and I am authorized to represent this company.
                    </span>
                  </label>
                  
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleInputChange}
                      className="mt-1 mr-3"
                    />
                    <span className="text-sm text-gray-700">
                      I agree to the Terms of Service and Privacy Policy
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div 
              role="alert"
              aria-live="assertive"
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <button
              {...a11y.button.getAttributes({
                type: 'button',
                disabled: loading,
                ariaLabel: step === 1 ? 'Cancel registration' : 'Go back to previous step'
              })}
              onClick={handlePrevious}
              className={`px-6 py-2 text-gray-600 hover:text-gray-800 ${a11y.classes.focusVisible} ${loading ? a11y.classes.disabledElement : ''}`}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            
            {step < 4 ? (
              <button
                {...a11y.button.getAttributes({
                  type: 'button',
                  disabled: loading,
                  ariaLabel: `Continue to step ${step + 1}: ${getStepTitle(step + 1)}`
                })}
                onClick={handleNext}
                className={`px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 ${a11y.classes.focusVisible} ${loading ? a11y.classes.disabledElement : ''}`}
              >
                Next
              </button>
            ) : (
              <button
                {...a11y.button.getAttributes({
                  type: 'button',
                  disabled: loading || !formData.agreeToTerms || !formData.agreeToVetting,
                  loading,
                  ariaLabel: loading ? MESSAGES.INFO.SUBMITTING_FORM : 'Submit registration for verification'
                })}
                onClick={handleSubmit}
                className={`px-6 py-2 rounded-lg font-medium ${
                  loading || !formData.agreeToTerms || !formData.agreeToVetting
                    ? `${a11y.classes.disabledElement} bg-gray-300 text-gray-500`
                    : `bg-purple-600 text-white hover:bg-purple-700 ${a11y.classes.focusVisible}`
                }`}
              >
                <span aria-live="polite">
                  {loading ? MESSAGES.INFO.SUBMITTING_FORM : 'Submit for Verification'}
                </span>
              </button>
            )}
          </div>
          </form>
        </div>
      </div>
    </div>
  );
}