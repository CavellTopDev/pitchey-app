import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, X, Upload, FileText, Video, Image as ImageIcon } from 'lucide-react';
import { API_URL } from '../config/api.config';

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 
  'Documentary', 'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 
  'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
];

const FORMATS = [
  'Feature Film', 'Short Film', 'TV Series', 'TV Movie', 'Mini-Series', 
  'Web Series', 'Documentary Series', 'Reality Show'
];

interface PitchFormData {
  title: string;
  genre: string;
  format: string;
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
  const [formData, setFormData] = useState<PitchFormData>({
    title: '',
    genre: '',
    format: '',
    logline: '',
    shortSynopsis: '',
    image: null,
    pdf: null,
    video: null
  });

  useEffect(() => {
    if (id) {
      fetchPitch(parseInt(id));
    }
  }, [id]);

  const fetchPitch = async (pitchId: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creator/pitches/${pitchId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const pitch = data.pitch;
        setFormData({
          title: pitch.title || '',
          genre: pitch.genre || '',
          format: pitch.format || '',
          logline: pitch.logline || '',
          shortSynopsis: pitch.shortSynopsis || '',
          image: null,
          pdf: null,
          video: null
        });
      } else {
        setError('Pitch not found');
      }
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
    const { title, genre, format, logline, shortSynopsis } = formData;
    return title.trim() && genre && format && logline.trim() && shortSynopsis.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const submitFormData = new FormData();
      submitFormData.append('title', formData.title);
      submitFormData.append('genre', formData.genre);
      submitFormData.append('format', formData.format);
      submitFormData.append('logline', formData.logline);
      submitFormData.append('shortSynopsis', formData.shortSynopsis);
      
      if (formData.image) {
        submitFormData.append('image', formData.image);
      }
      if (formData.pdf) {
        submitFormData.append('pdf', formData.pdf);
      }
      if (formData.video) {
        submitFormData.append('video', formData.video);
      }

      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/api/creator/pitches/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: submitFormData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Pitch updated successfully:', result);
        navigate(`/creator/pitches/${id}`);
      } else {
        let errorMessage = 'Failed to update pitch';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          if (response.status === 404) {
            errorMessage = 'Pitch not found';
          } else {
            errorMessage = `Server error (${response.status}): ${response.statusText}`;
          }
        }
        console.error('Server response error:', response.status, response.statusText);
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error updating pitch:', error);
      alert('Network error: Unable to connect to the server');
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
              onClick={() => navigate(`/creator/pitches/${id}`)}
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
                  {GENRES.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
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
                  {FORMATS.map(format => (
                    <option key={format} value={format}>{format}</option>
                  ))}
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
              onClick={() => navigate(`/creator/pitches/${id}`)}
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