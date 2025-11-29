/**
 * Integration Tests for Notification Scheduler Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notificationScheduler } from '../notification-scheduler.service';
import { notificationChannelManager } from '../notification-channel-manager.service';
import { redis } from '../../lib/redis';
import { db } from '../../db/client';

// Mock dependencies
vi.mock('../../lib/redis');
vi.mock('../../db/client');
vi.mock('../notification-channel-manager.service');

describe('NotificationSchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Schedule Notification', () => {
    it('should schedule a notification for future delivery', async () => {
      const futureDate = new Date(Date.now() + 60000); // 1 minute from now
      const notification = {
        userId: 1,
        type: 'reminder',
        title: 'Test Reminder',
        message: 'This is a scheduled test',
        channels: ['email', 'push'],
        scheduledFor: futureDate,
        metadata: { test: true }
      };

      const result = await notificationScheduler.schedule(notification);

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(redis.zadd).toHaveBeenCalledWith(
        'scheduled:notifications',
        futureDate.getTime(),
        expect.any(String)
      );
    });

    it('should reject scheduling in the past', async () => {
      const pastDate = new Date(Date.now() - 60000); // 1 minute ago
      const notification = {
        userId: 1,
        type: 'reminder',
        title: 'Past Reminder',
        message: 'This should fail',
        scheduledFor: pastDate
      };

      const result = await notificationScheduler.schedule(notification);

      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });

    it('should handle recurring notifications', async () => {
      const notification = {
        userId: 1,
        type: 'digest',
        title: 'Weekly Digest',
        message: 'Your weekly summary',
        channels: ['email'],
        scheduledFor: new Date(Date.now() + 60000),
        recurring: {
          frequency: 'weekly' as const,
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      };

      const result = await notificationScheduler.schedule(notification);

      expect(result.success).toBe(true);
      expect(result.recurringId).toBeDefined();
      expect(redis.hset).toHaveBeenCalledWith(
        `recurring:${result.recurringId}`,
        expect.any(Object)
      );
    });

    it('should respect timezone when scheduling', async () => {
      const notification = {
        userId: 1,
        type: 'reminder',
        title: 'Morning Reminder',
        message: 'Good morning!',
        scheduledFor: '09:00',
        timezone: 'America/New_York',
        channels: ['push']
      };

      const result = await notificationScheduler.scheduleDaily(notification);

      expect(result.success).toBe(true);
      expect(result.nextRun).toBeDefined();
      // Verify the time is adjusted for timezone
      const nextRun = new Date(result.nextRun!);
      expect(nextRun.getUTCHours()).not.toBe(9); // Should be different in UTC
    });
  });

  describe('Process Scheduled Notifications', () => {
    it('should process due notifications', async () => {
      const now = Date.now();
      const notifications = [
        {
          id: 'job1',
          data: {
            userId: 1,
            type: 'reminder',
            title: 'Due Now',
            message: 'This notification is due'
          },
          scheduledFor: now - 1000 // 1 second ago
        },
        {
          id: 'job2',
          data: {
            userId: 2,
            type: 'reminder',
            title: 'Future',
            message: 'Not yet due'
          },
          scheduledFor: now + 60000 // 1 minute from now
        }
      ];

      vi.mocked(redis.zrangebyscore).mockResolvedValue(['job1']);
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(notifications[0].data));
      vi.mocked(notificationChannelManager.send).mockResolvedValue({
        success: true,
        channels: [{ channel: 'email', success: true }],
        totalSent: 1,
        totalFailed: 0
      });

      const processed = await notificationScheduler.processScheduled();

      expect(processed).toBe(1);
      expect(notificationChannelManager.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: 'reminder',
          title: 'Due Now'
        })
      );
      expect(redis.zrem).toHaveBeenCalledWith('scheduled:notifications', 'job1');
    });

    it('should handle processing errors gracefully', async () => {
      vi.mocked(redis.zrangebyscore).mockResolvedValue(['job1']);
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify({
        userId: 1,
        type: 'test',
        title: 'Error Test'
      }));
      vi.mocked(notificationChannelManager.send).mockRejectedValue(
        new Error('Delivery failed')
      );

      const processed = await notificationScheduler.processScheduled();

      expect(processed).toBe(0);
      expect(redis.zadd).toHaveBeenCalledWith(
        'scheduled:failed',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should reschedule recurring notifications', async () => {
      const recurringJob = {
        id: 'recurring1',
        data: {
          userId: 1,
          type: 'digest',
          title: 'Weekly Update',
          message: 'Your weekly summary',
          recurring: {
            frequency: 'weekly',
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        },
        scheduledFor: Date.now() - 1000
      };

      vi.mocked(redis.zrangebyscore).mockResolvedValue(['recurring1']);
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(recurringJob.data));
      vi.mocked(notificationChannelManager.send).mockResolvedValue({
        success: true,
        channels: [{ channel: 'email', success: true }],
        totalSent: 1,
        totalFailed: 0
      });

      const processed = await notificationScheduler.processScheduled();

      expect(processed).toBe(1);
      // Should reschedule for next week
      expect(redis.zadd).toHaveBeenCalledWith(
        'scheduled:notifications',
        expect.any(Number), // Next week's timestamp
        expect.stringContaining('recurring1')
      );
    });
  });

  describe('Bulk Scheduling', () => {
    it('should schedule multiple notifications efficiently', async () => {
      const notifications = Array.from({ length: 100 }, (_, i) => ({
        userId: i + 1,
        type: 'campaign' as const,
        title: `Campaign Message ${i}`,
        message: 'Marketing message',
        channels: ['email'],
        scheduledFor: new Date(Date.now() + (i * 1000)) // Stagger by 1 second
      }));

      const results = await notificationScheduler.scheduleBulk(notifications);

      expect(results.scheduled).toBe(100);
      expect(results.failed).toBe(0);
      expect(redis.zadd).toHaveBeenCalledTimes(100);
    });

    it('should handle partial failures in bulk scheduling', async () => {
      const notifications = [
        {
          userId: 1,
          type: 'test' as const,
          title: 'Valid',
          message: 'This should work',
          scheduledFor: new Date(Date.now() + 60000)
        },
        {
          userId: 2,
          type: 'test' as const,
          title: 'Invalid',
          message: 'This should fail',
          scheduledFor: new Date(Date.now() - 60000) // Past date
        }
      ];

      const results = await notificationScheduler.scheduleBulk(notifications);

      expect(results.scheduled).toBe(1);
      expect(results.failed).toBe(1);
      expect(results.errors).toHaveLength(1);
    });
  });

  describe('Cancel Scheduled Notifications', () => {
    it('should cancel a scheduled notification', async () => {
      const jobId = 'job123';
      vi.mocked(redis.zrem).mockResolvedValue(1);
      vi.mocked(redis.del).mockResolvedValue(1);

      const result = await notificationScheduler.cancel(jobId);

      expect(result.success).toBe(true);
      expect(redis.zrem).toHaveBeenCalledWith('scheduled:notifications', jobId);
      expect(redis.del).toHaveBeenCalledWith(`scheduled:job:${jobId}`);
    });

    it('should cancel all notifications for a user', async () => {
      const userId = 1;
      const jobs = ['job1', 'job2', 'job3'];
      
      vi.mocked(redis.zrange).mockResolvedValue(jobs);
      vi.mocked(redis.get).mockImplementation(async (key) => {
        const jobId = key.split(':').pop();
        return JSON.stringify({ userId, title: `Job ${jobId}` });
      });

      const result = await notificationScheduler.cancelAllForUser(userId);

      expect(result.cancelled).toBe(3);
      expect(redis.zrem).toHaveBeenCalledTimes(3);
    });

    it('should cancel recurring notifications', async () => {
      const recurringId = 'recurring123';
      vi.mocked(redis.hget).mockResolvedValue(JSON.stringify({
        frequency: 'daily',
        jobs: ['job1', 'job2']
      }));

      const result = await notificationScheduler.cancelRecurring(recurringId);

      expect(result.success).toBe(true);
      expect(redis.del).toHaveBeenCalledWith(`recurring:${recurringId}`);
      expect(redis.zrem).toHaveBeenCalledTimes(2); // For each job
    });
  });

  describe('Retry Failed Notifications', () => {
    it('should retry failed notifications with backoff', async () => {
      const failedJob = {
        id: 'failed1',
        data: {
          userId: 1,
          type: 'important',
          title: 'Retry Me',
          message: 'This failed before'
        },
        attempts: 1,
        lastError: 'Network timeout'
      };

      vi.mocked(redis.zrange).mockResolvedValue(['failed1']);
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(failedJob));
      vi.mocked(notificationChannelManager.send).mockResolvedValue({
        success: true,
        channels: [{ channel: 'email', success: true }],
        totalSent: 1,
        totalFailed: 0
      });

      const result = await notificationScheduler.retryFailed();

      expect(result.retried).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(redis.zrem).toHaveBeenCalledWith('scheduled:failed', 'failed1');
    });

    it('should stop retrying after max attempts', async () => {
      const failedJob = {
        id: 'failed2',
        data: {
          userId: 1,
          type: 'test',
          title: 'Max Retries',
          message: 'Failed too many times'
        },
        attempts: 5, // Max attempts reached
        lastError: 'Persistent failure'
      };

      vi.mocked(redis.zrange).mockResolvedValue(['failed2']);
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(failedJob));

      const result = await notificationScheduler.retryFailed();

      expect(result.retried).toBe(0);
      expect(result.abandoned).toBe(1);
      expect(notificationChannelManager.send).not.toHaveBeenCalled();
      expect(redis.zadd).toHaveBeenCalledWith(
        'scheduled:dead_letter',
        expect.any(Number),
        expect.any(String)
      );
    });
  });

  describe('Scheduler Analytics', () => {
    it('should provide scheduling analytics', async () => {
      vi.mocked(redis.zcard).mockImplementation(async (key) => {
        const counts: Record<string, number> = {
          'scheduled:notifications': 45,
          'scheduled:failed': 3,
          'scheduled:dead_letter': 1
        };
        return counts[key] || 0;
      });

      const analytics = await notificationScheduler.getAnalytics();

      expect(analytics.scheduled).toBe(45);
      expect(analytics.failed).toBe(3);
      expect(analytics.deadLetter).toBe(1);
      expect(analytics.successRate).toBeCloseTo(93.75); // 45/(45+3) * 100
    });

    it('should track scheduling performance metrics', async () => {
      const startTime = Date.now();
      
      // Schedule a notification
      await notificationScheduler.schedule({
        userId: 1,
        type: 'test',
        title: 'Performance Test',
        message: 'Testing',
        scheduledFor: new Date(Date.now() + 60000)
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(redis.incr).toHaveBeenCalledWith('metrics:scheduled:total');
      expect(redis.lpush).toHaveBeenCalledWith(
        'metrics:scheduled:durations',
        expect.any(Number)
      );
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe('Cron Expression Support', () => {
    it('should parse and schedule cron expressions', async () => {
      const notification = {
        userId: 1,
        type: 'report' as const,
        title: 'Daily Report',
        message: 'Your daily summary',
        channels: ['email'],
        cron: '0 9 * * *' // Every day at 9 AM
      };

      const result = await notificationScheduler.scheduleCron(notification);

      expect(result.success).toBe(true);
      expect(result.nextRun).toBeDefined();
      
      const nextRun = new Date(result.nextRun!);
      expect(nextRun.getHours()).toBe(9);
      expect(nextRun.getMinutes()).toBe(0);
    });

    it('should validate cron expressions', () => {
      const valid = notificationScheduler.validateCron('0 9 * * *');
      const invalid = notificationScheduler.validateCron('invalid cron');

      expect(valid).toBe(true);
      expect(invalid).toBe(false);
    });

    it('should calculate next run times correctly', () => {
      const cron = '*/15 * * * *'; // Every 15 minutes
      const now = new Date('2024-01-01T10:00:00Z');
      
      const nextRun = notificationScheduler.getNextRunTime(cron, now);

      expect(nextRun).toEqual(new Date('2024-01-01T10:15:00Z'));
    });
  });

  describe('Timezone Handling', () => {
    it('should convert times between timezones', () => {
      const utcTime = new Date('2024-01-01T14:00:00Z');
      const nyTime = notificationScheduler.convertToTimezone(utcTime, 'America/New_York');
      const laTime = notificationScheduler.convertToTimezone(utcTime, 'America/Los_Angeles');

      // NY is UTC-5 in January (EST)
      expect(nyTime.getHours()).toBe(9);
      // LA is UTC-8 in January (PST)
      expect(laTime.getHours()).toBe(6);
    });

    it('should handle DST transitions', () => {
      // Test spring forward (DST starts)
      const beforeDST = new Date('2024-03-09T12:00:00Z');
      const afterDST = new Date('2024-03-11T12:00:00Z');

      const beforeNY = notificationScheduler.convertToTimezone(beforeDST, 'America/New_York');
      const afterNY = notificationScheduler.convertToTimezone(afterDST, 'America/New_York');

      // Before DST: UTC-5 (EST)
      expect(beforeNY.getHours()).toBe(7);
      // After DST: UTC-4 (EDT)
      expect(afterNY.getHours()).toBe(8);
    });
  });

  describe('Queue Management', () => {
    it('should pause processing', async () => {
      await notificationScheduler.pause();

      expect(redis.set).toHaveBeenCalledWith('scheduler:paused', 'true');
      
      const processed = await notificationScheduler.processScheduled();
      expect(processed).toBe(0); // Should not process when paused
    });

    it('should resume processing', async () => {
      await notificationScheduler.resume();

      expect(redis.del).toHaveBeenCalledWith('scheduler:paused');
    });

    it('should get queue status', async () => {
      vi.mocked(redis.get).mockResolvedValue(null); // Not paused
      vi.mocked(redis.zcard).mockResolvedValue(10);

      const status = await notificationScheduler.getStatus();

      expect(status.paused).toBe(false);
      expect(status.pending).toBe(10);
      expect(status.processing).toBe(false);
    });
  });
});