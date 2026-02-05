import { useState, useEffect, useRef, ImgHTMLAttributes } from 'react'
import { LazyLoadImage } from 'react-lazy-load-image-component'
import 'react-lazy-load-image-component/src/effects/blur.css'

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string
  alt: string
  fallbackSrc?: string
  sizes?: string
  priority?: boolean
  onLoad?: () => void
  onError?: () => void
  aspectRatio?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  quality?: number
  blur?: boolean
}

// Cloudflare Image Resizing API parameters
const isAllowedImageHost = (url: string): { valid: boolean; hostname: string } => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, hostname: '' }
    }
    return { valid: true, hostname: parsed.hostname.toLowerCase() }
  } catch {
    return { valid: false, hostname: '' }
  }
}

const generateCloudflareUrl = (
  src: string,
  options: {
    width?: number
    height?: number
    quality?: number
    format?: 'auto' | 'webp' | 'avif' | 'json'
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
    blur?: number
  }
) => {
  const { valid, hostname } = isAllowedImageHost(src)
  if (!valid) return src

  // If already a Cloudflare Images URL, modify it
  if (hostname.endsWith('imagedelivery.net')) {
    const params = new URLSearchParams()
    if (options.width) params.append('w', options.width.toString())
    if (options.height) params.append('h', options.height.toString())
    if (options.quality) params.append('q', options.quality.toString())
    if (options.format) params.append('f', options.format)
    if (options.fit) params.append('fit', options.fit)
    if (options.blur) params.append('blur', options.blur.toString())

    return `${src}?${params.toString()}`
  }

  // For R2 URLs, use Cloudflare Image Resizing
  if (hostname.endsWith('r2.cloudflarestorage.com') || hostname.includes('pitchey')) {
    const params: string[] = []
    if (options.width) params.push(`width=${options.width}`)
    if (options.height) params.push(`height=${options.height}`)
    if (options.quality) params.push(`quality=${options.quality}`)
    if (options.format) params.push(`format=${options.format}`)
    if (options.fit) params.push(`fit=${options.fit}`)

    return `/cdn-cgi/image/${params.join(',')}/${encodeURI(src)}`
  }

  return src
}

// Generate srcset for responsive images
const generateSrcSet = (src: string, quality = 80) => {
  const widths = [320, 640, 768, 1024, 1280, 1536, 1920]
  return widths
    .map(w => `${generateCloudflareUrl(src, { width: w, quality, format: 'auto' })} ${w}w`)
    .join(', ')
}

export function OptimizedImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.png',
  sizes = '100vw',
  priority = false,
  onLoad,
  onError,
  aspectRatio,
  objectFit = 'cover',
  quality = 80,
  blur = true,
  className = '',
  ...props
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState(src)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  
  useEffect(() => {
    setImageSrc(src)
    setHasError(false)
  }, [src])
  
  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }
  
  const handleError = () => {
    setHasError(true)
    setIsLoading(false)
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc)
    }
    onError?.()
  }
  
  // Priority images should use native loading
  if (priority) {
    return (
      <picture className={`relative block ${className}`}>
        {/* WebP source */}
        <source
          type="image/webp"
          srcSet={generateSrcSet(src, quality)}
          sizes={sizes}
        />
        
        {/* AVIF source for modern browsers */}
        <source
          type="image/avif"
          srcSet={generateSrcSet(src.replace(/\.[^.]+$/, '.avif'), quality)}
          sizes={sizes}
        />
        
        {/* Fallback image */}
        <img
          ref={imgRef}
          src={generateCloudflareUrl(src, { quality, format: 'auto' })}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          loading="eager"
          decoding="async"
          style={{
            aspectRatio,
            objectFit,
          }}
          className={`${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          {...props}
        />
        
        {/* Loading placeholder */}
        {isLoading && (
          <div 
            className="absolute inset-0 bg-gray-200 animate-pulse"
            style={{ aspectRatio }}
          />
        )}
      </picture>
    )
  }
  
  // Lazy loaded images
  return (
    <div 
      className={`relative ${className}`}
      style={{ aspectRatio }}
    >
      <LazyLoadImage
        src={generateCloudflareUrl(imageSrc, { quality, format: 'auto' })}
        alt={alt}
        effect={blur ? 'blur' : undefined}
        onLoad={handleLoad}
        onError={handleError}
        threshold={100}
        placeholderSrc={blur ? generateCloudflareUrl(src, { 
          width: 40, 
          quality: 10, 
          blur: 20,
          format: 'webp'
        }) : undefined}
        srcSet={generateSrcSet(imageSrc, quality)}
        sizes={sizes}
        style={{
          objectFit,
          width: '100%',
          height: '100%',
        }}
        {...props}
      />
      
      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center p-4">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500">Failed to load image</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Preload critical images
export function preloadImage(src: string, options?: { quality?: number; width?: number }) {
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = generateCloudflareUrl(src, {
    quality: options?.quality || 80,
    width: options?.width,
    format: 'auto'
  })
  link.type = 'image/webp'
  document.head.appendChild(link)
}

// Background image optimization hook
export function useOptimizedBackgroundImage(
  src: string,
  options: { quality?: number; width?: number } = {}
) {
  const [backgroundImage, setBackgroundImage] = useState('')
  
  useEffect(() => {
    const optimizedUrl = generateCloudflareUrl(src, {
      quality: options.quality || 80,
      width: options.width || 1920,
      format: 'webp'
    })
    
    // Preload the image
    const img = new Image()
    img.src = optimizedUrl
    img.onload = () => {
      setBackgroundImage(`url(${optimizedUrl})`)
    }
  }, [src, options.quality, options.width])
  
  return backgroundImage
}

export default OptimizedImage