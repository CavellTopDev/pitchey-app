import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, FileText, Video, Image as ImageIcon, Shield, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast/ToastProvider';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import { pitchService } from '../services/pitch.service';
import { getGenresSync, getFormatsSync, FALLBACK_GENRES } from '../constants/pitchConstants';
import { validatePitchForm, FormValidator, validationSchemas } from '../utils/validation';
import { a11y } from '../utils/accessibility';
import { MESSAGES, VALIDATION_MESSAGES, SUCCESS_MESSAGES, ERROR_MESSAGES } from '../constants/messages';

interface PitchFormData {
  title: string;
  genre: string;
  format: string;
  formatCategory: string;
  formatSubtype: string;
  customFormat: string;
  logline: string;
  shortSynopsis: string;
  image: File | null;
  pdf: File | null;
  video: File | null;
  requireNDA: boolean;
}

export default function CreatePitch() {
  const navigate = useNavigate();
  const { } = useAuthStore();
  const { success, error } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [genres, setGenres] = useState<string[]>(getGenresSync() || []);
  const [formats, setFormats] = useState<string[]>(getFormatsSync() || []);
  const [formData, setFormData] = useState<PitchFormData>({
    title: '',
    genre: '',
    format: '',
    formatCategory: '',
    formatSubtype: '',
    customFormat: '',
    logline: '',
    shortSynopsis: '',
    image: null,
    pdf: null,
    video: null,
    requireNDA: false
  });
  
  // Form validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  
  // Initialize accessibility announcer
  useEffect(() => {
    a11y.announcer.createAnnouncer();
  }, []);

  // Format categories and their subtypes
  const formatCategories = {
    'Television - Scripted': [
      'Narrative Series (ongoing)',
      'Limited Series (closed-ended)',
      'Soap/Continuing Drama',
      'Anthology Series'
    ],
    'Television - Unscripted': [
      'Documentary One-off',
      'Documentary Series',
      'Docudrama / Hybrid',
      'Reality Series (competition, dating, makeover, Docu-reality)',
      'Game / Quiz Show',
      'Talk / Variety / Sketch Show',
      'Lifestyle / Factual Entertainment'
    ],
    'Film': [
      'Feature Narrative (live action)',
      'Feature Documentary',
      'Feature Animation',
      'Anthology / Omnibus Film',
      'Short Film / Short Documentary'
    ],
    'Animation (Series)': [
      'Kids Series',
      'Adult Series',
      'Limited Series / Specials'
    ],
    'Audio': [
      'Podcast - Drama (scripted fiction)',
      'Podcast - Documentary (non-fiction)',
      'Podcast - Hybrid / Docudrama'
    ],
    'Digital / Emerging': [
      'Web Series / Digital-first Series',
      'Interactive / Immersive (VR/AR, choose-your-own path)'
    ],
    'Stage-to-Screen': [
      'Recorded Theatre',
      'Comedy Specials',
      'Performance Hybrids'
    ],
    'Other': [
      'Custom Format (please specify)'
    ]
  };

  // Load configuration from API on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { getGenres, getFormats } = await import('../constants/pitchConstants');
        const [genresData, formatsData] = await Promise.all([
          getGenres(),
          getFormats()
        ]);
        setGenres(genresData);
        setFormats(formatsData);
      } catch (err) {
        console.warn('Failed to load configuration, using fallback:', err);
        // Already using sync fallback values
      }
    };
    loadConfig();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Real-time validation for touched fields
    if (touched[name]) {
      validateField(name, value);
    }
  };
  
  const handleBlur = (fieldName: string) => {
    markFieldTouched(fieldName);
    validateField(fieldName, formData[fieldName as keyof PitchFormData]);
  };

  const handleFormatCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    const newFormData = {
      ...formData,
      formatCategory: category,
      formatSubtype: '', // Reset subtype when category changes
      customFormat: '', // Reset custom format
      format: category // Set the main format to the category
    };
    setFormData(newFormData);
    
    // Mark field as touched and validate with the new value
    markFieldTouched('formatCategory');
    validateField('formatCategory', category);
    
    // Clear errors for formatSubtype since we're resetting it
    setFieldErrors(prev => ({ ...prev, formatSubtype: [] }));
  };

  const handleFormatSubtypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subtype = e.target.value;
    const newFormData = {
      ...formData,
      formatSubtype: subtype,
      format: subtype === 'Custom Format (please specify)' ? 'Custom' : subtype
    };
    setFormData(newFormData);
    
    // Mark field as touched and validate with the new value
    markFieldTouched('formatSubtype');
    validateField('formatSubtype', subtype);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'pdf' | 'video') => {
    const file = e.target.files?.[0] || null;
    
    // Clear previous errors for this field
    setFieldErrors(prev => ({ ...prev, [fileType]: [] }));
    
    if (file) {
      // Validate using centralized validation
      const isValid = validateField(fileType, file);
      
      if (!isValid) {
        // Announce file error
        const errorMsg = fieldErrors[fileType]?.[0] || 'Invalid file';
        a11y.validation.announceFieldError(fileType, errorMsg);
        return;
      }
      
      // Announce successful file selection
      a11y.announcer.announce(MESSAGES.A11Y.FILE_SELECTED(file.name));
    }
    
    setFormData(prev => ({
      ...prev,
      [fileType]: file
    }));
    
    markFieldTouched(fileType);
  };

  const removeFile = (fileType: 'image' | 'pdf' | 'video') => {
    setFormData(prev => ({
      ...prev,
      [fileType]: null
    }));
    
    // Clear errors for this field
    setFieldErrors(prev => ({ ...prev, [fileType]: [] }));
    
    // Announce file removal
    a11y.announcer.announce(MESSAGES.A11Y.FILE_REMOVED);
  };

  // Real-time field validation
  const validateField = (fieldName: string, value: any) => {
    const result = validatePitchForm({ ...formData, [fieldName]: value });
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
  
  // Validate entire form
  const validateForm = () => {
    const result = validatePitchForm(formData);
    setFieldErrors(result.fieldErrors);
    
    if (!result.isValid) {
      // Announce errors to screen readers
      a11y.validation.announceErrors(result.errors);
      
      // Focus first field with error
      const firstErrorField = Object.keys(result.fieldErrors)[0];
      if (firstErrorField) {
        a11y.focus.focusById(firstErrorField);
      }
      
      error(VALIDATION_MESSAGES.FORM_HAS_ERRORS, result.errors.join(', '));
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the new pitch service
      const finalFormat = formData.formatSubtype === 'Custom Format (please specify)' 
        ? formData.customFormat 
        : formData.formatSubtype || formData.formatCategory;
        
      const pitch = await pitchService.create({
        title: formData.title,
        genre: formData.genre,
        format: finalFormat,
        logline: formData.logline,
        shortSynopsis: formData.shortSynopsis,
        requireNDA: formData.requireNDA,
        budgetBracket: 'Medium',
        estimatedBudget: 1000000,
        productionTimeline: '6-12 months',
        themes: [],
        characters: [],
        aiUsed: false
      });

      console.log('Pitch created successfully:', pitch);
      
      // Announce success to screen readers
      a11y.validation.announceSuccess(SUCCESS_MESSAGES.PITCH_CREATED);
      
      success(SUCCESS_MESSAGES.PITCH_CREATED, 'Your pitch has been created and is ready for review.');
      
      // Navigate to manage pitches or the created pitch
      navigate('/creator/pitches');
    } catch (err: any) {
      console.error('Error creating pitch:', err);
      const errorMessage = err.message || ERROR_MESSAGES.UNEXPECTED_ERROR;
      
      // Announce error to screen readers
      a11y.announcer.announce(`Error: ${errorMessage}`, 'assertive');
      
      error('Failed to create pitch', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              {...a11y.button.getAttributes({
                type: 'button',
                ariaLabel: 'Go back to creator dashboard'
              })}
              onClick={() => navigate('/creator/dashboard')}
              className={`p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100 ${a11y.classes.focusVisible}`}
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <h1 id="page-title" className="text-2xl font-bold text-gray-900">Create New Pitch</h1>
              <p className="text-sm text-gray-500">Share your creative vision with potential investors</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          className="space-y-8"
          noValidate
          {...a11y.aria.labelledBy('page-title')}
        >
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label 
                  {...a11y.formField.getLabelAttributes('title', true)}
                >
                  {MESSAGES.LABELS.TITLE}
                </label>
                <input
                  {...a11y.formField.getAttributes({
                    id: 'title',
                    label: MESSAGES.LABELS.TITLE,
                    required: true,
                    invalid: fieldErrors.title?.length > 0,
                    errorId: fieldErrors.title?.length > 0 ? 'title-error' : undefined
                  })}
                  type="text"
                  value={formData.title}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('title')}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    fieldErrors.title?.length > 0 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                  placeholder={MESSAGES.PLACEHOLDERS.TITLE}
                />
                {fieldErrors.title?.length > 0 && (
                  <div {...a11y.formField.getErrorAttributes('title')}>
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {fieldErrors.title[0]}
                  </div>
                )}
              </div>

              <div>
                <label 
                  {...a11y.formField.getLabelAttributes('genre', true)}
                >
                  {MESSAGES.LABELS.GENRE}
                </label>
                <select
                  {...a11y.formField.getAttributes({
                    id: 'genre',
                    label: MESSAGES.LABELS.GENRE,
                    required: true,
                    invalid: fieldErrors.genre?.length > 0,
                    errorId: fieldErrors.genre?.length > 0 ? 'genre-error' : undefined
                  })}
                  value={formData.genre}
                  onChange={handleInputChange}
                  onBlur={() => handleBlur('genre')}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    fieldErrors.genre?.length > 0 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                >
                  <option value="">Select a genre</option>
                  {(genres && genres.length > 0 ? genres : FALLBACK_GENRES).map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
                {fieldErrors.genre?.length > 0 && (
                  <div {...a11y.formField.getErrorAttributes('genre')}>
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {fieldErrors.genre[0]}
                  </div>
                )}
              </div>

              <div>
                <label 
                  {...a11y.formField.getLabelAttributes('formatCategory', true)}
                >
                  {MESSAGES.LABELS.FORMAT_CATEGORY}
                </label>
                <select
                  {...a11y.formField.getAttributes({
                    id: 'formatCategory',
                    label: MESSAGES.LABELS.FORMAT_CATEGORY,
                    required: true,
                    invalid: fieldErrors.formatCategory?.length > 0,
                    errorId: fieldErrors.formatCategory?.length > 0 ? 'formatCategory-error' : undefined
                  })}
                  value={formData.formatCategory}
                  onChange={handleFormatCategoryChange}
                  className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                    fieldErrors.formatCategory?.length > 0 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-purple-500'
                  } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                >
                  <option value="">Select a format category</option>
                  {Object.keys(formatCategories).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                {fieldErrors.formatCategory?.length > 0 && (
                  <div {...a11y.formField.getErrorAttributes('formatCategory')}>
                    <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    {fieldErrors.formatCategory[0]}
                  </div>
                )}
              </div>

              {formData.formatCategory && (
                <div>
                  <label 
                    {...a11y.formField.getLabelAttributes('formatSubtype', true)}
                  >
                    {MESSAGES.LABELS.FORMAT_SUBTYPE}
                  </label>
                  <select
                    {...a11y.formField.getAttributes({
                      id: 'formatSubtype',
                      label: MESSAGES.LABELS.FORMAT_SUBTYPE,
                      required: true,
                      invalid: fieldErrors.formatSubtype?.length > 0,
                      errorId: fieldErrors.formatSubtype?.length > 0 ? 'formatSubtype-error' : undefined
                    })}
                    value={formData.formatSubtype}
                    onChange={handleFormatSubtypeChange}
                    className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                      fieldErrors.formatSubtype?.length > 0 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-purple-500'
                    } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                  >
                    <option value="">Select a format subtype</option>
                    {formatCategories[formData.formatCategory as keyof typeof formatCategories]?.map(subtype => (
                      <option key={subtype} value={subtype}>{subtype}</option>
                    ))}
                  </select>
                  {fieldErrors.formatSubtype?.length > 0 && (
                    <div {...a11y.formField.getErrorAttributes('formatSubtype')}>
                      <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                      {fieldErrors.formatSubtype[0]}
                    </div>
                  )}
                </div>
              )}

              {formData.formatSubtype === 'Custom Format (please specify)' && (
                <div>
                  <label 
                    {...a11y.formField.getLabelAttributes('customFormat', true)}
                  >
                    {MESSAGES.LABELS.CUSTOM_FORMAT}
                  </label>
                  <input
                    {...a11y.formField.getAttributes({
                      id: 'customFormat',
                      label: MESSAGES.LABELS.CUSTOM_FORMAT,
                      required: true,
                      invalid: fieldErrors.customFormat?.length > 0,
                      errorId: fieldErrors.customFormat?.length > 0 ? 'customFormat-error' : undefined
                    })}
                    type="text"
                    value={formData.customFormat}
                    onChange={handleInputChange}
                    onBlur={() => handleBlur('customFormat')}
                    className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                      fieldErrors.customFormat?.length > 0 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-purple-500'
                    } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                    placeholder={MESSAGES.PLACEHOLDERS.CUSTOM_FORMAT}
                  />
                  {fieldErrors.customFormat?.length > 0 && (
                    <div {...a11y.formField.getErrorAttributes('customFormat')}>
                      <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                      {fieldErrors.customFormat[0]}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <label 
                {...a11y.formField.getLabelAttributes('logline', true)}
              >
                {MESSAGES.LABELS.LOGLINE}
              </label>
              <textarea
                {...a11y.formField.getAttributes({
                  id: 'logline',
                  label: MESSAGES.LABELS.LOGLINE,
                  required: true,
                  invalid: fieldErrors.logline?.length > 0,
                  errorId: fieldErrors.logline?.length > 0 ? 'logline-error' : undefined,
                  helpId: 'logline-help'
                })}
                value={formData.logline}
                onChange={handleInputChange}
                onBlur={() => handleBlur('logline')}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                  fieldErrors.logline?.length > 0 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                placeholder={MESSAGES.PLACEHOLDERS.LOGLINE}
              />
              {fieldErrors.logline?.length > 0 && (
                <div {...a11y.formField.getErrorAttributes('logline')}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.logline[0]}
                </div>
              )}
              <p {...a11y.formField.getHelpAttributes('logline')}>
                Keep it concise and compelling - this is what hooks potential investors
              </p>
            </div>

            <div className="mt-6">
              <label 
                {...a11y.formField.getLabelAttributes('shortSynopsis', true)}
              >
                {MESSAGES.LABELS.SHORT_SYNOPSIS}
              </label>
              <textarea
                {...a11y.formField.getAttributes({
                  id: 'shortSynopsis',
                  label: MESSAGES.LABELS.SHORT_SYNOPSIS,
                  required: true,
                  invalid: fieldErrors.shortSynopsis?.length > 0,
                  errorId: fieldErrors.shortSynopsis?.length > 0 ? 'shortSynopsis-error' : undefined,
                  helpId: 'shortSynopsis-help'
                })}
                value={formData.shortSynopsis}
                onChange={handleInputChange}
                onBlur={() => handleBlur('shortSynopsis')}
                rows={6}
                className={`w-full px-3 py-2 border rounded-lg transition-colors ${
                  fieldErrors.shortSynopsis?.length > 0 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-purple-500'
                } focus:outline-none focus:ring-2 ${a11y.classes.focusVisible}`}
                placeholder={MESSAGES.PLACEHOLDERS.SYNOPSIS}
              />
              {fieldErrors.shortSynopsis?.length > 0 && (
                <div {...a11y.formField.getErrorAttributes('shortSynopsis')}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.shortSynopsis[0]}
                </div>
              )}
              <p {...a11y.formField.getHelpAttributes('shortSynopsis')}>
                {MESSAGES.INFO.CHARACTER_COUNT(formData.shortSynopsis.length, 1000)} | {MESSAGES.INFO.RECOMMENDED_LENGTH(formData.shortSynopsis.length, 500)}
              </p>
            </div>
          </div>

          {/* NDA Requirement */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Privacy & Protection</h2>
            <div className="flex items-start gap-3">
              <input
                {...a11y.formField.getAttributes({
                  id: 'requireNDA',
                  label: 'NDA Requirement',
                  required: false,
                  helpId: 'requireNDA-help'
                })}
                type="checkbox"
                checked={formData.requireNDA}
                onChange={(e) => setFormData(prev => ({ ...prev, requireNDA: e.target.checked }))}
                className={`mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 ${a11y.classes.focusVisible}`}
              />
              <label htmlFor="requireNDA" className="text-sm text-gray-700">
                <span className="font-medium block">{MESSAGES.LABELS.REQUIRE_NDA}</span>
                <span id="requireNDA-help" className="text-gray-500">{MESSAGES.INFO.NDA_PROTECTION}</span>
              </label>
            </div>
          </div>

          {/* Media Uploads */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Media & Assets</h2>
            
            {/* Image Upload */}
            <div className="mb-6">
              <label 
                id="image-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {MESSAGES.LABELS.COVER_IMAGE}
              </label>
              <div 
                {...a11y.fileUpload.getDropZoneAttributes({
                  disabled: isSubmitting,
                  labelId: 'image-label'
                })}
                onClick={() => document.getElementById('image-upload')?.click()}
                onKeyDown={a11y.keyboard.onActivate(() => document.getElementById('image-upload')?.click())}
              >
                {formData.image ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <div>
                        <span className="text-sm font-medium block">{formData.image.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.image.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      {...a11y.button.getAttributes({
                        type: 'button',
                        disabled: isSubmitting,
                        ariaLabel: MESSAGES.A11Y.REMOVE_FILE_BUTTON
                      })}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile('image');
                      }}
                      className={`text-red-500 hover:text-red-700 transition-colors p-1 rounded ${a11y.classes.focusVisible}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-600 mb-2">{MESSAGES.INFO.IMAGE_UPLOAD_INSTRUCTIONS}</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Choose Image
                    </div>
                  </div>
                )}
              </div>
              <input
                {...a11y.fileUpload.getInputAttributes({
                  id: 'image-upload',
                  accept: 'image/*',
                  disabled: isSubmitting
                })}
                onChange={(e) => handleFileChange(e, 'image')}
              />
              <div id="image-upload-instructions" className={a11y.classes.srOnly}>
                {MESSAGES.A11Y.FILE_UPLOAD_INSTRUCTIONS}
              </div>
              {fieldErrors.image?.length > 0 && (
                <div {...a11y.formField.getErrorAttributes('image')}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.image[0]}
                </div>
              )}
            </div>

            {/* PDF Upload */}
            <div className="mb-6">
              <label 
                id="pdf-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {MESSAGES.LABELS.SCRIPT_PDF}
              </label>
              <div 
                {...a11y.fileUpload.getDropZoneAttributes({
                  disabled: isSubmitting,
                  labelId: 'pdf-label'
                })}
                onClick={() => document.getElementById('pdf-upload')?.click()}
                onKeyDown={a11y.keyboard.onActivate(() => document.getElementById('pdf-upload')?.click())}
              >
                {formData.pdf ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <div>
                        <span className="text-sm font-medium block">{formData.pdf.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.pdf.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      {...a11y.button.getAttributes({
                        type: 'button',
                        disabled: isSubmitting,
                        ariaLabel: MESSAGES.A11Y.REMOVE_FILE_BUTTON
                      })}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile('pdf');
                      }}
                      className={`text-red-500 hover:text-red-700 transition-colors p-1 rounded ${a11y.classes.focusVisible}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-600 mb-2">{MESSAGES.INFO.PDF_UPLOAD_INSTRUCTIONS}</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Choose PDF
                    </div>
                  </div>
                )}
              </div>
              <input
                {...a11y.fileUpload.getInputAttributes({
                  id: 'pdf-upload',
                  accept: '.pdf',
                  disabled: isSubmitting
                })}
                onChange={(e) => handleFileChange(e, 'pdf')}
              />
              <div id="pdf-upload-instructions" className={a11y.classes.srOnly}>
                {MESSAGES.A11Y.FILE_UPLOAD_INSTRUCTIONS}
              </div>
              {fieldErrors.pdf?.length > 0 && (
                <div {...a11y.formField.getErrorAttributes('pdf')}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.pdf[0]}
                </div>
              )}
            </div>

            {/* Video Upload */}
            <div>
              <label 
                id="video-label"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                {MESSAGES.LABELS.PITCH_VIDEO} ({MESSAGES.INFO.OPTIONAL_FIELD})
              </label>
              <div 
                {...a11y.fileUpload.getDropZoneAttributes({
                  disabled: isSubmitting,
                  labelId: 'video-label'
                })}
                onClick={() => document.getElementById('video-upload')?.click()}
                onKeyDown={a11y.keyboard.onActivate(() => document.getElementById('video-upload')?.click())}
              >
                {formData.video ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Video className="w-5 h-5 text-purple-600" aria-hidden="true" />
                      <div>
                        <span className="text-sm font-medium block">{formData.video.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.video.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      {...a11y.button.getAttributes({
                        type: 'button',
                        disabled: isSubmitting,
                        ariaLabel: MESSAGES.A11Y.REMOVE_FILE_BUTTON
                      })}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile('video');
                      }}
                      className={`text-red-500 hover:text-red-700 transition-colors p-1 rounded ${a11y.classes.focusVisible}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" aria-hidden="true" />
                    <p className="text-sm text-gray-600 mb-2">{MESSAGES.INFO.VIDEO_UPLOAD_INSTRUCTIONS}</p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Choose Video
                    </div>
                  </div>
                )}
              </div>
              <input
                {...a11y.fileUpload.getInputAttributes({
                  id: 'video-upload',
                  accept: 'video/*',
                  disabled: isSubmitting
                })}
                onChange={(e) => handleFileChange(e, 'video')}
              />
              <div id="video-upload-instructions" className={a11y.classes.srOnly}>
                {MESSAGES.A11Y.FILE_UPLOAD_INSTRUCTIONS}
              </div>
              {fieldErrors.video?.length > 0 && (
                <div {...a11y.formField.getErrorAttributes('video')}>
                  <AlertCircle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  {fieldErrors.video[0]}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              {...a11y.button.getAttributes({
                type: 'button',
                disabled: isSubmitting,
                ariaLabel: MESSAGES.A11Y.CANCEL_BUTTON
              })}
              onClick={() => navigate('/creator/dashboard')}
              className={`px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition ${a11y.classes.focusVisible} ${isSubmitting ? a11y.classes.disabledElement : ''}`}
            >
              Cancel
            </button>
            <button
              {...a11y.button.getAttributes({
                type: 'submit',
                disabled: isSubmitting,
                loading: isSubmitting,
                ariaLabel: isSubmitting ? MESSAGES.INFO.CREATING_PITCH : MESSAGES.A11Y.SUBMIT_BUTTON
              })}
              className={`px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2 ${a11y.classes.focusVisible} ${isSubmitting ? a11y.classes.disabledElement : ''}`}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" color="white" aria-hidden="true" />
                  <span aria-live="polite">{MESSAGES.INFO.CREATING_PITCH}</span>
                </>
              ) : (
                'Create Pitch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}