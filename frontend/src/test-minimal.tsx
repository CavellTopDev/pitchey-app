// Minimal test component to isolate temporal dead zone
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Test basic React rendering without any complex imports
function MinimalTest() {
  return (
    <div>
      <h1>Minimal Test Component</h1>
      <p>If you see this, React basic rendering works.</p>
    </div>
  );
}

// Direct rendering without any other imports
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <MinimalTest />
    </StrictMode>
  );
} else {
  console.error('Root container not found');
}