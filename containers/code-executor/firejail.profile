# Firejail security profile for code executor
# Restrict network access
net none

# Disable system calls that could be dangerous
seccomp

# Private /tmp directory
private-tmp

# Read-only access to most of the filesystem
read-only /

# Writable areas needed for execution
private-etc passwd,group,hostname
private-dev

# CPU and memory limits
rlimit-cpu 30
rlimit-as 268435456  # 256MB memory limit

# Disable setuid/setgid
noroot

# Blacklist dangerous directories
blacklist /proc
blacklist /sys
blacklist /dev/mem
blacklist /dev/kmem
blacklist /dev/port

# Disable shell access to external commands
shell none