import { useState } from 'react';
import { 
  FileText, Video, BookOpen, BarChart3, DollarSign,
  Calendar, Download, Eye, Lock, X, Image as ImageIcon
} from 'lucide-react';

interface MediaItem {
  id: string;
  type: 'lookbook' | 'script' | 'trailer' | 'pitch_deck' | 'budget_breakdown' | 'production_timeline' | 'other';
  url: string;
  title: string;
  description?: string;
  uploadedAt: string;
  size?: string;
  requiresNDA?: boolean;
}

interface PitchMediaGalleryProps {
  mediaItems: MediaItem[];
  hasNDAAccess?: boolean;
  onDownload?: (item: MediaItem) => void;
  onView?: (item: MediaItem) => void;
  titleImage?: string;
  showTitleImage?: boolean;
  className?: string;
}

export default function PitchMediaGallery({
  mediaItems,
  hasNDAAccess = false,
  onDownload,
  onView,
  titleImage,
  showTitleImage = true,
  className = ''
}: PitchMediaGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  const getIcon = (type: MediaItem['type']) => {
    switch (type) {
      case 'lookbook': return BookOpen;
      case 'script': return FileText;
      case 'trailer': return Video;
      case 'pitch_deck': return BarChart3;
      case 'budget_breakdown': return DollarSign;
      case 'production_timeline': return Calendar;
      default: return FileText;
    }
  };

  const getColor = (type: MediaItem['type']) => {
    switch (type) {
      case 'lookbook': return 'bg-green-100 text-green-600 border-green-200';
      case 'script': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'trailer': return 'bg-red-100 text-red-600 border-red-200';
      case 'pitch_deck': return 'bg-purple-100 text-purple-600 border-purple-200';
      case 'budget_breakdown': return 'bg-yellow-100 text-yellow-600 border-yellow-200';
      case 'production_timeline': return 'bg-indigo-100 text-indigo-600 border-indigo-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getLabel = (type: MediaItem['type']) => {
    switch (type) {
      case 'lookbook': return 'Lookbook';
      case 'script': return 'Script';
      case 'trailer': return 'Trailer';
      case 'pitch_deck': return 'Pitch Deck';
      case 'budget_breakdown': return 'Budget Breakdown';
      case 'production_timeline': return 'Production Timeline';
      default: return 'Document';
    }
  };

  const handleView = (item: MediaItem) => {
    if (item.requiresNDA && !hasNDAAccess) {
      return;
    }
    
    if (item.type === 'trailer' || item.url.match(/\.(mp4|webm|mov)$/i)) {
      setSelectedMedia(item);
      setShowLightbox(true);
    } else if (onView) {
      onView(item);
    } else {
      window.open(item.url, '_blank');
    }
  };

  const handleDownload = (item: MediaItem) => {
    if (item.requiresNDA && !hasNDAAccess) {
      return;
    }
    
    if (onDownload) {
      onDownload(item);
    } else {
      const link = document.createElement('a');
      link.href = item.url;
      link.download = item.title;
      link.click();
    }
  };

  const publicItems = mediaItems.filter(item => !item.requiresNDA);
  const protectedItems = mediaItems.filter(item => item.requiresNDA);

  return (
    <>
      <div className={className}>
        {/* Title Image */}
        {showTitleImage && titleImage && (
          <div className="mb-6">
            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <img 
                src={titleImage} 
                alt="Pitch Title" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Public Media */}
        {publicItems.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Available Media</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicItems.map(item => {
                const Icon = getIcon(item.type);
                const colors = getColor(item.type);
                const label = getLabel(item.type);

                return (
                  <div 
                    key={item.id}
                    className={`group relative border-2 rounded-lg p-4 hover:shadow-lg transition-shadow ${colors}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-3 rounded-lg ${colors.replace('border-', 'bg-').replace('100', '200')}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-medium px-2 py-1 bg-white rounded">
                        {label}
                      </span>
                    </div>
                    
                    <h4 className="font-medium text-gray-900 mb-1 line-clamp-1">
                      {item.title}
                    </h4>
                    
                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{item.size || 'File'}</span>
                      <span>{new Date(item.uploadedAt).toLocaleDateString()}</span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleView(item)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white text-gray-700 rounded hover:bg-gray-50 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleDownload(item)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white text-gray-700 rounded hover:bg-gray-50 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Protected Media (NDA Required) */}
        {protectedItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Protected Media (NDA Required)</h3>
            </div>
            
            {hasNDAAccess ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {protectedItems.map(item => {
                  const Icon = getIcon(item.type);
                  const colors = getColor(item.type);
                  const label = getLabel(item.type);

                  return (
                    <div 
                      key={item.id}
                      className={`group relative border-2 rounded-lg p-4 hover:shadow-lg transition-shadow ${colors}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`p-3 rounded-lg ${colors.replace('border-', 'bg-').replace('100', '200')}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-medium px-2 py-1 bg-white rounded">
                          {label}
                        </span>
                      </div>
                      
                      <h4 className="font-medium text-gray-900 mb-1 line-clamp-1">
                        {item.title}
                      </h4>
                      
                      {item.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{item.size || 'File'}</span>
                        <span>{new Date(item.uploadedAt).toLocaleDateString()}</span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleView(item)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white text-gray-700 rounded hover:bg-gray-50 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleDownload(item)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white text-gray-700 rounded hover:bg-gray-50 text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h4 className="font-medium text-gray-900 mb-2">NDA Required</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Sign an NDA to access {protectedItems.length} additional media files including:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {[...new Set(protectedItems.map(item => item.type))].map(type => {
                    const Icon = getIcon(type as MediaItem['type']);
                    const label = getLabel(type as MediaItem['type']);
                    return (
                      <span 
                        key={type}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700"
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                    );
                  })}
                </div>
                <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  Request NDA Access
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {mediaItems.length === 0 && (
          <div className="text-center py-8">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No media files uploaded yet</p>
          </div>
        )}
      </div>

      {/* Lightbox for videos */}
      {showLightbox && selectedMedia && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-6xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="bg-black rounded-lg overflow-hidden">
              {selectedMedia.type === 'trailer' ? (
                <video 
                  controls 
                  autoPlay 
                  className="w-full max-h-[80vh]"
                  src={selectedMedia.url}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img 
                  src={selectedMedia.url} 
                  alt={selectedMedia.title}
                  className="w-full max-h-[80vh] object-contain"
                />
              )}
            </div>
            
            <div className="mt-4 text-white">
              <h3 className="text-xl font-semibold">{selectedMedia.title}</h3>
              {selectedMedia.description && (
                <p className="text-gray-300 mt-2">{selectedMedia.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}