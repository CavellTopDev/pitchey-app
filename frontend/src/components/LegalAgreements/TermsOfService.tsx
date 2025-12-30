import React, { useState, useEffect } from 'react';
import { Button, Modal, Typography, Checkbox } from 'antd';
import { config } from '../../config';

const { Title, Paragraph } = Typography;

interface TermsOfServiceProps {
  onAccept: () => void;
  onReject: () => void;
}

const TermsOfService: React.FC<TermsOfServiceProps> = ({ onAccept, onReject }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [termsContent, setTermsContent] = useState('');

  useEffect(() => {
    // Fetch terms of service content
    const fetchTerms = async () => {
      try {
        const apiUrl = config.API_URL;
        const response = await fetch(`${apiUrl}/legal/terms-of-service.md`);
        const content = await response.text();
        setTermsContent(content);
      } catch (error) {
        console.error('Failed to load terms of service', error);
      }
    };

    fetchTerms();
    setIsVisible(true);
  }, []);

  const handleAccept = () => {
    if (isChecked) {
      // Log acceptance event
      const acceptanceRecord = {
        timestamp: new Date().toISOString(),
        version: '1.0', // Update with actual version
        ipAddress: '', // Capture user's IP address
      };

      // Send acceptance to backend
      const apiUrl = config.API_URL;
      
      credentials: 'include', // Send cookies for Better Auth session
      
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(acceptanceRecord),
      });

      onAccept();
      setIsVisible(false);
    }
  };

  const handleReject = () => {
    onReject();
    setIsVisible(false);
  };

  return (
    <Modal
      title="Terms of Service"
      visible={isVisible}
      onOk={handleAccept}
      onCancel={handleReject}
      footer={[
        <Button key="reject" onClick={handleReject}>
          Reject
        </Button>,
        <Button 
          key="accept" 
          type="primary" 
          disabled={!isChecked}
          onClick={handleAccept}
        >
          Accept
        </Button>
      ]}
      width={800}
    >
      <Typography>
        <Paragraph>
          Please read and accept our Terms of Service to continue.
        </Paragraph>
        <div 
          style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            border: '1px solid #e8e8e8', 
            padding: '10px' 
          }}
        >
          {termsContent}
        </div>
        <Checkbox 
          checked={isChecked}
          onChange={(e) => setIsChecked(e.target.checked)}
        >
          I have read and agree to the Terms of Service
        </Checkbox>
      </Typography>
    </Modal>
  );
};

export default TermsOfService;