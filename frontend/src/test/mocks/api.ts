/**
 * API Response Mock Data
 * Matches production API structure
 */

export const mockPitch = {
  id: 'mock-pitch-uuid',
  title: 'Test Pitch',
  budget: '1000000', // String, not number
  creator: {
    id: 'mock-creator-uuid',
    name: 'Test Creator',
    company: 'Test Production Co'
  },
  status: 'published',
  viewCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  genres: ['Drama', 'Thriller'],
  logline: 'A compelling test pitch',
  synopsis: 'Full synopsis here',
  target_audience: '18-35',
  comparables: 'Similar to X and Y'
};

export const mockPitchesResponse = {
  success: true,
  data: [mockPitch], // Data is nested, not direct array
  pagination: {
    total: 1,
    page: 1,
    limit: 10
  }
};

export const mockNotification = {
  id: 'mock-notif-uuid',
  type: 'pitch_view',
  eventType: 'pitch.viewed', // Sub-type field
  title: 'Your pitch was viewed',
  message: 'Someone viewed your pitch',
  read: false,
  createdAt: new Date().toISOString(),
  metadata: {
    pitchId: mockPitch.id,
    viewerId: 'viewer-uuid'
  }
};