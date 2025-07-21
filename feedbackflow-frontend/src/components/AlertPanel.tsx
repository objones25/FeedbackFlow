'use client';

import { AlertTriangle, Info, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface AlertPanelProps {
  alerts: Alert[];
}

export function AlertPanel({ alerts = [] }: AlertPanelProps) {
  // Ensure alerts is always an array and filter out any invalid items
  const validAlerts = Array.isArray(alerts) ? alerts.filter(alert => 
    alert && 
    typeof alert === 'object' && 
    alert.id && 
    alert.title && 
    alert.message && 
    alert.timestamp
  ) : [];

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getAlertStyles = (type: Alert['type'], severity?: Alert['severity']) => {
    const baseStyles = 'border-l-4 p-4 rounded-r-lg';
    
    switch (type) {
      case 'error':
        return `${baseStyles} bg-red-50 border-red-400`;
      case 'warning':
        return severity === 'critical' || severity === 'high'
          ? `${baseStyles} bg-orange-50 border-orange-400`
          : `${baseStyles} bg-yellow-50 border-yellow-400`;
      case 'success':
        return `${baseStyles} bg-green-50 border-green-400`;
      case 'info':
      default:
        return `${baseStyles} bg-blue-50 border-blue-400`;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - alertTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getSeverityBadge = (severity?: Alert['severity']) => {
    if (!severity) return null;
    
    const styles = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[severity]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  if (validAlerts.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">System Alerts</h3>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <CheckCircle className="mx-auto h-12 w-12" />
          </div>
          <p className="text-gray-500">All systems operational</p>
          <p className="text-sm text-gray-400 mt-1">No alerts at this time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-800">System Alerts</h3>
        <span className="text-sm text-gray-500">{validAlerts.length} active</span>
      </div>
      
      <div className="space-y-4 max-h-80 overflow-y-auto">
        {validAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`${getAlertStyles(alert.type, alert.severity)} transition-all duration-200 hover:shadow-md`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3 mt-0.5">
                {getAlertIcon(alert.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {alert.title}
                  </h4>
                  <div className="flex items-center ml-2">
                    {alert.severity && (
                      <div className="mr-2">
                        {getSeverityBadge(alert.severity)}
                      </div>
                    )}
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {getTimeAgo(alert.timestamp)}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 leading-relaxed">
                  {alert.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {validAlerts.length > 5 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-150">
            View all alerts →
          </button>
        </div>
      )}
    </div>
  );
}
