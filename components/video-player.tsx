import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, Platform, Image } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/hooks/use-colors';

interface VideoPlayerProps {
  videoUrl: string;
  exerciseName: string;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// Get YouTube thumbnail URL
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export function VideoPlayer({ videoUrl, exerciseName }: VideoPlayerProps) {
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  
  const videoId = extractYouTubeId(videoUrl);
  const { width: screenWidth } = Dimensions.get('window');
  const playerWidth = screenWidth - 32;
  const playerHeight = (playerWidth * 9) / 16;
  
  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') {
      setPlaying(false);
    }
  }, []);

  if (!videoId) {
    return null;
  }

  const thumbnailUrl = thumbnailError 
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : getYouTubeThumbnail(videoId);

  return (
    <>
      {/* Video Thumbnail Button */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ position: 'relative' }}>
          <Image
            source={{ uri: thumbnailUrl }}
            style={{
              width: '100%',
              height: 180,
              backgroundColor: colors.surface,
            }}
            resizeMode="cover"
            onError={() => setThumbnailError(true)}
          />
          {/* Play Button Overlay */}
          <View 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
            }}
          >
            <View 
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: 'rgba(255,0,0,0.9)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <IconSymbol name="play.fill" size={28} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </View>
          </View>
        </View>
        <View style={{ padding: 12 }}>
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>
            Watch Exercise Guide
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            Tap to play video
          </Text>
        </View>
      </TouchableOpacity>

      {/* Video Player Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setPlaying(false);
          setModalVisible(false);
        }}
      >
        <View 
          style={{ 
            flex: 1, 
            backgroundColor: 'rgba(0,0,0,0.95)',
            justifyContent: 'center',
          }}
        >
          {/* Header */}
          <View 
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              paddingTop: Platform.OS === 'ios' ? 60 : 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '600', flex: 1 }}>
              {exerciseName}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setPlaying(false);
                setModalVisible(false);
              }}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.2)',
              }}
            >
              <IconSymbol name="xmark.circle.fill" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* YouTube Player */}
          <View style={{ paddingHorizontal: 16 }}>
            <YoutubePlayer
              height={playerHeight}
              width={playerWidth}
              play={playing}
              videoId={videoId}
              onChangeState={onStateChange}
              webViewProps={{
                allowsInlineMediaPlayback: true,
              }}
            />
          </View>

          {/* Controls */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <TouchableOpacity
              onPress={() => setPlaying(!playing)}
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconSymbol 
                name={playing ? "pause.fill" : "play.fill"} 
                size={20} 
                color="#FFFFFF" 
              />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', marginLeft: 8 }}>
                {playing ? 'Pause' : 'Play'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
