// Visual Drag-and-Drop Experiment Editor
import React, { useState, useRef, useCallback } from 'react';
import { 
  MousePointer, 
  Edit3, 
  Palette, 
  Type, 
  Image, 
  Square, 
  Eye, 
  Save, 
  Undo, 
  Redo,
  Settings,
  Copy,
  Trash2,
  Layout,
  Move,
  RotateCcw
} from 'lucide-react';

// Types
interface ElementModification {
  id: string;
  elementId: string;
  type: 'text' | 'color' | 'background' | 'image' | 'position' | 'size' | 'visibility';
  originalValue: string;
  newValue: string;
  selector: string;
  description: string;
}

interface VariantConfiguration {
  variantId: string;
  name: string;
  modifications: ElementModification[];
  isControl: boolean;
}

interface VisualExperimentEditorProps {
  targetUrl: string;
  onSave: (variants: VariantConfiguration[]) => void;
  onCancel: () => void;
  existingVariants?: VariantConfiguration[];
}

const VisualExperimentEditor: React.FC<VisualExperimentEditorProps> = ({
  targetUrl,
  onSave,
  onCancel,
  existingVariants = []
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentVariant, setCurrentVariant] = useState(0);
  const [variants, setVariants] = useState<VariantConfiguration[]>(
    existingVariants.length > 0 
      ? existingVariants 
      : [
          { variantId: 'control', name: 'Control', modifications: [], isControl: true },
          { variantId: 'variant_a', name: 'Variant A', modifications: [], isControl: false }
        ]
  );
  const [selectedTool, setSelectedTool] = useState<'pointer' | 'text' | 'color' | 'image' | 'move'>('pointer');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [history, setHistory] = useState<VariantConfiguration[][]>([variants]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showElementInspector, setShowElementInspector] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Initialize iframe and set up event listeners
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    if (iframeRef.current?.contentDocument) {
      const doc = iframeRef.current.contentDocument;
      
      // Inject CSS for highlighting elements
      const style = doc.createElement('style');
      style.textContent = `
        .visual-editor-highlight {
          outline: 2px solid #3B82F6 !important;
          outline-offset: 2px !important;
          position: relative !important;
        }
        .visual-editor-selected {
          outline: 2px solid #EF4444 !important;
          outline-offset: 2px !important;
          background-color: rgba(239, 68, 68, 0.1) !important;
        }
        .visual-editor-overlay {
          position: absolute;
          pointer-events: none;
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid #3B82F6;
          z-index: 9999;
        }
      `;
      doc.head.appendChild(style);

      // Add event listeners for element interaction
      doc.addEventListener('mouseover', handleElementHover);
      doc.addEventListener('mouseout', handleElementHoverOut);
      doc.addEventListener('click', handleElementClick);
      doc.addEventListener('contextmenu', handleElementRightClick);
    }
  }, []);

  // Handle element hover
  const handleElementHover = useCallback((event: MouseEvent) => {
    if (selectedTool === 'pointer') {
      const target = event.target as HTMLElement;
      if (target && target.tagName !== 'BODY' && target.tagName !== 'HTML') {
        target.classList.add('visual-editor-highlight');
      }
    }
  }, [selectedTool]);

  // Handle element hover out
  const handleElementHoverOut = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target) {
      target.classList.remove('visual-editor-highlight');
    }
  }, []);

  // Handle element click
  const handleElementClick = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    if (target && target.tagName !== 'BODY' && target.tagName !== 'HTML') {
      selectElement(target);
    }
  }, []);

  // Handle element right click
  const handleElementRightClick = useCallback((event: MouseEvent) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    if (target) {
      selectElement(target);
      setShowElementInspector(true);
    }
  }, []);

  // Select an element
  const selectElement = useCallback((element: HTMLElement) => {
    // Clear previous selection
    if (iframeRef.current?.contentDocument) {
      const doc = iframeRef.current.contentDocument;
      doc.querySelectorAll('.visual-editor-selected').forEach(el => {
        el.classList.remove('visual-editor-selected');
      });
    }

    // Select new element
    element.classList.add('visual-editor-selected');
    const elementId = generateElementId(element);
    setSelectedElement(elementId);
    
    // Store element reference for modifications
    element.dataset.visualEditorId = elementId;
  }, []);

  // Generate unique ID for element
  const generateElementId = (element: HTMLElement): string => {
    const tagName = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).filter(cls => !cls.startsWith('visual-editor')).join('.');
    const id = element.id;
    const text = element.textContent?.slice(0, 20).replace(/\s+/g, '-');
    
    return `${tagName}${id ? `#${id}` : ''}${classes ? `.${classes}` : ''}${text ? `[${text}]` : ''}`;
  };

  // Generate CSS selector for element
  const generateSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;
    
    const path = [];
    let current = element;
    
    while (current && current !== iframeRef.current?.contentDocument?.body) {
      let selector = current.tagName.toLowerCase();
      
      if (current.className) {
        const classes = Array.from(current.classList)
          .filter(cls => !cls.startsWith('visual-editor'))
          .join('.');
        if (classes) selector += `.${classes}`;
      }
      
      // Add nth-child if needed
      const siblings = Array.from(current.parentNode?.children || [])
        .filter(child => child.tagName === current.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      current = current.parentNode as HTMLElement;
    }
    
    return path.join(' > ');
  };

  // Add modification to current variant
  const addModification = (modification: Omit<ElementModification, 'id'>) => {
    const newModification: ElementModification = {
      id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...modification
    };

    const newVariants = [...variants];
    newVariants[currentVariant] = {
      ...newVariants[currentVariant],
      modifications: [...newVariants[currentVariant].modifications, newModification]
    };

    saveToHistory(newVariants);
    setVariants(newVariants);
    applyModifications(newVariants[currentVariant].modifications);
  };

  // Apply modifications to the iframe
  const applyModifications = (modifications: ElementModification[]) => {
    if (!iframeRef.current?.contentDocument) return;

    const doc = iframeRef.current.contentDocument;
    
    modifications.forEach(mod => {
      const elements = doc.querySelectorAll(mod.selector);
      elements.forEach(element => {
        const el = element as HTMLElement;
        
        switch (mod.type) {
          case 'text':
            el.textContent = mod.newValue;
            break;
          case 'color':
            el.style.color = mod.newValue;
            break;
          case 'background':
            el.style.backgroundColor = mod.newValue;
            break;
          case 'image':
            if (el.tagName === 'IMG') {
              (el as HTMLImageElement).src = mod.newValue;
            } else {
              el.style.backgroundImage = `url(${mod.newValue})`;
            }
            break;
          case 'visibility':
            el.style.display = mod.newValue === 'hidden' ? 'none' : '';
            break;
        }
      });
    });
  };

  // Save current state to history
  const saveToHistory = (newVariants: VariantConfiguration[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newVariants);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo last action
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setVariants(history[newIndex]);
      applyModifications(history[newIndex][currentVariant].modifications);
    }
  };

  // Redo last undone action
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setVariants(history[newIndex]);
      applyModifications(history[newIndex][currentVariant].modifications);
    }
  };

  // Switch to different variant
  const switchVariant = (variantIndex: number) => {
    setCurrentVariant(variantIndex);
    applyModifications(variants[variantIndex].modifications);
  };

  // Add new variant
  const addVariant = () => {
    const newVariant: VariantConfiguration = {
      variantId: `variant_${String.fromCharCode(65 + variants.length - 1)}`,
      name: `Variant ${String.fromCharCode(65 + variants.length - 1)}`,
      modifications: [],
      isControl: false
    };
    
    const newVariants = [...variants, newVariant];
    saveToHistory(newVariants);
    setVariants(newVariants);
    setCurrentVariant(newVariants.length - 1);
  };

  // Delete variant
  const deleteVariant = (variantIndex: number) => {
    if (variants.length <= 2 || variants[variantIndex].isControl) return;
    
    const newVariants = variants.filter((_, index) => index !== variantIndex);
    saveToHistory(newVariants);
    setVariants(newVariants);
    if (currentVariant >= newVariants.length) {
      setCurrentVariant(0);
    }
  };

  // Tool handlers
  const tools = [
    { 
      id: 'pointer', 
      icon: MousePointer, 
      label: 'Select', 
      action: () => setSelectedTool('pointer') 
    },
    { 
      id: 'text', 
      icon: Type, 
      label: 'Edit Text', 
      action: () => setSelectedTool('text') 
    },
    { 
      id: 'color', 
      icon: Palette, 
      label: 'Change Colors', 
      action: () => setSelectedTool('color') 
    },
    { 
      id: 'image', 
      icon: Image, 
      label: 'Change Images', 
      action: () => setSelectedTool('image') 
    },
    { 
      id: 'move', 
      icon: Move, 
      label: 'Move Elements', 
      action: () => setSelectedTool('move') 
    }
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold text-gray-900">Visual Experiment Editor</h1>
            <div className="text-sm text-gray-500">{targetUrl}</div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Undo className="h-4 w-4 mr-1" />
              Undo
            </button>
            
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Redo className="h-4 w-4 mr-1" />
              Redo
            </button>
            
            <button
              onClick={() => onSave(variants)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Experiment
            </button>
            
            <button
              onClick={onCancel}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Left Sidebar - Tools */}
        <div className="w-64 bg-white border-r border-gray-200">
          {/* Tools */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Tools</h3>
            <div className="space-y-2">
              {tools.map(tool => (
                <button
                  key={tool.id}
                  onClick={tool.action}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    selectedTool === tool.id
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                      : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                  } border`}
                >
                  <tool.icon className="h-4 w-4 mr-2" />
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">Variants</h3>
              <button
                onClick={addVariant}
                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Add
              </button>
            </div>
            
            <div className="space-y-2">
              {variants.map((variant, index) => (
                <div
                  key={variant.variantId}
                  className={`flex items-center justify-between p-2 rounded-md border transition-colors ${
                    currentVariant === index
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <button
                    onClick={() => switchVariant(index)}
                    className="flex-1 text-left"
                  >
                    <div className="text-sm font-medium text-gray-900">{variant.name}</div>
                    <div className="text-xs text-gray-500">
                      {variant.modifications.length} modifications
                      {variant.isControl && ' (Control)'}
                    </div>
                  </button>
                  
                  {!variant.isControl && variants.length > 2 && (
                    <button
                      onClick={() => deleteVariant(index)}
                      className="text-gray-400 hover:text-red-500 ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Modifications */}
          <div className="p-4 border-t border-gray-200 flex-1 overflow-auto">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Modifications ({variants[currentVariant]?.modifications.length || 0})
            </h3>
            
            <div className="space-y-2">
              {variants[currentVariant]?.modifications.map((mod, index) => (
                <div key={mod.id} className="bg-gray-50 p-2 rounded text-xs">
                  <div className="font-medium text-gray-900">{mod.description}</div>
                  <div className="text-gray-500 mt-1">
                    {mod.originalValue} → {mod.newValue}
                  </div>
                  <button
                    onClick={() => {
                      const newVariants = [...variants];
                      newVariants[currentVariant].modifications = 
                        newVariants[currentVariant].modifications.filter((_, i) => i !== index);
                      saveToHistory(newVariants);
                      setVariants(newVariants);
                      applyModifications(newVariants[currentVariant].modifications);
                    }}
                    className="text-red-500 hover:text-red-700 mt-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              {variants[currentVariant]?.modifications.length === 0 && (
                <div className="text-sm text-gray-500 italic">
                  No modifications yet. Click on elements to start editing.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Preview */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <div className="mt-2 text-sm text-gray-600">Loading preview...</div>
              </div>
            </div>
          )}
          
          <iframe
            ref={iframeRef}
            src={targetUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            title="Visual Editor Preview"
          />
          
          <div
            ref={overlayRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 999 }}
          />
        </div>

        {/* Element Inspector Panel */}
        {showElementInspector && selectedElement && (
          <ElementInspectorPanel
            elementId={selectedElement}
            onClose={() => setShowElementInspector(false)}
            onModify={(modification) => {
              addModification(modification);
              setShowElementInspector(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

// Element Inspector Panel Component
const ElementInspectorPanel: React.FC<{
  elementId: string;
  onClose: () => void;
  onModify: (modification: Omit<ElementModification, 'id'>) => void;
}> = ({ elementId, onClose, onModify }) => {
  const [activeTab, setActiveTab] = useState('text');
  const [textValue, setTextValue] = useState('');
  const [colorValue, setColorValue] = useState('#000000');
  const [backgroundValue, setBackgroundValue] = useState('#ffffff');
  const [imageValue, setImageValue] = useState('');

  const tabs = [
    { id: 'text', label: 'Text', icon: Type },
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'images', label: 'Images', icon: Image },
    { id: 'layout', label: 'Layout', icon: Layout }
  ];

  const handleTextChange = () => {
    onModify({
      elementId,
      type: 'text',
      originalValue: '', // Would get from element
      newValue: textValue,
      selector: `[data-visual-editor-id="${elementId}"]`,
      description: `Change text to "${textValue}"`
    });
  };

  const handleColorChange = () => {
    onModify({
      elementId,
      type: 'color',
      originalValue: '', // Would get from element
      newValue: colorValue,
      selector: `[data-visual-editor-id="${elementId}"]`,
      description: `Change text color to ${colorValue}`
    });
  };

  const handleBackgroundChange = () => {
    onModify({
      elementId,
      type: 'background',
      originalValue: '', // Would get from element
      newValue: backgroundValue,
      selector: `[data-visual-editor-id="${elementId}"]`,
      description: `Change background color to ${backgroundValue}`
    });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Element Inspector</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate">{elementId}</div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-3 w-3 mr-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-4 overflow-auto">
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Text Content
              </label>
              <textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                rows={3}
                placeholder="Enter new text..."
              />
              <button
                onClick={handleTextChange}
                className="mt-2 w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Apply Text Change
              </button>
            </div>
          </div>
        )}

        {activeTab === 'colors' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Text Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={colorValue}
                  onChange={(e) => setColorValue(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <button
                onClick={handleColorChange}
                className="mt-2 w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Apply Color Change
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Background Color
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={backgroundValue}
                  onChange={(e) => setBackgroundValue(e.target.value)}
                  className="w-8 h-8 rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={backgroundValue}
                  onChange={(e) => setBackgroundValue(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <button
                onClick={handleBackgroundChange}
                className="mt-2 w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Apply Background Change
              </button>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Image URL
              </label>
              <input
                type="text"
                value={imageValue}
                onChange={(e) => setImageValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="https://example.com/image.jpg"
              />
              <button
                onClick={() => onModify({
                  elementId,
                  type: 'image',
                  originalValue: '',
                  newValue: imageValue,
                  selector: `[data-visual-editor-id="${elementId}"]`,
                  description: `Change image to ${imageValue}`
                })}
                className="mt-2 w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Apply Image Change
              </button>
            </div>
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Layout modifications coming soon...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VisualExperimentEditor;