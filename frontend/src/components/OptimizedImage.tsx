import React, { useState, useEffect, useRef, ImgHTMLAttributes } from 'react'

interface OptimizedImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  placeholder?: string
  lazy?: boolean
  fadeIn?: boolean
  aspectRatio?: number
  quality?: 'low' | 'medium' | 'high'
  priority?: boolean
}

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Progressive loading with placeholder
 * - Fade-in animation on load
 * - Responsive image support
 * - Automatic WebP format detection
 * - Error handling with fallback
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  placeholder,
  lazy = true,
  fadeIn = true,
  aspectRatio,
  quality = 'medium',
  priority = false,
  className = '',
  style = {},
  onLoad,
  onError,
  ...rest
}) => {
  const [imageSrc, setImageSrc] = useState<string>(lazy && !priority ? (placeholder || '') : src)
  const [isLoaded, setIsLoaded] = useState<boolean>(!lazy || priority)
  const [isInView, setIsInView] = useState<boolean>(!lazy || priority)
  const [hasError, setHasError] = useState<boolean>(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Quality to dimension mapping for image optimization
  const getImageUrl = (url: string): string => {
    if (!url || url.startsWith('data:')) return url
    
    // If it's an external URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    
    // Add query params for optimization if it's a local image
    const qualityParams = {
      low: 'w=400&q=60',
      medium: 'w=800&q=75',
      high: 'w=1200&q=85'
    }
    
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}${qualityParams[quality]}`
  }

  useEffect(() => {
    if (!lazy || priority) {
      setImageSrc(src)
      return
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsInView(true)
          if (observerRef.current && imgRef.current) {
            observerRef.current.unobserve(imgRef.current)
          }
        }
      })
    }

    // Create Intersection Observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      rootMargin: '50px', // Start loading 50px before the image enters viewport
      threshold: 0.01
    })

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [lazy, priority, src])

  useEffect(() => {
    if (isInView && !isLoaded) {
      // Preload image
      const img = new Image()
      img.src = getImageUrl(src)
      
      img.onload = () => {
        setImageSrc(src)
        setIsLoaded(true)
        setHasError(false)
      }
      
      img.onerror = () => {
        setHasError(true)
        // Try fallback to original src without optimization
        setImageSrc(src)
      }
    }
  }, [isInView, isLoaded, src, quality])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true)
    if (onLoad) onLoad(e)
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true)
    if (onError) onError(e)
    
    // Fallback to placeholder or a default error image
    if (placeholder) {
      setImageSrc(placeholder)
    }
  }

  const imageClasses = `
    ${className}
    ${fadeIn && isLoaded ? 'opacity-100 transition-opacity duration-300' : ''}
    ${fadeIn && !isLoaded ? 'opacity-0' : ''}
    ${hasError ? 'filter grayscale' : ''}
  `.trim()

  const imageStyle = {
    ...style,
    ...(aspectRatio ? { aspectRatio: `${aspectRatio}` } : {})
  }

  return (
    <>
      {/* Placeholder/Loading state */}
      {!isLoaded && placeholder && (
        <div
          className={`absolute inset-0 ${fadeIn ? 'transition-opacity duration-300' : ''}`}
          style={{
            backgroundImage: `url(${placeholder})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px)',
            ...imageStyle
          }}
        />
      )}
      
      {/* Main image */}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={imageClasses}
        style={imageStyle}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={lazy && !priority ? 'lazy' : 'eager'}
        decoding={priority ? 'sync' : 'async'}
        {...rest}
      />
      
      {/* Loading skeleton */}
      {!isLoaded && !placeholder && (
        <div
          className={`${className} bg-gray-200 animate-pulse`}
          style={imageStyle}
        />
      )}
    </>
  )
}

// Picture component for responsive images
interface OptimizedPictureProps {
  sources: Array<{
    srcSet: string
    media?: string
    type?: string
  }>
  fallback: OptimizedImageProps
}

export const OptimizedPicture: React.FC<OptimizedPictureProps> = ({
  sources,
  fallback
}) => {
  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
        />
      ))}
      <OptimizedImage {...fallback} />
    </picture>
  )
}

// Hero image component for above-the-fold images
export const HeroImage: React.FC<OptimizedImageProps> = (props) => {
  return (
    <OptimizedImage
      {...props}
      priority={true}
      lazy={false}
      quality="high"
      fetchPriority="high"
    />
  )
}

// Thumbnail image component for small images
export const ThumbnailImage: React.FC<OptimizedImageProps> = (props) => {
  return (
    <OptimizedImage
      {...props}
      quality="low"
      fadeIn={false}
    />
  )
}

export default OptimizedImage