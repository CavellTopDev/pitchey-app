#!/usr/bin/env node

// WebSocket Load and Feature Testing Script
// Tests all new WebSocket handlers and reliability features

const WebSocket = require('ws');
const colors = require('colors/safe');

// Configuration
const WS_URL = 'ws://localhost:8001/ws';
const AUTH_TOKEN = 'test-token'; // Replace with actual token

class WebSocketTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const prefix = {
      info: '📌',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };
    
    const color = {
      info: 'blue',
      success: 'green',
      error: 'red',
      warning: 'yellow'
    };
    
    console.log(colors[color[type]](`${prefix[type]} ${message}`));
  }

  async test(name, fn) {
    try {
      this.log(`Testing: ${name}`, 'info');
      await fn();
      this.results.passed++;
      this.results.tests.push({ name, status: 'passed' });
      this.log(`${name} - PASSED`, 'success');
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'failed', error: error.message });
      this.log(`${name} - FAILED: ${error.message}`, 'error');
    }
  }

  async runTests() {
    console.log('\n' + colors.cyan('='.repeat(50)));
    console.log(colors.cyan.bold('WebSocket Enhancement Tests'));
    console.log(colors.cyan('='.repeat(50)) + '\n');

    // Test 1: Basic Connection
    await this.test('Basic WebSocket Connection', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`);
        
        ws.on('open', () => {
          ws.close();
          resolve();
        });
        
        ws.on('error', reject);
        
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    });

    // Test 2: Ping-Pong Heartbeat
    await this.test('Ping-Pong Heartbeat', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`);
        let pongReceived = false;
        
        ws.on('open', () => {
          ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'pong') {
            pongReceived = true;
            ws.close();
            resolve();
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          ws.close();
          if (!pongReceived) {
            reject(new Error('No pong received'));
          }
        }, 3000);
      });
    });

    // Test 3: Message Type Handling
    await this.test('Message Type Handling', async () => {
      const messageTypes = [
        'subscribe:notifications',
        'subscribe:dashboard',
        'subscribe:pitch',
        'presence:update',
        'request:initial_data'
      ];
      
      return new Promise(async (resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`);
        let tested = 0;
        
        ws.on('open', () => {
          messageTypes.forEach(type => {
            ws.send(JSON.stringify({ 
              type, 
              payload: { test: true },
              timestamp: new Date().toISOString()
            }));
          });
        });
        
        ws.on('message', () => {
          tested++;
          if (tested >= messageTypes.length) {
            ws.close();
            resolve();
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          ws.close();
          if (tested < messageTypes.length) {
            reject(new Error(`Only ${tested}/${messageTypes.length} messages handled`));
          }
        }, 5000);
      });
    });

    // Test 4: Reconnection Logic
    await this.test('Reconnection After Disconnect', async () => {
      return new Promise((resolve, reject) => {
        let reconnected = false;
        const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`);
        
        ws.on('open', () => {
          if (!reconnected) {
            // Simulate disconnect
            ws.close();
            
            // Try to reconnect
            setTimeout(() => {
              const ws2 = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`);
              ws2.on('open', () => {
                reconnected = true;
                ws2.close();
                resolve();
              });
              ws2.on('error', reject);
            }, 1000);
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          if (!reconnected) {
            reject(new Error('Failed to reconnect'));
          }
        }, 5000);
      });
    });

    // Test 5: Concurrent Connections
    await this.test('Handle 10 Concurrent Connections', async () => {
      return new Promise(async (resolve, reject) => {
        const connections = [];
        let connected = 0;
        
        for (let i = 0; i < 10; i++) {
          const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}_${i}`);
          connections.push(ws);
          
          ws.on('open', () => {
            connected++;
            if (connected === 10) {
              // All connected, clean up
              connections.forEach(c => c.close());
              resolve();
            }
          });
          
          ws.on('error', (err) => {
            connections.forEach(c => c.close());
            reject(err);
          });
        }
        
        setTimeout(() => {
          connections.forEach(c => c.close());
          if (connected < 10) {
            reject(new Error(`Only ${connected}/10 connections established`));
          }
        }, 5000);
      });
    });

    // Test 6: Load Test (100 connections)
    await this.test('Load Test - 100 Connections', async () => {
      return new Promise(async (resolve, reject) => {
        const startTime = Date.now();
        const connections = [];
        let connected = 0;
        let errors = 0;
        const targetConnections = 100;
        
        this.log(`Creating ${targetConnections} connections...`, 'info');
        
        for (let i = 0; i < targetConnections; i++) {
          const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}_${i}`);
          connections.push(ws);
          
          ws.on('open', () => {
            connected++;
            
            // Send a test message
            ws.send(JSON.stringify({ 
              type: 'ping',
              timestamp: Date.now()
            }));
            
            if (connected === targetConnections) {
              const duration = Date.now() - startTime;
              this.log(`All ${targetConnections} connections established in ${duration}ms`, 'success');
              
              // Keep connections alive for 2 seconds
              setTimeout(() => {
                connections.forEach(c => c.close());
                resolve();
              }, 2000);
            }
          });
          
          ws.on('error', () => {
            errors++;
          });
          
          // Stagger connection attempts
          await new Promise(r => setTimeout(r, 10));
        }
        
        setTimeout(() => {
          connections.forEach(c => c.close());
          if (connected < targetConnections) {
            reject(new Error(`Only ${connected}/${targetConnections} connections established, ${errors} errors`));
          }
        }, 10000);
      });
    });

    // Test 7: Message Latency
    await this.test('Message Round-Trip Latency', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`);
        const latencies = [];
        let tests = 0;
        const targetTests = 10;
        
        ws.on('open', () => {
          const sendPing = () => {
            const timestamp = Date.now();
            ws.send(JSON.stringify({ 
              type: 'ping',
              timestamp,
              id: tests
            }));
          };
          
          sendPing();
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'pong') {
            const latency = Date.now() - parseInt(message.timestamp);
            latencies.push(latency);
            tests++;
            
            if (tests < targetTests) {
              setTimeout(() => {
                ws.send(JSON.stringify({ 
                  type: 'ping',
                  timestamp: Date.now(),
                  id: tests
                }));
              }, 100);
            } else {
              const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
              const maxLatency = Math.max(...latencies);
              const minLatency = Math.min(...latencies);
              
              this.log(`Latency - Avg: ${avgLatency.toFixed(2)}ms, Min: ${minLatency}ms, Max: ${maxLatency}ms`, 'info');
              
              ws.close();
              
              if (avgLatency > 100) {
                reject(new Error(`High latency: ${avgLatency.toFixed(2)}ms (target: <100ms)`));
              } else {
                resolve();
              }
            }
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          ws.close();
          reject(new Error('Latency test timeout'));
        }, 15000);
      });
    });

    // Test 8: Error Handling
    await this.test('Error Message Handling', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_URL}?token=${AUTH_TOKEN}`);
        
        ws.on('open', () => {
          // Send invalid message
          ws.send(JSON.stringify({ 
            type: 'invalid_message_type',
            payload: null
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'error') {
            ws.close();
            resolve();
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          ws.close();
          reject(new Error('No error message received for invalid message'));
        }, 3000);
      });
    });

    // Print results
    this.printResults();
  }

  printResults() {
    console.log('\n' + colors.cyan('='.repeat(50)));
    console.log(colors.cyan.bold('Test Results Summary'));
    console.log(colors.cyan('='.repeat(50)) + '\n');
    
    console.log(colors.green(`Passed: ${this.results.passed}`));
    console.log(colors.red(`Failed: ${this.results.failed}`));
    console.log(`Total: ${this.results.passed + this.results.failed}\n`);
    
    if (this.results.failed > 0) {
      console.log(colors.red.bold('Failed Tests:'));
      this.results.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(colors.red(`  - ${t.name}: ${t.error}`));
        });
    }
    
    const passRate = (this.results.passed / (this.results.passed + this.results.failed) * 100).toFixed(2);
    
    if (passRate === '100.00') {
      console.log('\n' + colors.green.bold(`✅ All tests passed! (${passRate}%)`));
    } else {
      console.log('\n' + colors.yellow.bold(`⚠️ Pass rate: ${passRate}%`));
    }
  }
}

// Check if colors module is installed
try {
  require('colors/safe');
} catch (e) {
  console.log('Installing required dependency: colors');
  require('child_process').execSync('npm install colors');
}

// Run tests
const tester = new WebSocketTester();
tester.runTests().catch(console.error);