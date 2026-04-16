import React from 'react';
import { AlertRecord } from '../types/dashboard';
import './AlertCenter.css';

interface AlertCenterProps {
  alerts: AlertRecord[];
  onHandleAlert: (alertId: string) => void;
}

const AlertCenter: React.FC<AlertCenterProps> = ({ alerts, onHandleAlert }) => {
  const pendingAlerts = alerts.filter(alert => !alert.handled);

  return (
    <div className="alert-center">
      <h2>预警中心</h2>
      <div className="alerts-container">
        <div className="alerts-header">
          <h3>待处理预警 {pendingAlerts.length}</h3>
        </div>
        <div className="alerts-list">
          {alerts.map(alert => (
            <div key={alert.id} className={`alert-item ${alert.type} ${alert.handled ? 'handled' : ''}`}>
              <div className="alert-time">{alert.time}</div>
              <div className="alert-message">{alert.message}</div>
              <div className="alert-cabin">{alert.cabinId}</div>
              {!alert.handled ? (
                <button type="button" className="handle-btn" onClick={() => onHandleAlert(alert.id)}>
                  处理
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlertCenter;
