import React from 'react';
import { X, Twitter, Linkedin, Facebook, Link, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  url: string;
  type: 'pitch' | 'profile' | 'investment';
  id: string;
}

export function ShareModal({ 
  isOpen, 
  onClose, 
  title, 
  description, 
  url,
  type,
  id
}: ShareModalProps) {
  if (!isOpen) return null;

  const shareUrl = url || `${window.location.origin}/${type}/${id}`;
  const shareTitle = title || 'Check out this on Pitchey';
  const shareText = description || '';

  const handleShare = (platform: string) => {
    const shareLinks: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      email: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
    };

    if (platform === 'copy') {
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast.success('Link copied to clipboard!');
        onClose();
      }).catch(() => {
        toast.error('Failed to copy link');
      });
    } else if (shareLinks[platform]) {
      window.open(shareLinks[platform], '_blank', 'width=600,height=400');
      
      // Track share event
      fetch('/api/analytics/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: type,
          contentId: id,
          platform,
        }),
      }).catch(console.error);
      
      setTimeout(onClose, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Share {title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {description && (
          <p className="text-gray-600 text-sm mb-4">{description}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleShare('twitter')}
            className="flex items-center justify-center gap-2 p-3 bg-blue-400 text-white rounded hover:bg-blue-500 transition"
          >
            <Twitter className="w-5 h-5" />
            <span>Twitter</span>
          </button>

          <button
            onClick={() => handleShare('linkedin')}
            className="flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            <Linkedin className="w-5 h-5" />
            <span>LinkedIn</span>
          </button>

          <button
            onClick={() => handleShare('facebook')}
            className="flex items-center justify-center gap-2 p-3 bg-blue-800 text-white rounded hover:bg-blue-900 transition"
          >
            <Facebook className="w-5 h-5" />
            <span>Facebook</span>
          </button>

          <button
            onClick={() => handleShare('email')}
            className="flex items-center justify-center gap-2 p-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
          >
            <Mail className="w-5 h-5" />
            <span>Email</span>
          </button>
        </div>

        <div className="mt-4">
          <button
            onClick={() => handleShare('copy')}
            className="w-full flex items-center justify-center gap-2 p-3 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
          >
            <Link className="w-5 h-5" />
            <span>Copy Link</span>
          </button>
        </div>

        <div className="mt-4 p-2 bg-gray-50 rounded">
          <p className="text-xs text-gray-500 truncate">{shareUrl}</p>
        </div>
      </div>
    </div>
  );
}