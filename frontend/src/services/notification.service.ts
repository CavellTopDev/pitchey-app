interface NotificationPermission {
  granted: boolean;
  permission: NotificationPermission;
}

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: NotificationAction[];
  data?: any;
}

export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';
  private sounds: { [key: string]: HTMLAudioElement } = {};

  constructor() {
    this.initializePermission();
    this.loadSounds();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async initializePermission() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  private loadSounds() {
    // Load notification sounds with error handling
    // Temporarily disabled until sound files are available
    try {
      // Commented out until sound files are added
      // this.sounds.message = new Audio('/sounds/message.mp3');
      // this.sounds.mention = new Audio('/sounds/mention.mp3');
      // this.sounds.call = new Audio('/sounds/call.mp3');
      
      // Set volume if sounds are loaded
      Object.values(this.sounds).forEach(audio => {
        if (audio) {
          audio.volume = 0.5;
        }
      });
    } catch (error) {
      console.log('Sound files not available, running in silent mode');
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }

    if (this.permission === 'granted') {
      return 'granted';
    }

    const permission = await Notification.requestPermission();
    this.permission = permission;
    return permission;
  }

  async showNotification(options: NotificationOptions): Promise<void> {
    // Check if we have permission
    if (this.permission !== 'granted') {
      console.log('Notification permission not granted');
      return;
    }

    // Check if the page is visible (don't show notification if user is actively using the app)
    if (document.visibilityState === 'visible') {
      // Just play sound and show in-app notification
      this.playSound('message');
      this.showInAppNotification(options);
      return;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/pitcheylogo.png',
        badge: options.badge || '/pitcheylogo.png',
        image: options.image,
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        data: options.data,
      });

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click
      notification.onclick = () => {
        window.focus();
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
        notification.close();
      };

      // Play sound
      this.playSound('message');
    } catch (error) {
      console.error('Failed to show notification:', error);
      this.showInAppNotification(options);
    }
  }

  private showInAppNotification(options: NotificationOptions) {
    // Create in-app notification element
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-white shadow-lg rounded-lg p-4 border-l-4 border-purple-500 z-50 max-w-sm';
    notification.innerHTML = `
      <div class="flex items-start">
        <div class="flex-1">
          <h4 class="font-semibold text-gray-900">${options.title}</h4>
          <p class="text-sm text-gray-600 mt-1">${options.body}</p>
        </div>
        <button class="ml-4 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  private playSound(soundType: string) {
    try {
      const sound = this.sounds[soundType];
      if (sound) {
        sound.currentTime = 0;
        sound.play().catch(error => {
          console.log('Could not play notification sound:', error);
        });
      }
    } catch (error) {
      console.log('Sound playback failed:', error);
    }
  }

  // Message-specific notifications
  async notifyNewMessage(senderName: string, content: string, conversationId: number) {
    await this.showNotification({
      title: `New message from ${senderName}`,
      body: content.length > 100 ? content.substring(0, 100) + '...' : content,
      tag: `message-${conversationId}`,
      data: { url: `/messages?conversation=${conversationId}` },
    });
  }

  async notifyMessageRead(messageId: number, readerName: string) {
    await this.showNotification({
      title: 'Message Read',
      body: `${readerName} read your message`,
      tag: `read-${messageId}`,
      silent: true,
    });
  }

  async notifyTyping(userName: string, conversationId: number) {
    // Don't show notification for typing, just update UI
    this.showInAppNotification({
      title: 'Typing',
      body: `${userName} is typing...`,
    });
  }

  async notifyUserOnline(userName: string) {
    await this.showNotification({
      title: 'User Online',
      body: `${userName} is now online`,
      silent: true,
    });
  }

  async notifyNDAApproved(pitchTitle: string) {
    await this.showNotification({
      title: 'NDA Approved',
      body: `Your NDA request for "${pitchTitle}" has been approved`,
      tag: 'nda-approved',
      requireInteraction: true,
    });
  }

  async notifyOffPlatformApproved(senderName: string, pitchTitle: string) {
    await this.showNotification({
      title: 'Off-Platform Communication Approved',
      body: `${senderName} approved off-platform communication for "${pitchTitle}"`,
      tag: 'off-platform-approved',
      requireInteraction: true,
    });
  }

  // Update notification badge count
  updateBadgeCount(count: number) {
    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(count);
    }
    
    // Update document title with count
    const baseTitle = 'Pitchey';
    document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
  }

  // Clear all notifications with a specific tag
  clearNotifications(tag: string) {
    if ('serviceWorker' in navigator && 'getNotifications' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        registration.getNotifications({ tag }).then(notifications => {
          notifications.forEach(notification => notification.close());
        });
      });
    }
  }

  // Check if notifications are supported
  isSupported(): boolean {
    return 'Notification' in window;
  }

  // Get current permission status
  getPermission(): NotificationPermission {
    return this.permission;
  }

  // Enable/disable sounds
  setSoundEnabled(enabled: boolean) {
    Object.values(this.sounds).forEach(audio => {
      audio.muted = !enabled;
    });
  }

  // Set notification volume
  setVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    Object.values(this.sounds).forEach(audio => {
      audio.volume = clampedVolume;
    });
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();