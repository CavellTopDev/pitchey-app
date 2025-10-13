import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X, Upload, FileText, Video, Image as ImageIcon } from 'lucide-react';
import { pitchService } from '../services/pitch.service';
import type { Pitch, UpdatePitchInput } from '../services/pitch.service';
import { getGenresSync } from '../constants/pitchConstants';

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
}

export default function PitchEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genres] = useState<string[]>(getGenresSync());
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
    video: null
  });

  const formatCategories: Record<string, string[]> = {
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

  useEffect(() => {
    if (id) {
      fetchPitch(parseInt(id));
    }
  }, [id]);

  const fetchPitch = async (pitchId: number) => {
    try {
      // Fetch all creator pitches and find the one with matching ID
      const pitches = await pitchService.getMyPitches();
      const pitch = pitches.find(p => p.id === pitchId);
      
      if (!pitch) {
        throw new Error('Pitch not found');
      }
      
      setFormData({
        title: pitch.title || '',
        genre: pitch.genre || '',
        format: pitch.format || '',
        formatCategory: pitch.formatCategory || '',
        formatSubtype: pitch.formatSubtype || '',
        customFormat: pitch.customFormat || '',
        logline: pitch.logline || '',
        shortSynopsis: pitch.shortSynopsis || '',
        image: null,
        pdf: null,
        video: null
      });
    } catch (error) {
      console.error('Failed to fetch pitch:', error);
      setError('Failed to load pitch');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFormatCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const category = e.target.value;
    setFormData(prev => ({
      ...prev,
      formatCategory: category,
      formatSubtype: '', // Reset subtype when category changes
      customFormat: '', // Reset custom format
      format: category // Set the main format to the category
    }));
  };

  const handleFormatSubtypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subtype = e.target.value;
    setFormData(prev => ({
      ...prev,
      formatSubtype: subtype,
      format: subtype === 'Custom Format (please specify)' ? 'Custom' : subtype
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'pdf' | 'video') => {
    const file = e.target.files?.[0] || null;
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
    const { title, genre, format, formatCategory, formatSubtype, customFormat, logline, shortSynopsis } = formData;
    const isCustomFormat = formatSubtype === 'Custom Format (please specify)';
    const isFormatValid = formatCategory && formatSubtype && (!isCustomFormat || customFormat.trim());
    return title.trim() && genre && format && isFormatValid && logline.trim() && shortSynopsis.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const updateData: UpdatePitchInput = {
        title: formData.title,
        genre: formData.genre,
        format: formData.format,
        formatCategory: formData.formatCategory,
        formatSubtype: formData.formatSubtype,
        customFormat: formData.customFormat,
        logline: formData.logline,
        shortSynopsis: formData.shortSynopsis
      };

      // Skip file uploads for now - media upload endpoint not yet implemented
      // TODO: Implement media upload endpoint in backend
      if (formData.image || formData.pdf || formData.video) {
        console.log('Media files selected but upload not yet implemented');
        // Comment out media upload to prevent errors
        /*
        const media: string[] = [];
        
        if (formData.image) {
          const imageUrl = await pitchService.uploadMedia(parseInt(id!), formData.image, 'image');
          media.push(imageUrl);
        }
        if (formData.pdf) {
          const pdfUrl = await pitchService.uploadMedia(parseInt(id!), formData.pdf, 'document');
          media.push(pdfUrl);
        }
        if (formData.video) {
          const videoUrl = await pitchService.uploadMedia(parseInt(id!), formData.video, 'video');
          media.push(videoUrl);
        }
        
        if (media.length > 0) {
          updateData.additionalMedia = media;
        }
        */
      }

      await pitchService.update(parseInt(id!), updateData);
      console.log('Pitch updated successfully');
      navigate('/creator/pitches');
    } catch (error) {
      console.error('Error updating pitch:', error);
      alert(error instanceof Error ? error.message : 'Failed to update pitch');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/creator/pitches')}
                className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Error</h1>
            </div>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => navigate('/creator/pitches')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Back to Pitches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/creator/pitches')}
              className="p-2 text-gray-500 hover:text-gray-700 transition rounded-lg hover:bg-gray-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Pitch</h1>
              <p className="text-sm text-gray-500">Update your pitch information</p>
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
                  {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="formatCategory" className="block text-sm font-medium text-gray-700 mb-2">
                  Format Category *
                </label>
                <select
                  id="formatCategory"
                  name="formatCategory"
                  value={formData.formatCategory}
                  onChange={handleFormatCategoryChange}
                  aria-required="true"
                  required
                  className="w-full px-3 py-2 border rounded-lg transition-colors border-gray-300 focus:ring-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  <option value="">Select a format category</option>
                  {Object.keys(formatCategories).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {formData.formatCategory && (
                <div>
                  <label htmlFor="formatSubtype" className="block text-sm font-medium text-gray-700 mb-2">
                    Format Subtype *
                  </label>
                  <select
                    id="formatSubtype"
                    name="formatSubtype"
                    value={formData.formatSubtype}
                    onChange={handleFormatSubtypeChange}
                    aria-required="true"
                    required
                    className="w-full px-3 py-2 border rounded-lg transition-colors border-gray-300 focus:ring-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    <option value="">Select a format subtype</option>
                    {formatCategories[formData.formatCategory as keyof typeof formatCategories]?.map(subtype => (
                      <option key={subtype} value={subtype}>{subtype}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.formatSubtype === 'Custom Format (please specify)' && (
                <div>
                  <label htmlFor="customFormat" className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Format *
                  </label>
                  <input
                    type="text"
                    id="customFormat"
                    name="customFormat"
                    value={formData.customFormat}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Please specify your custom format"
                    required
                  />
                </div>
              )}
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

          {/* Media Uploads */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Media & Assets</h2>
            
            {/* Temporary Notice */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Media upload is temporarily disabled while we upgrade our storage infrastructure. 
                You can still update your pitch text and details.
              </p>
            </div>
            
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
                      <span className="text-sm font-medium">{formData.image.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('image')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload a new cover image (optional)</p>
                    <input
                      type="file"
                      disabled
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'image')}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50"
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
                      <span className="text-sm font-medium">{formData.pdf.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('pdf')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload a new script or treatment (optional)</p>
                    <input
                      type="file"
                      disabled
                      accept=".pdf"
                      onChange={(e) => handleFileChange(e, 'pdf')}
                      className="hidden"
                      id="pdf-upload"
                    />
                    <label
                      htmlFor="pdf-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50"
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
                      <span className="text-sm font-medium">{formData.video.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile('video')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <Video className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Upload a new pitch video (optional)</p>
                    <input
                      type="file"
                      disabled
                      accept="video/*"
                      onChange={(e) => handleFileChange(e, 'video')}
                      className="hidden"
                      id="video-upload"
                    />
                    <label
                      htmlFor="video-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50"
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
              onClick={() => navigate('/creator/pitches')}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !validateForm()}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}