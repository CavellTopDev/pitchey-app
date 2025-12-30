import React, { useState, useEffect } from 'react';
import { GripVertical, Save, X } from 'lucide-react';
import { useDragReorder } from '../../hooks/useUIActions';
import { toast } from 'react-hot-toast';

interface PipelineItem {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  description?: string;
}

interface DraggablePipelineProps {
  items: PipelineItem[];
  onUpdate?: (items: PipelineItem[]) => void;
  columns?: {
    key: string;
    title: string;
    color: string;
  }[];
}

export function DraggablePipeline({ 
  items: initialItems, 
  onUpdate,
  columns = [
    { key: 'pending', title: 'To Do', color: 'bg-gray-100' },
    { key: 'in_progress', title: 'In Progress', color: 'bg-blue-100' },
    { key: 'review', title: 'Review', color: 'bg-yellow-100' },
    { key: 'completed', title: 'Completed', color: 'bg-green-100' },
  ]
}: DraggablePipelineProps) {
  const {
    items,
    setItems,
    draggedItem,
    handleDragStart,
    handleDragOver,
    handleDrop,
    saveOrder,
    saving
  } = useDragReorder(initialItems, 'pipeline');

  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const hasChanged = JSON.stringify(items) !== JSON.stringify(initialItems);
    setHasChanges(hasChanged);
  }, [items, initialItems]);

  const handleColumnDrop = (columnKey: string) => {
    if (draggedItem) {
      const updatedItems = items.map(item => 
        item.id === draggedItem.id 
          ? { ...item, status: columnKey as PipelineItem['status'] }
          : item
      );
      setItems(updatedItems);
      
      if (onUpdate) {
        onUpdate(updatedItems);
      }
    }
    setDragOverColumn(null);
  };

  const handleCardDrop = (targetItem: PipelineItem, columnKey: string) => {
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    
    const newItems = [...items];
    const draggedIndex = newItems.findIndex(item => item.id === draggedItem.id);
    const targetIndex = newItems.findIndex(item => item.id === targetItem.id);
    
    if (draggedIndex !== -1) {
      // Remove dragged item
      const [removed] = newItems.splice(draggedIndex, 1);
      
      // Update status if moving to different column
      removed.status = columnKey as PipelineItem['status'];
      
      // Insert at new position
      const newTargetIndex = newItems.findIndex(item => item.id === targetItem.id);
      newItems.splice(newTargetIndex, 0, removed);
      
      setItems(newItems);
      if (onUpdate) {
        onUpdate(newItems);
      }
    }
  };

  const getItemsByColumn = (columnKey: string) => {
    return items.filter(item => item.status === columnKey);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handleSave = async () => {
    const result = await saveOrder();
    if (result.success) {
      setHasChanges(false);
    }
  };

  return (
    <div className="h-full">
      {/* Header with Save Button */}
      {hasChanges && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-yellow-800">You have unsaved changes</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setItems(initialItems);
                setHasChanges(false);
              }}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              disabled={saving}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-1"
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((column) => (
          <div
            key={column.key}
            className={`${column.color} rounded-lg p-4 min-h-[400px] ${
              dragOverColumn === column.key ? 'ring-2 ring-blue-500' : ''
            }`}
            onDragOver={(e) => {
              handleDragOver(e);
              setDragOverColumn(column.key);
            }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={() => handleColumnDrop(column.key)}
          >
            <h3 className="font-semibold text-gray-800 mb-3">
              {column.title} ({getItemsByColumn(column.key).length})
            </h3>

            <div className="space-y-2">
              {getItemsByColumn(column.key).map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(item)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleCardDrop(item, column.key)}
                  className={`bg-white rounded-lg p-3 shadow-sm cursor-move hover:shadow-md transition-shadow ${
                    draggedItem?.id === item.id ? 'opacity-50' : ''
                  }`}
                >
                  {/* Drag Handle */}
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                    
                    <div className="flex-1">
                      {/* Title */}
                      <h4 className="font-medium text-gray-900 text-sm mb-1">
                        {item.title}
                      </h4>
                      
                      {/* Description */}
                      {item.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-2 text-xs">
                        {/* Priority Badge */}
                        <span className={`px-2 py-0.5 rounded-full ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                        
                        {/* Due Date */}
                        {item.dueDate && (
                          <span className="text-gray-500">
                            {new Date(item.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        
                        {/* Assignee */}
                        {item.assignee && (
                          <span className="text-gray-500">
                            @{item.assignee}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Empty State */}
              {getItemsByColumn(column.key).length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  Drag items here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Drag and drop cards between columns or reorder within columns
      </div>
    </div>
  );
}

// Example component showing how to use the DraggablePipeline
export function ProductionPipelineExample() {
  const [pipelineItems, setPipelineItems] = useState<PipelineItem[]>([
    {
      id: '1',
      title: 'Script Review',
      status: 'pending',
      priority: 'high',
      assignee: 'john',
      dueDate: '2024-01-15',
      description: 'Review and approve final script changes'
    },
    {
      id: '2',
      title: 'Location Scouting',
      status: 'in_progress',
      priority: 'medium',
      assignee: 'sarah',
      dueDate: '2024-01-20',
      description: 'Find and secure filming locations'
    },
    {
      id: '3',
      title: 'Casting',
      status: 'in_progress',
      priority: 'high',
      assignee: 'mike',
      dueDate: '2024-01-18',
      description: 'Finalize lead roles casting'
    },
    {
      id: '4',
      title: 'Budget Approval',
      status: 'review',
      priority: 'high',
      assignee: 'lisa',
      dueDate: '2024-01-12',
      description: 'Get final budget approval from investors'
    },
    {
      id: '5',
      title: 'Equipment Rental',
      status: 'pending',
      priority: 'medium',
      assignee: 'tom',
      dueDate: '2024-01-25',
      description: 'Secure camera and lighting equipment'
    },
  ]);

  const handleUpdate = (updatedItems: PipelineItem[]) => {
    setPipelineItems(updatedItems);
    console.log('Pipeline updated:', updatedItems);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Production Pipeline</h2>
      <DraggablePipeline 
        items={pipelineItems} 
        onUpdate={handleUpdate}
      />
    </div>
  );
}