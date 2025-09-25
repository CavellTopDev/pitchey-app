import React, { useState, useEffect } from 'react';
import { Button, Modal, Typography, Checkbox, Select } from 'antd';

const { Title, Paragraph } = Typography;
const { Option } = Select;

interface NDAAgreementProps {
  onAccept: (ndaType: string) => void;
  onReject: () => void;
}

const NonDisclosureAgreement: React.FC<NDAAgreementProps> = ({ onAccept, onReject }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [ndaType, setNdaType] = useState('basic');
  const [ndaContent, setNdaContent] = useState('');

  useEffect(() => {
    // Fetch NDA content based on selected type
    const fetchNDA = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'https://pitchey-backend.deno.dev';
        const response = await fetch(`${apiUrl}/legal/nda-templates.md`);
        const content = await response.text();
        setNdaContent(content);
      } catch (error) {
        console.error('Failed to load NDA templates', error);
      }
    };

    fetchNDA();
    setIsVisible(true);
  }, [ndaType]);

  const handleAccept = () => {
    if (isChecked) {
      // Log NDA acceptance event
      const acceptanceRecord = {
        timestamp: new Date().toISOString(),
        ndaType: ndaType,
        version: '1.0', // Update with actual version
        scope: 'Pitch Interaction',
        // Additional metadata can be added here
      };

      // Send acceptance to backend
      const apiUrl = import.meta.env.VITE_API_URL || 'https://pitchey-backend.deno.dev';
      fetch(`${apiUrl}/api/legal/nda-acceptance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(acceptanceRecord),
      });

      onAccept(ndaType);
      setIsVisible(false);
    }
  };

  const handleReject = () => {
    onReject();
    setIsVisible(false);
  };

  return (
    <Modal
      title="Non-Disclosure Agreement (NDA)"
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
          Select and review the appropriate Non-Disclosure Agreement for your pitch interaction.
        </Paragraph>
        <Select 
          style={{ width: '100%', marginBottom: '15px' }}
          value={ndaType}
          onChange={(value) => setNdaType(value)}
        >
          <Option value="basic">Basic Pitch Viewing NDA</Option>
          <Option value="enhanced">Enhanced Materials NDA</Option>
          <Option value="custom">Custom NDA</Option>
        </Select>
        <div 
          style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            border: '1px solid #e8e8e8', 
            padding: '10px' 
          }}
        >
          {ndaContent}
        </div>
        <Checkbox 
          checked={isChecked}
          onChange={(e) => setIsChecked(e.target.checked)}
        >
          I have read and agree to the Non-Disclosure Agreement
        </Checkbox>
      </Typography>
    </Modal>
  );
};

export default NonDisclosureAgreement;