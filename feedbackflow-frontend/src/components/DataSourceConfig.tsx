'use client';

import { useState } from 'react';
import { Plus, MessageCircle, FileText, Globe, Trash2, Settings } from 'lucide-react';

interface DataSource {
  id: string;
  name: string;
  type: 'reddit' | 'file' | 'api';
  status: 'active' | 'inactive' | 'error';
  lastSync: string;
  config: Record<string, unknown>;
}

interface DataSourceConfigProps {
  sources?: DataSource[];
  onAddSource?: (source: Omit<DataSource, 'id' | 'lastSync'>) => void;
  onRemoveSource?: (id: string) => void;
  onUpdateSource?: (id: string, updates: Partial<DataSource>) => void;
}

export function DataSourceConfig({ 
  sources = [], 
  onAddSource,
  onRemoveSource,
  onUpdateSource 
}: DataSourceConfigProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState<{
    name: string;
    type: 'reddit' | 'file' | 'api';
    config: Record<string, unknown>;
  }>({
    name: '',
    type: 'reddit',
    config: {}
  });
  const [processing, setProcessing] = useState<string | null>(null);

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'reddit':
        return <MessageCircle className="h-5 w-5 text-orange-500" />;
      case 'file':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'api':
        return <Globe className="h-5 w-5 text-green-500" />;
      default:
        return <Settings className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name.trim()) return;

    setProcessing('adding');
    
    try {
      // Configure based on source type
      let config = {};
      if (newSource.type === 'reddit') {
        config = { subreddit: newSource.name };
      }

      const sourceData = {
        name: newSource.name,
        type: newSource.type,
        status: 'active' as const,
        config
      };

      if (onAddSource) {
        await onAddSource(sourceData);
      }

      // Trigger analysis for the new source
      await fetch('http://localhost:3001/api/feedback/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          source: newSource.type, 
          query: newSource.name 
        })
      });

      setNewSource({ name: '', type: 'reddit', config: {} });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding source:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleRemoveSource = async (id: string) => {
    if (!confirm('Are you sure you want to remove this data source?')) return;

    setProcessing(id);
    try {
      if (onRemoveSource) {
        await onRemoveSource(id);
      }
    } catch (error) {
      console.error('Error removing source:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleAnalyzeSource = async (source: DataSource) => {
    setProcessing(source.id);
    
    try {
      const response = await fetch('http://localhost:3001/api/feedback/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          source: source.type, 
          query: source.type === 'reddit' ? source.config.subreddit : source.name
        })
      });

      if (response.ok) {
        if (onUpdateSource) {
          onUpdateSource(source.id, { 
            status: 'active',
            lastSync: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing source:', error);
      if (onUpdateSource) {
        onUpdateSource(source.id, { status: 'error' });
      }
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">Data Sources</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
        >
          <Plus className="h-4 w-4" />
          <span>Add Source</span>
        </button>
      </div>

      {/* Add Source Form */}
      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-md font-medium text-gray-900 mb-4">Add New Data Source</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source Type
              </label>
              <select
                value={newSource.type}
                onChange={(e) => setNewSource({ ...newSource, type: e.target.value as 'reddit' | 'file' | 'api' })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="reddit">Reddit</option>
                <option value="file">File Upload</option>
                <option value="api">API Endpoint</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {newSource.type === 'reddit' ? 'Subreddit' : 'Source Name'}
              </label>
              <input
                type="text"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                placeholder={
                  newSource.type === 'reddit' 
                    ? 'e.g., reactjs, webdev' 
                    : 'Enter source name'
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-end space-x-2">
              <button
                onClick={handleAddSource}
                disabled={!newSource.name.trim() || processing === 'adding'}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {processing === 'adding' ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sources List */}
      {sources.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <Settings className="mx-auto h-12 w-12" />
          </div>
          <p className="text-gray-500">No data sources configured</p>
          <p className="text-sm text-gray-400 mt-1">Add a source to start collecting feedback</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {getSourceIcon(source.type)}
                </div>
                
                <div>
                  <h4 className="text-md font-medium text-gray-900">{source.name}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                      {source.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      Last sync: {new Date(source.lastSync).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleAnalyzeSource(source)}
                  disabled={processing === source.id}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {processing === source.id ? 'Analyzing...' : 'Analyze'}
                </button>
                
                <button
                  onClick={() => handleRemoveSource(source.id)}
                  disabled={processing === source.id}
                  className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
