/**
 * Chunked Upload Test Page
 * Test and demo page for the enhanced chunked upload system
 */

import React from 'react';
import ChunkedUploadDemo from '../components/FileUpload/ChunkedUploadDemo';

const ChunkedUploadTest: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto">
        <ChunkedUploadDemo />
      </div>
    </div>
  );
};

export default ChunkedUploadTest;