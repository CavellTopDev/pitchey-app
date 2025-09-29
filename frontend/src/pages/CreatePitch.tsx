import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, X, FileText, Video, Image as ImageIcon, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast/ToastProvider';
import LoadingSpinner from '../components/Loading/LoadingSpinner';
import { pitchService } from '../services/pitch.service';
import { getGenresSync, getFormatsSync } from '../constants/pitchConstants';

interface PitchFormData {
  title: string;
  genre: string;
  format: string;
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
    logline: '',
    shortSynopsis: '',
    image: null,
    pdf: null,
    video: null,
    requireNDA: false
  });

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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'pdf' | 'video') => {
    const file = e.target.files?.[0] || null;
    
    if (file) {
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        error('File too large', `File size must be less than 10MB. Selected file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
        return;
      }
      
      // Validate file type
      const validTypes = {
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        pdf: ['application/pdf'],
        video: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime']
      };
      
      if (!validTypes[fileType].includes(file.type)) {
        error('Invalid file type', `Please select a valid ${fileType} file.`);
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [fileType]: file
    }));
  };

  const removeFile = (fileType: 'image' | 'pdf' | 'video') => {
    setFormData(prev => ({
      ...prev,
      [fileType]: null
    }));
  };

  const validateForm = () => {
    const { title, genre, format, logline, shortSynopsis } = formData;
    const errors: string[] = [];
    
    if (!title.trim()) errors.push('Title is required');
    if (!genre) errors.push('Genre is required');
    if (!format) errors.push('Format is required');
    if (!logline.trim()) errors.push('Logline is required');
    if (!shortSynopsis.trim()) errors.push('Short synopsis is required');
    
    if (errors.length > 0) {
      error('Please fix the following errors:', errors.join(', '));
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
      const pitch = await pitchService.create({
        title: formData.title,
        genre: formData.genre,
        format: formData.format,
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
      success('Pitch created successfully!', 'Your pitch has been created and is ready for review.');
      
      // Navigate to manage pitches or the created pitch
      navigate('/creator/pitches');
    } catch (err: any) {
      console.error('Error creating pitch:', err);
      error('Failed to create pitch', err.message || 'An unexpected error occurred');
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
              onClick={() => navigate('/creator/dashboard')}
              className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create New Pitch</h1>
              <p className="text-sm text-gray-500">Share your creative vision with potential investors</p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your project title"
                  required
                />
              </div>

              <div>
                <label htmlFor="genre" className="block text-sm font-medium text-gray-700 mb-2">
                  Genre *
                </label>
                <select
                  id="genre"
                  name="genre"
                  value={formData.genre}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select a genre</option>
                  {genres && genres.length > 0 ? (
                    genres.map(genre => (
                      <option key={genre} value={genre}>{genre}</option>
                    ))
                  ) : (
                    <>
                      <option value="Action">Action</option>
                      <option value="Comedy">Comedy</option>
                      <option value="Drama">Drama</option>
                      <option value="Horror">Horror</option>
                      <option value="Sci-Fi">Sci-Fi</option>
                      <option value="Thriller">Thriller</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="format" className="block text-sm font-medium text-gray-700 mb-2">
                  Format *
                </label>
                <select
                  id="format"
                  name="format"
                  value={formData.format}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                >
                  <option value="">Select a format</option>
                  {formats && formats.length > 0 ? (
                    formats.map(format => (
                      <option key={format} value={format}>{format}</option>
                    ))
                  ) : (
                    <>
                      <option value="Feature Film">Feature Film</option>
                      <option value="Short Film">Short Film</option>
                      <option value="TV Series">TV Series</option>
                      <option value="Web Series">Web Series</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="logline" className="block text-sm font-medium text-gray-700 mb-2">
                Logline *
              </label>
              <textarea
                id="logline"
                name="logline"
                value={formData.logline}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="A one-sentence summary of your story (max 2-3 sentences)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Keep it concise and compelling - this is what hooks potential investors
              </p>
            </div>

            <div className="mt-6">
              <label htmlFor="shortSynopsis" className="block text-sm font-medium text-gray-700 mb-2">
                Short Synopsis *
              </label>
              <textarea
                id="shortSynopsis"
                name="shortSynopsis"
                value={formData.shortSynopsis}
                onChange={handleInputChange}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Provide a brief overview of your story, main characters, and key plot points (1-2 paragraphs)"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.shortSynopsis.length}/500 characters recommended
              </p>
            </div>
          </div>

          {/* NDA Requirement */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Privacy & Protection</h2>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="requireNDA"
                checked={formData.requireNDA}
                onChange={(e) => setFormData(prev => ({ ...prev, requireNDA: e.target.checked }))}
                className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="requireNDA" className="text-sm text-gray-700">
                <span className="font-medium block">Require NDA Agreement</span>
                <span className="text-gray-500">Viewers must sign a Non-Disclosure Agreement before accessing your full pitch content. This helps protect your intellectual property.</span>
              </label>
            </div>
          </div>

          {/* Media Uploads */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Media & Assets</h2>
            
            {/* Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Image
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                {formData.image ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="w-5 h-5 text-purple-600" />
                      <div>
                        <span className="text-sm font-medium block">{formData.image.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.image.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('image')}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload a compelling cover image</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'image')}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 cursor-pointer transition"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Image
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* PDF Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Script/Treatment (PDF)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                {formData.pdf ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <div>
                        <span className="text-sm font-medium block">{formData.pdf.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.pdf.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('pdf')}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload your script or treatment</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, 'pdf')}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 cursor-pointer transition"
                    >
                      <Upload className="w-4 h-4" />
                      Choose PDF
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Video Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pitch Video (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-500 transition">
                {formData.video ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Video className="w-5 h-5 text-purple-600" />
                      <div>
                        <span className="text-sm font-medium block">{formData.video.name}</span>
                        <span className="text-xs text-gray-500">
                          {(formData.video.size / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('video')}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload a pitch video to make your submission stand out</p>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileChange(e, 'video')}
                      className="hidden"
                      id="video-upload"
                    />
                    <label
                      htmlFor="video-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Video
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/creator/dashboard')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  Creating Pitch...
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