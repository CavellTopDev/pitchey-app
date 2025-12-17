// NDA Component Exports - Enhanced workflow with approval flow and notifications

// Main dashboard component
export { default as NDADashboard } from './NDADashboard';

// Workflow components
export { default as NDAApprovalWorkflow } from './NDAApprovalWorkflow';
export { default as NDARequestPanel } from './NDARequestPanel';
export { default as NDANotificationCenter } from './NDANotificationCenter';

// File upload components (from previous upload enhancement)
export { default as NDAUploadSection } from './NDAUploadSection';
export type { NDADocument } from './NDAUploadSection';

// Re-export NDA service
export { ndaService } from '../../services/nda.service';

// Type exports
export type {
  NDA,
  NDARequest,
  NDATemplate,
  NDASignature,
  NDAFilters,
  NDAStats
} from '../../services/nda.service';

// Component prop types
export type { default as NDAApprovalRequest } from './NDAApprovalWorkflow';
export type { default as NDANotification } from './NDANotificationCenter';