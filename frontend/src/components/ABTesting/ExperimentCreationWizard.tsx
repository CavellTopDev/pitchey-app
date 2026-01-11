// Comprehensive Experiment Creation Wizard
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings, Target, TrendingUp, Users, Calendar, AlertCircle } from 'lucide-react';
import { StatisticalAnalysis } from '../../utils/statistical-analysis';

// Types
interface VariantFormData {
  id: string;
  name: string;
  description: string;
  trafficAllocation: number;
  config: Record<string, any>;
  isControl: boolean;
}

interface ExperimentFormData {
  name: string;
  description: string;
  hypothesis: string;
  primaryMetric: string;
  secondaryMetrics: string[];
  variants: VariantFormData[];
  trafficAllocation: number;
  targetingRules: Record<string, any>;
  userSegments: string[];
  minimumSampleSize: number;
  statisticalPower: number;
  significanceLevel: number;
  autoWinnerDetection: boolean;
  tags: string[];
}

interface ExperimentCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExperimentFormData) => Promise<void>;
}

const ExperimentCreationWizard: React.FC<ExperimentCreationWizardProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<ExperimentFormData>({
    name: '',
    description: '',
    hypothesis: '',
    primaryMetric: 'conversion',
    secondaryMetrics: [],
    variants: [
      {
        id: 'control',
        name: 'Control',
        description: 'Original version',
        trafficAllocation: 0.5,
        config: {},
        isControl: true
      },
      {
        id: 'variant_a',
        name: 'Variant A',
        description: 'Test variation',
        trafficAllocation: 0.5,
        config: {},
        isControl: false
      }
    ],
    trafficAllocation: 1.0,
    targetingRules: {},
    userSegments: [],
    minimumSampleSize: 100,
    statisticalPower: 0.8,
    significanceLevel: 0.05,
    autoWinnerDetection: false,
    tags: []
  });

  // Calculate sample size based on current settings
  const [sampleSizeCalculation, setSampleSizeCalculation] = useState<any>(null);

  useEffect(() => {
    if (formData.primaryMetric && formData.minimumSampleSize > 0) {
      try {
        const result = StatisticalAnalysis.calculateSampleSize({
          baselineConversionRate: 0.1, // Default baseline
          minimumDetectableEffect: 0.2, // 20% lift
          significanceLevel: formData.significanceLevel,
          statisticalPower: formData.statisticalPower,
          twoSided: true
        });
        setSampleSizeCalculation(result);
      } catch (error) {
        console.error('Sample size calculation error:', error);
      }
    }
  }, [formData.significanceLevel, formData.statisticalPower, formData.minimumSampleSize]);

  // Form validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1:
        if (!formData.name.trim()) newErrors.name = 'Experiment name is required';
        if (!formData.hypothesis.trim()) newErrors.hypothesis = 'Hypothesis is required';
        if (!formData.primaryMetric) newErrors.primaryMetric = 'Primary metric is required';
        break;
      
      case 2:
        if (formData.variants.length < 2) {
          newErrors.variants = 'At least 2 variants are required';
        }
        
        const controlCount = formData.variants.filter(v => v.isControl).length;
        if (controlCount !== 1) {
          newErrors.variants = 'Exactly one control variant is required';
        }

        const totalAllocation = formData.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
        if (Math.abs(totalAllocation - 1.0) > 0.001) {
          newErrors.variants = 'Traffic allocation must sum to 100%';
        }

        formData.variants.forEach((variant, index) => {
          if (!variant.name.trim()) {
            newErrors[`variant_${index}_name`] = 'Variant name is required';
          }
          if (!variant.id.trim()) {
            newErrors[`variant_${index}_id`] = 'Variant ID is required';
          }
        });
        break;

      case 3:
        if (formData.minimumSampleSize < 10) {
          newErrors.minimumSampleSize = 'Minimum sample size must be at least 10';
        }
        if (formData.statisticalPower < 0.5 || formData.statisticalPower > 0.99) {
          newErrors.statisticalPower = 'Statistical power must be between 50% and 99%';
        }
        if (formData.significanceLevel < 0.01 || formData.significanceLevel > 0.2) {
          newErrors.significanceLevel = 'Significance level must be between 1% and 20%';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Failed to create experiment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update variant traffic allocation automatically
  const updateVariantAllocation = (index: number, value: number) => {
    const newVariants = [...formData.variants];
    const oldAllocation = newVariants[index].trafficAllocation;
    newVariants[index].trafficAllocation = value;

    // Redistribute remaining traffic among other variants
    const remaining = 1.0 - value;
    const otherVariants = newVariants.filter((_, i) => i !== index);
    const totalOtherAllocation = otherVariants.reduce((sum, v) => sum + v.trafficAllocation, 0);

    if (totalOtherAllocation > 0) {
      otherVariants.forEach((variant, i) => {
        const otherIndex = newVariants.findIndex(v => v.id === variant.id);
        if (otherIndex !== -1) {
          newVariants[otherIndex].trafficAllocation = 
            (variant.trafficAllocation / totalOtherAllocation) * remaining;
        }
      });
    }

    setFormData(prev => ({ ...prev, variants: newVariants }));
  };

  const addVariant = () => {
    const newVariantId = `variant_${String.fromCharCode(65 + formData.variants.length - 1)}`;
    const newVariant: VariantFormData = {
      id: newVariantId,
      name: `Variant ${String.fromCharCode(65 + formData.variants.length - 1)}`,
      description: '',
      trafficAllocation: 0,
      config: {},
      isControl: false
    };

    // Redistribute traffic equally
    const newVariants = [...formData.variants, newVariant];
    const equalAllocation = 1.0 / newVariants.length;
    newVariants.forEach(variant => {
      variant.trafficAllocation = equalAllocation;
    });

    setFormData(prev => ({ ...prev, variants: newVariants }));
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length <= 2) return;

    const newVariants = formData.variants.filter((_, i) => i !== index);
    
    // Redistribute traffic equally
    const equalAllocation = 1.0 / newVariants.length;
    newVariants.forEach(variant => {
      variant.trafficAllocation = equalAllocation;
    });

    setFormData(prev => ({ ...prev, variants: newVariants }));
  };

  if (!isOpen) return null;

  const steps = [
    { number: 1, title: 'Basic Info', description: 'Name, hypothesis, and metrics' },
    { number: 2, title: 'Variants', description: 'Configure experiment variants' },
    { number: 3, title: 'Statistical Settings', description: 'Sample size and power analysis' },
    { number: 4, title: 'Targeting & Tags', description: 'Audience and organization' },
    { number: 5, title: 'Review', description: 'Final review and submission' }
  ];

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-medium text-gray-900">Create New Experiment</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className={`flex flex-col items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
              >
                <div className={`flex items-center ${index < steps.length - 1 ? 'w-full' : ''}`}>
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    ${currentStep >= step.number 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                    }
                  `}>
                    {step.number}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      currentStep > step.number ? 'bg-indigo-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
                <div className="text-center mt-2">
                  <div className="text-sm font-medium text-gray-900">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-96">
          {currentStep === 1 && (
            <BasicInfoStep
              formData={formData}
              setFormData={setFormData}
              errors={errors}
            />
          )}

          {currentStep === 2 && (
            <VariantsStep
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              onUpdateAllocation={updateVariantAllocation}
              onAddVariant={addVariant}
              onRemoveVariant={removeVariant}
            />
          )}

          {currentStep === 3 && (
            <StatisticalSettingsStep
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              sampleSizeCalculation={sampleSizeCalculation}
            />
          )}

          {currentStep === 4 && (
            <TargetingStep
              formData={formData}
              setFormData={setFormData}
              errors={errors}
            />
          )}

          {currentStep === 5 && (
            <ReviewStep formData={formData} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>

            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Experiment'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Step components
const BasicInfoStep: React.FC<{
  formData: ExperimentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExperimentFormData>>;
  errors: Record<string, string>;
}> = ({ formData, setFormData, errors }) => {
  const metrics = [
    { value: 'conversion', label: 'Conversion Rate' },
    { value: 'revenue', label: 'Revenue per User' },
    { value: 'engagement', label: 'User Engagement' },
    { value: 'retention', label: 'User Retention' },
    { value: 'click_through_rate', label: 'Click-through Rate' },
    { value: 'session_duration', label: 'Session Duration' },
    { value: 'custom', label: 'Custom Metric' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Experiment Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Homepage CTA Button Color Test"
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
            errors.name ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of what this experiment tests..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hypothesis <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.hypothesis}
          onChange={(e) => setFormData(prev => ({ ...prev, hypothesis: e.target.value }))}
          placeholder="If we change X, then Y will happen because Z..."
          rows={3}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
            errors.hypothesis ? 'border-red-300' : 'border-gray-300'
          }`}
        />
        {errors.hypothesis && <p className="mt-1 text-sm text-red-600">{errors.hypothesis}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Primary Metric <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.primaryMetric}
          onChange={(e) => setFormData(prev => ({ ...prev, primaryMetric: e.target.value }))}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
            errors.primaryMetric ? 'border-red-300' : 'border-gray-300'
          }`}
        >
          {metrics.map(metric => (
            <option key={metric.value} value={metric.value}>
              {metric.label}
            </option>
          ))}
        </select>
        {errors.primaryMetric && <p className="mt-1 text-sm text-red-600">{errors.primaryMetric}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Secondary Metrics (Optional)
        </label>
        <div className="grid grid-cols-2 gap-3">
          {metrics.filter(m => m.value !== formData.primaryMetric).map(metric => (
            <label key={metric.value} className="flex items-center">
              <input
                type="checkbox"
                checked={formData.secondaryMetrics.includes(metric.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData(prev => ({
                      ...prev,
                      secondaryMetrics: [...prev.secondaryMetrics, metric.value]
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      secondaryMetrics: prev.secondaryMetrics.filter(m => m !== metric.value)
                    }));
                  }
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{metric.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

const VariantsStep: React.FC<{
  formData: ExperimentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExperimentFormData>>;
  errors: Record<string, string>;
  onUpdateAllocation: (index: number, value: number) => void;
  onAddVariant: () => void;
  onRemoveVariant: (index: number) => void;
}> = ({ formData, setFormData, errors, onUpdateAllocation, onAddVariant, onRemoveVariant }) => {
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900">Experiment Variants</h4>
        <button
          onClick={onAddVariant}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Variant
        </button>
      </div>

      {errors.variants && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-700">{errors.variants}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {formData.variants.map((variant, index) => (
          <div key={variant.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={variant.isControl}
                    onChange={() => {
                      const newVariants = formData.variants.map((v, i) => ({
                        ...v,
                        isControl: i === index
                      }));
                      setFormData(prev => ({ ...prev, variants: newVariants }));
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Control</span>
                </label>
              </div>
              
              {formData.variants.length > 2 && (
                <button
                  onClick={() => onRemoveVariant(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variant ID
                </label>
                <input
                  type="text"
                  value={variant.id}
                  onChange={(e) => {
                    const newVariants = [...formData.variants];
                    newVariants[index].id = e.target.value;
                    setFormData(prev => ({ ...prev, variants: newVariants }));
                  }}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors[`variant_${index}_id`] ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors[`variant_${index}_id`] && (
                  <p className="mt-1 text-xs text-red-600">{errors[`variant_${index}_id`]}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variant Name
                </label>
                <input
                  type="text"
                  value={variant.name}
                  onChange={(e) => {
                    const newVariants = [...formData.variants];
                    newVariants[index].name = e.target.value;
                    setFormData(prev => ({ ...prev, variants: newVariants }));
                  }}
                  className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                    errors[`variant_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors[`variant_${index}_name`] && (
                  <p className="mt-1 text-xs text-red-600">{errors[`variant_${index}_name`]}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={variant.description}
                onChange={(e) => {
                  const newVariants = [...formData.variants];
                  newVariants[index].description = e.target.value;
                  setFormData(prev => ({ ...prev, variants: newVariants }));
                }}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Describe what changes in this variant..."
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Traffic Allocation: {(variant.trafficAllocation * 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={variant.trafficAllocation}
                onChange={(e) => onUpdateAllocation(index, parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variant Configuration
              </label>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-xs text-gray-500">
                  Configure variant-specific settings here (e.g., button color, copy text, feature flags).
                  This can be extended based on your specific needs.
                </p>
                <textarea
                  value={JSON.stringify(variant.config, null, 2)}
                  onChange={(e) => {
                    try {
                      const config = JSON.parse(e.target.value);
                      const newVariants = [...formData.variants];
                      newVariants[index].config = config;
                      setFormData(prev => ({ ...prev, variants: newVariants }));
                    } catch (err) {
                      // Invalid JSON, ignore
                    }
                  }}
                  rows={4}
                  className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono"
                  placeholder='{"buttonColor": "red", "ctaText": "Sign Up Now"}'
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 p-4 rounded-md">
        <h5 className="text-sm font-medium text-gray-700 mb-2">Traffic Distribution Summary</h5>
        <div className="space-y-1">
          {formData.variants.map(variant => (
            <div key={variant.id} className="flex justify-between text-sm">
              <span className="text-gray-600">{variant.name}</span>
              <span className="text-gray-900 font-medium">
                {(variant.trafficAllocation * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatisticalSettingsStep: React.FC<{
  formData: ExperimentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExperimentFormData>>;
  errors: Record<string, string>;
  sampleSizeCalculation: any;
}> = ({ formData, setFormData, errors, sampleSizeCalculation }) => {
  
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Statistical Configuration</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Sample Size
            </label>
            <input
              type="number"
              value={formData.minimumSampleSize}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                minimumSampleSize: parseInt(e.target.value) || 0 
              }))}
              min="10"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                errors.minimumSampleSize ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.minimumSampleSize && (
              <p className="mt-1 text-sm text-red-600">{errors.minimumSampleSize}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Minimum number of participants per variant
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statistical Power ({(formData.statisticalPower * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              min="0.5"
              max="0.99"
              step="0.01"
              value={formData.statisticalPower}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                statisticalPower: parseFloat(e.target.value) 
              }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            {errors.statisticalPower && (
              <p className="mt-1 text-sm text-red-600">{errors.statisticalPower}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Probability of detecting a true effect (typically 80%)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Significance Level ({(formData.significanceLevel * 100).toFixed(1)}%)
            </label>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.001"
              value={formData.significanceLevel}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                significanceLevel: parseFloat(e.target.value) 
              }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            {errors.significanceLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.significanceLevel}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Probability of false positive (typically 5%)
            </p>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.autoWinnerDetection}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  autoWinnerDetection: e.target.checked 
                }))}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">Auto Winner Detection</span>
            </label>
            <p className="mt-1 text-xs text-gray-500 ml-6">
              Automatically declare a winner when statistical significance is reached
            </p>
          </div>
        </div>
      </div>

      {sampleSizeCalculation && (
        <div className="bg-blue-50 p-4 rounded-md">
          <h5 className="text-sm font-medium text-blue-800 mb-2">Sample Size Recommendation</h5>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Per Variant:</p>
              <p className="text-blue-900 font-semibold">
                {sampleSizeCalculation.sampleSizePerVariant.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-blue-700">Total:</p>
              <p className="text-blue-900 font-semibold">
                {sampleSizeCalculation.totalSampleSize.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Based on 10% baseline conversion rate and 20% minimum detectable effect
          </p>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-md">
        <h5 className="text-sm font-medium text-gray-700 mb-2">Understanding Statistical Settings</h5>
        <div className="space-y-2 text-xs text-gray-600">
          <p><strong>Statistical Power:</strong> Higher power reduces the chance of missing a true effect, but requires more participants.</p>
          <p><strong>Significance Level:</strong> Lower significance reduces false positives but requires stronger evidence to declare a winner.</p>
          <p><strong>Auto Winner Detection:</strong> Automatically stops the test when statistical significance is reached, which can save time but may miss long-term effects.</p>
        </div>
      </div>
    </div>
  );
};

const TargetingStep: React.FC<{
  formData: ExperimentFormData;
  setFormData: React.Dispatch<React.SetStateAction<ExperimentFormData>>;
  errors: Record<string, string>;
}> = ({ formData, setFormData, errors }) => {
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ 
      ...prev, 
      tags: prev.tags.filter(tag => tag !== tagToRemove) 
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Audience Targeting</h4>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Overall Traffic Allocation ({(formData.trafficAllocation * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={formData.trafficAllocation}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                trafficAllocation: parseFloat(e.target.value) 
              }))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <p className="mt-1 text-xs text-gray-500">
              Percentage of total traffic that will participate in this experiment
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              User Segments
            </label>
            <div className="grid grid-cols-2 gap-3">
              {['new_users', 'returning_users', 'premium_users', 'mobile_users', 'desktop_users'].map(segment => (
                <label key={segment} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.userSegments.includes(segment)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          userSegments: [...prev.userSegments, segment]
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          userSegments: prev.userSegments.filter(s => s !== segment)
                        }));
                      }
                    }}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 capitalize">
                    {segment.replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Target specific user groups (leave empty to target all users)
            </p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Organization</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {formData.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
              >
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-indigo-600 hover:text-indigo-800"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addTag()}
              placeholder="Add tag..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={addTag}
              className="px-4 py-2 border border-l-0 border-gray-300 bg-gray-50 text-gray-700 rounded-r-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Tags help organize and filter experiments
          </p>
        </div>
      </div>
    </div>
  );
};

const ReviewStep: React.FC<{
  formData: ExperimentFormData;
}> = ({ formData }) => {
  return (
    <div className="space-y-6">
      <h4 className="text-lg font-medium text-gray-900">Review Your Experiment</h4>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h5 className="font-medium text-gray-900 mb-2">Basic Information</h5>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Name:</dt>
            <dd className="text-gray-900">{formData.name}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Primary Metric:</dt>
            <dd className="text-gray-900">{formData.primaryMetric}</dd>
          </div>
          {formData.description && (
            <div className="md:col-span-2">
              <dt className="font-medium text-gray-500">Description:</dt>
              <dd className="text-gray-900">{formData.description}</dd>
            </div>
          )}
          <div className="md:col-span-2">
            <dt className="font-medium text-gray-500">Hypothesis:</dt>
            <dd className="text-gray-900">{formData.hypothesis}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h5 className="font-medium text-gray-900 mb-2">Variants</h5>
        <div className="space-y-2">
          {formData.variants.map(variant => (
            <div key={variant.id} className="flex justify-between items-center text-sm">
              <div>
                <span className="font-medium">{variant.name}</span>
                {variant.isControl && (
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs">
                    Control
                  </span>
                )}
              </div>
              <span className="text-gray-600">
                {(variant.trafficAllocation * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h5 className="font-medium text-gray-900 mb-2">Statistical Settings</h5>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Statistical Power:</dt>
            <dd className="text-gray-900">{(formData.statisticalPower * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Significance Level:</dt>
            <dd className="text-gray-900">{(formData.significanceLevel * 100).toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Minimum Sample Size:</dt>
            <dd className="text-gray-900">{formData.minimumSampleSize}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Auto Winner Detection:</dt>
            <dd className="text-gray-900">{formData.autoWinnerDetection ? 'Enabled' : 'Disabled'}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h5 className="font-medium text-gray-900 mb-2">Targeting & Organization</h5>
        <dl className="text-sm space-y-2">
          <div>
            <dt className="font-medium text-gray-500">Traffic Allocation:</dt>
            <dd className="text-gray-900">{(formData.trafficAllocation * 100).toFixed(0)}%</dd>
          </div>
          {formData.userSegments.length > 0 && (
            <div>
              <dt className="font-medium text-gray-500">User Segments:</dt>
              <dd className="text-gray-900">{formData.userSegments.join(', ')}</dd>
            </div>
          )}
          {formData.tags.length > 0 && (
            <div>
              <dt className="font-medium text-gray-500">Tags:</dt>
              <dd className="text-gray-900">{formData.tags.join(', ')}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400" />
          <div className="ml-3">
            <h5 className="text-sm font-medium text-yellow-800">Ready to Launch</h5>
            <p className="text-sm text-yellow-700">
              Your experiment will be created in draft status. You can start it when you're ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperimentCreationWizard;