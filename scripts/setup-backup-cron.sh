#!/bin/bash

# Setup Automated Database Backup Cron Jobs

# Create backup schedule
cat > /tmp/backup-crontab << 'EOF'
# Database Backup Schedule for Pitchey Platform
# ============================================

# Daily incremental backup at 2 AM
0 2 * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/scripts/database-backup.sh incremental production >> /var/log/backup.log 2>&1

# Weekly full backup on Sunday at 3 AM
0 3 * * 0 /home/supremeisbeing/pitcheymovie/pitchey_v0.2/scripts/database-backup.sh full production >> /var/log/backup.log 2>&1

# Monthly differential backup on 1st at 4 AM
0 4 1 * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/scripts/database-backup.sh differential production >> /var/log/backup.log 2>&1

# Cleanup old backups daily at 5 AM
0 5 * * * find /backup/postgresql -name "*.sql.gz*" -mtime +30 -delete

# Health check - verify last backup at 6 AM daily
0 6 * * * /home/supremeisbeing/pitcheymovie/pitchey_v0.2/scripts/verify-last-backup.sh || echo "Backup verification failed" | mail -s "Backup Alert" ops@pitchey.com
EOF

# Install crontab
echo "Installing backup cron jobs..."
crontab /tmp/backup-crontab

# Create log rotation config
cat > /etc/logrotate.d/database-backup << 'EOF'
/var/log/backup.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}
EOF

echo "✅ Automated backup cron jobs installed successfully"
echo ""
echo "Schedule:"
echo "- Daily incremental: 2:00 AM"
echo "- Weekly full: Sunday 3:00 AM"
echo "- Monthly differential: 1st of month 4:00 AM"
echo ""
echo "To view current cron jobs: crontab -l"
echo "To edit cron jobs: crontab -e"