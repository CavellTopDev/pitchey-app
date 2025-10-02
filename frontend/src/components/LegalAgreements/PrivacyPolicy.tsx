import React, { useState, useEffect } from 'react';
import { Button, Modal, Typography, Checkbox } from 'antd';
import { config } from '../../config';

const { Title, Paragraph } = Typography;

interface PrivacyPolicyProps {
  onAccept: () => void;
  onReject: () => void;
}

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onAccept, onReject }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [policyContent, setPolicyContent] = useState('');

  useEffect(() => {
    // Fetch privacy policy content
    const fetchPolicy = async () => {
      try {
        const apiUrl = config.API_URL;
        const response = await fetch(`${apiUrl}/legal/privacy-policy.md`);
        const content = await response.text();
        setPolicyContent(content);
      } catch (error) {
        console.error('Failed to load privacy policy', error);
      }
    };

    fetchPolicy();
    setIsVisible(true);
  }, []);

  const handleAccept = () => {
    if (isChecked) {
      // Log privacy policy acceptance event
      const acceptanceRecord = {
        timestamp: new Date().toISOString(),
        version: '1.0', // Update with actual version
        dataProcessingConsent: true,
        analyticsConsent: true,
        marketingConsent: false, // Default conservative setting
      };

      // Send acceptance to backend
      const apiUrl = config.API_URL;
      fetch(`${apiUrl}/api/legal/privacy-acceptance`, {
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
      title="Privacy Policy"
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
          Please review our Privacy Policy and consent to data processing.
        </Paragraph>
        <div 
          style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            border: '1px solid #e8e8e8', 
            padding: '10px' 
          }}
        >
          {policyContent}
        </div>
        <Checkbox 
          checked={isChecked}
          onChange={(e) => setIsChecked(e.target.checked)}
        >
          I have read and agree to the Privacy Policy
        </Checkbox>
      </Typography>
    </Modal>
  );
};

export default PrivacyPolicy;