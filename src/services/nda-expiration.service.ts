import { NDAService } from './ndaService.ts';

export class NDAExpirationService {
  private static intervalId: number | null = null;
  private static readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  static start() {
    if (this.intervalId) {
      console.log('NDA expiration service is already running');
      return;
    }

    console.log('Starting NDA expiration service...');
    
    // Run immediately
    this.checkExpiredNDAs();
    
    // Then run every 24 hours
    this.intervalId = setInterval(() => {
      this.checkExpiredNDAs();
    }, this.CHECK_INTERVAL);
    
    console.log('NDA expiration service started');
  }

  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('NDA expiration service stopped');
    }
  }

  private static async checkExpiredNDAs() {
    try {
      console.log('Checking for expired NDAs...');
      
      const revokedCount = await NDAService.revokeExpiredNDAs();
      
      if (revokedCount > 0) {
        console.log(`Revoked ${revokedCount} expired NDAs`);
      } else {
        console.log('No expired NDAs found');
      }
    } catch (error) {
      console.error('Error checking expired NDAs:', error);
    }
  }

  // Manually trigger expiration check (useful for testing)
  static async triggerCheck() {
    console.log('Manually triggering NDA expiration check...');
    await this.checkExpiredNDAs();
  }
}

// Auto-start the service when the module is imported
if (Deno.env.get('NDA_EXPIRATION_SERVICE') !== 'false') {
  NDAExpirationService.start();
}

// Graceful shutdown
const signals: Deno.Signal[] = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  Deno.addSignalListener(signal, () => {
    console.log(`Received ${signal}, stopping NDA expiration service...`);
    NDAExpirationService.stop();
    Deno.exit(0);
  });
});