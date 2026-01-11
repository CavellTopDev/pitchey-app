/**
 * Mobile-optimized Pitch Card Component for React Native
 * Supports touch gestures, optimized images, and offline states
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform
} from 'react-native';
import { Pitch } from '../types';

interface PitchCardProps {
  pitch: Pitch;
  onPress?: (pitch: Pitch) => void;
  onLike?: (pitchId: number) => void;
  onSave?: (pitchId: number) => void;
  optimizeForConnection?: boolean;
  style?: any;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARD_WIDTH = screenWidth - (CARD_MARGIN * 2);

export const PitchCard: React.FC<PitchCardProps> = ({
  pitch,
  onPress,
  onLike,
  onSave,
  optimizeForConnection = true,
  style
}) => {
  const handlePress = () => {
    onPress?.(pitch);
  };

  const handleLike = () => {
    onLike?.(pitch.id);
  };

  const handleSave = () => {
    onSave?.(pitch.id);
  };

  const getOptimizedImageUrl = (url?: string) => {
    if (!url || !optimizeForConnection) return url;
    
    // Add mobile optimization parameters
    const params = new URLSearchParams();
    params.set('w', '400');
    params.set('q', '80');
    params.set('f', 'webp');
    
    return `${url}?${params.toString()}`;
  };

  const formatViewCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Pitch: ${pitch.title} by ${pitch.creator_name}`}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {pitch.thumbnail_url ? (
          <Image
            source={{ uri: getOptimizedImageUrl(pitch.thumbnail_url) }}
            style={styles.thumbnail}
            resizeMode="cover"
            accessibilityIgnoresInvertColors={true}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Text style={styles.placeholderText}>🎬</Text>
          </View>
        )}
        
        {/* Genre tag */}
        <View style={styles.genreTag}>
          <Text style={styles.genreText}>{pitch.genre}</Text>
        </View>
        
        {/* Format tag */}
        <View style={[styles.formatTag, { backgroundColor: getFormatColor(pitch.format) }]}>
          <Text style={styles.formatText}>{pitch.format}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {pitch.title}
        </Text>
        
        <Text style={styles.description} numberOfLines={3}>
          {pitch.description}
        </Text>
        
        {/* Creator info */}
        <View style={styles.creatorRow}>
          {pitch.creator_avatar ? (
            <Image
              source={{ uri: getOptimizedImageUrl(pitch.creator_avatar) }}
              style={styles.creatorAvatar}
              accessibilityIgnoresInvertColors={true}
            />
          ) : (
            <View style={[styles.creatorAvatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {pitch.creator_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorName} numberOfLines={1}>
              {pitch.creator_name}
            </Text>
            <Text style={styles.createdDate}>
              {formatDate(pitch.created_at)}
            </Text>
          </View>
        </View>
        
        {/* Stats and actions */}
        <View style={styles.footer}>
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>👁</Text>
              <Text style={styles.statText}>{formatViewCount(pitch.view_count)}</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>❤️</Text>
              <Text style={styles.statText}>{formatViewCount(pitch.like_count)}</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statIcon}>💬</Text>
              <Text style={styles.statText}>{formatViewCount(pitch.comment_count)}</Text>
            </View>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLike}
              accessibilityRole="button"
              accessibilityLabel="Like this pitch"
            >
              <Text style={styles.actionIcon}>❤️</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save this pitch"
            >
              <Text style={styles.actionIcon}>🔖</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getFormatColor = (format: string): string => {
  const colors = {
    'Feature Film': '#FF6B6B',
    'Short Film': '#4ECDC4',
    'Documentary': '#45B7D1',
    'Series': '#96CEB4',
    'Web Series': '#FFEAA7',
    'Animation': '#DDA0DD',
    'Commercial': '#98D8C8'
  };
  
  return colors[format as keyof typeof colors] || '#6C5CE7';
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: CARD_MARGIN,
    marginVertical: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  thumbnailContainer: {
    position: 'relative',
    height: 200,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 48,
    opacity: 0.5,
  },
  genreTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  genreText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  formatTag: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  formatText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 24,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  creatorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  createdDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  actionIcon: {
    fontSize: 16,
  },
});

export default PitchCard;