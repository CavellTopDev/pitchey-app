import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: React.ReactNode;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  placeholder,
  fallback,
  onLoad,
  onError
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setError(true);
    onError?.();
  };

  const defaultPlaceholder = (
    <div className={`bg-gray-200 animate-pulse flex items-center justify-center ${className}`}>
      <ImageIcon className="w-8 h-8 text-gray-400" />
    </div>
  );

  const defaultFallback = (
    <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
      <ImageIcon className="w-8 h-8 text-gray-400" />
    </div>
  );

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {!inView && (placeholder || defaultPlaceholder)}
      
      {inView && !error && (
        <>
          {!loaded && (placeholder || defaultPlaceholder)}
          <img
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={`transition-opacity duration-300 ${
              loaded ? 'opacity-100' : 'opacity-0'
            } ${className}`}
            style={{ display: loaded ? 'block' : 'none' }}
          />
        </>
      )}
      
      {error && (fallback || defaultFallback)}
    </div>
  );
};

export default LazyImage;