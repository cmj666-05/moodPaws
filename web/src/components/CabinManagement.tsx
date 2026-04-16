import React, { useEffect, useMemo, useState } from 'react';
import { CabinControlKey, CabinRecord, DeviceInsertOption, PetRecord } from '../types/dashboard';
import './CabinManagement.css';

const FEED_POSITIONS: React.CSSProperties[] = [
  { left: '20%', top: '48%' },
  { left: '56%', top: '42%' },
  { left: '38%', top: '58%' },
  { left: '66%', top: '54%' }
];

const formatFeedTime = (date: Date) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);

interface CabinManagementProps {
  cabins: CabinRecord[];
  pets: PetRecord[];
  availableDevices: DeviceInsertOption[];
  onToggleControl: (cabinId: string, controlType: CabinControlKey) => void;
  onAddDevice: (deviceId: string) => void;
  onDeleteDevice: (cabinId: string) => void;
}

const CabinManagement: React.FC<CabinManagementProps> = ({
  cabins,
  pets,
  availableDevices,
  onToggleControl,
  onAddDevice,
  onDeleteDevice
}) => {
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isDevicePickerOpen, setIsDevicePickerOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(availableDevices[0]?.id ?? null);
  const [feedNow, setFeedNow] = useState(() => new Date());

  const petByCabinId = useMemo(
    () =>
      new Map(
        pets
          .filter(pet => pet.status === 'active' && pet.cabinId)
          .map(pet => [pet.cabinId as string, pet])
      ),
    [pets]
  );

  const selectedDevice = useMemo(
    () => availableDevices.find(device => device.id === selectedDeviceId) ?? availableDevices[0] ?? null,
    [availableDevices, selectedDeviceId]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFeedNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (availableDevices.length === 0) {
      setSelectedDeviceId(null);
      setIsDevicePickerOpen(false);
      return;
    }

    if (!selectedDeviceId || !availableDevices.some(device => device.id === selectedDeviceId)) {
      setSelectedDeviceId(availableDevices[0].id);
    }
  }, [availableDevices, selectedDeviceId]);

  const handleDeleteMode = () => {
    if (cabins.length === 0) {
      return;
    }

    setIsDevicePickerOpen(false);
    setIsDeleteMode(prevMode => !prevMode);
  };

  const handleDeleteTarget = (cabinId: string) => {
    onDeleteDevice(cabinId);
    setIsDeleteMode(false);
  };

  const handleOpenDevicePicker = () => {
    if (availableDevices.length === 0) {
      return;
    }

    setIsDeleteMode(false);
    setSelectedDeviceId(currentId => currentId ?? availableDevices[0].id);
    setIsDevicePickerOpen(true);
  };

  const handleCloseDevicePicker = () => {
    setIsDevicePickerOpen(false);
  };

  const handleConfirmDeviceInsert = () => {
    if (!selectedDevice) {
      return;
    }

    onAddDevice(selectedDevice.id);
    setIsDevicePickerOpen(false);
  };

  const feedTime = formatFeedTime(feedNow);

  return (
    <div className={`cabin-management ${isDeleteMode ? 'delete-mode' : ''}`.trim()}>
      <div className="archive-header">
        <h2>
          <button
            type="button"
            className="action-btn add"
            onClick={handleOpenDevicePicker}
            disabled={availableDevices.length === 0}
          >
            添加设备
          </button>
          集中监控大屏
          <button
            type="button"
            className={`action-btn delete ${isDeleteMode ? 'active' : ''}`.trim()}
            onClick={handleDeleteMode}
            disabled={cabins.length === 0}
          >
            {isDeleteMode ? '取消删除' : '删除设备'}
          </button>
        </h2>
      </div>

      <div className="monitoring-container">
        {cabins.map(cabin => {
          const assignedPet = petByCabinId.get(cabin.id) ?? null;
          const displayStatus: 'normal' | 'warning' | 'error' | 'idle' = assignedPet ? cabin.status : 'idle';
          const feedPosition =
            FEED_POSITIONS[Number.parseInt(cabin.id.replace(/\D/g, ''), 10) % FEED_POSITIONS.length] ?? FEED_POSITIONS[0];
          const statusLabel =
            displayStatus === 'normal'
              ? '正常'
              : displayStatus === 'warning'
                ? '警告'
                : displayStatus === 'error'
                  ? '异常'
                  : '空置';
          const feedSummary = assignedPet
            ? `${cabin.posture} / ${cabin.emotion}`
            : '暂无跟踪目标';
          const feedSignal =
            displayStatus === 'warning'
              ? '重点关注'
              : displayStatus === 'error'
                ? '告警升级'
                : assignedPet
                  ? '监控稳定'
                  : '等待接入';

          return (
            <div key={cabin.id} className="cabin-card">
              <div className="cabin-card-body">
                <div className="cabin-header">
                  <h3>{cabin.id}</h3>
                  <span className={`status ${displayStatus}`}>{statusLabel}</span>
                </div>

                <div className="cabin-occupant">
                  当前设备宠物：
                  <strong>{assignedPet ? `${assignedPet.name} / ${assignedPet.breed}` : '空舱待接入'}</strong>
                </div>

                <div className="sensor-data">
                  <div className="sensor-item">
                    <div className="sensor-value">{`${cabin.temperature}°C`}</div>
                    <div className="sensor-label">温度</div>
                  </div>
                  <div className="sensor-item">
                    <div className="sensor-value">{cabin.humidity}%</div>
                    <div className="sensor-label">湿度</div>
                  </div>
                  <div className="sensor-item">
                    <div className="sensor-value">{cabin.airQuality}</div>
                    <div className="sensor-label">空气质量</div>
                  </div>
                  <div className="sensor-item">
                    <div className="sensor-value">{assignedPet ? `${cabin.heartRate} BPM` : '--'}</div>
                    <div className="sensor-label">心率</div>
                  </div>
                </div>

                <div className="camera-section">
                  <div className={`camera-placeholder camera-feed ${displayStatus}`}>
                    <div className="camera-feed-topbar">
                      <div className={`camera-feed-badge ${assignedPet ? 'live' : 'standby'}`}>
                        <span className="camera-feed-dot" />
                        <span>{assignedPet ? 'LIVE' : 'STBY'}</span>
                      </div>
                      <span className="camera-feed-time">{feedTime}</span>
                    </div>

                    <div className="camera-feed-grid" />
                    <div className="camera-feed-noise" />
                    <div className="camera-feed-vignette" />

                    {assignedPet ? (
                      <>
                        <div className={`camera-subject ${displayStatus}`} style={feedPosition}>
                          <span className="camera-subject-core" />
                        </div>
                        <div className="camera-focus-ring" style={feedPosition} />
                        <div className="camera-trace trace-a" />
                        <div className="camera-trace trace-b" />
                        <div className="camera-pet-tag">{assignedPet.name}</div>
                      </>
                    ) : (
                      <div className="camera-feed-idle-state">
                        <span>等待新设备视频流</span>
                      </div>
                    )}

                    <div className="camera-feed-footer">
                      <span>{feedSummary}</span>
                      <span>{feedSignal}</span>
                    </div>
                    <div className="camera-scan-line" />
                  </div>
                  <div className="ai-status">
                    <div className="ai-item">
                      <div className="ai-value">{assignedPet ? cabin.posture : '待命'}</div>
                      <div className="ai-label">姿态</div>
                    </div>
                    <div className="ai-item">
                      <div className="ai-value">{assignedPet ? cabin.emotion : '待命'}</div>
                      <div className="ai-label">情绪</div>
                    </div>
                  </div>
                </div>

                <div className="health-trend">
                  <h4>健康趋势评估</h4>
                  <div className="health-value">{assignedPet ? cabin.healthTrend : '等待设备同步宠物信息'}</div>
                </div>

                <div className="control-section">
                  <h4>STM32 闭环控制</h4>
                  <div className="control-buttons">
                    <button
                      type="button"
                      className={`control-btn ${cabin.controls.fan ? 'active' : ''}`}
                      onClick={() => onToggleControl(cabin.id, 'fan')}
                    >
                      <span>通风</span>
                    </button>
                    <button
                      type="button"
                      className={`control-btn ${cabin.controls.heater ? 'active' : ''}`}
                      onClick={() => onToggleControl(cabin.id, 'heater')}
                    >
                      <span>加热</span>
                    </button>
                    <button
                      type="button"
                      className={`control-btn ${cabin.controls.light ? 'active' : ''}`}
                      onClick={() => onToggleControl(cabin.id, 'light')}
                    >
                      <span>照明</span>
                    </button>
                  </div>
                </div>
              </div>

              {isDeleteMode ? (
                <div className="card-delete-overlay">
                  <button
                    type="button"
                    className="card-delete-action"
                    onClick={() => handleDeleteTarget(cabin.id)}
                    aria-label={`delete-device-${cabin.id}`}
                  >
                    删除设备
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {isDevicePickerOpen ? (
        <div className="device-picker-backdrop" onClick={handleCloseDevicePicker}>
          <div
            className="device-picker-panel"
            onClick={event => {
              event.stopPropagation();
            }}
          >
            <div className="device-picker-header">
              <div>
                <div className="device-picker-kicker">设备接入</div>
                <h3>选择待接入设备</h3>
                <p>先选中设备，检查节点信息和同步档案，再确认接入。</p>
              </div>
              <button type="button" className="device-picker-close" onClick={handleCloseDevicePicker}>
                关闭
              </button>
            </div>

            <div className="device-picker-body">
              <div className="device-picker-list">
                {availableDevices.map(device => (
                  <button
                    key={device.id}
                    type="button"
                    className={`device-option-card ${selectedDevice?.id === device.id ? 'active' : ''}`.trim()}
                    onClick={() => setSelectedDeviceId(device.id)}
                  >
                    <div className="device-option-card-top">
                      <span className="device-option-chip">待接入</span>
                      <span className="device-option-signal">{device.signalStrength}</span>
                    </div>
                    <h4>{device.name}</h4>
                    <p>{device.zone}</p>
                    <div className="device-option-meta">
                      <span>{device.nodeAddress}</span>
                      <span>{device.ip}</span>
                    </div>
                  </button>
                ))}
              </div>

              {selectedDevice ? (
                <div className="device-detail-card">
                  <div className="device-detail-hero">
                    <div>
                      <div className="device-detail-eyebrow">已选设备</div>
                      <h4>{selectedDevice.name}</h4>
                    </div>
                    <span className="device-detail-pill">{selectedDevice.heartbeatTime}</span>
                  </div>

                  <div className="device-detail-grid">
                    <div className="device-detail-item">
                      <label>设备编号</label>
                      <span>{selectedDevice.id}</span>
                    </div>
                    <div className="device-detail-item">
                      <label>节点地址</label>
                      <span>{selectedDevice.nodeAddress}</span>
                    </div>
                    <div className="device-detail-item">
                      <label>IP 地址</label>
                      <span>{selectedDevice.ip}</span>
                    </div>
                    <div className="device-detail-item">
                      <label>安装区域</label>
                      <span>{selectedDevice.zone}</span>
                    </div>
                    <div className="device-detail-item">
                      <label>固件版本</label>
                      <span>{selectedDevice.firmwareVersion}</span>
                    </div>
                    <div className="device-detail-item">
                      <label>信号强度</label>
                      <span>{selectedDevice.signalStrength}</span>
                    </div>
                  </div>

                  <div className="device-profile-card">
                    <div className="device-profile-head">
                      <span className="device-profile-tag">同步宠物档案</span>
                      <strong>{selectedDevice.pet.name}</strong>
                    </div>
                    <div className="device-profile-grid">
                      <div className="device-profile-item">
                        <label>品种</label>
                        <span>{selectedDevice.pet.breed}</span>
                      </div>
                      <div className="device-profile-item">
                        <label>年龄</label>
                        <span>{`${selectedDevice.pet.age} 岁`}</span>
                      </div>
                      <div className="device-profile-item">
                        <label>主人</label>
                        <span>{selectedDevice.pet.owner}</span>
                      </div>
                      <div className="device-profile-item">
                        <label>联系方式</label>
                        <span>{selectedDevice.pet.contact}</span>
                      </div>
                    </div>
                    <div className="device-profile-note">
                      <span>特殊需求</span>
                      <strong>{selectedDevice.pet.specialNeeds}</strong>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="device-picker-footer">
              <div className="device-picker-selection">
                <span>即将接入</span>
                <strong>
                  {selectedDevice ? `${selectedDevice.cabin.id} / ${selectedDevice.pet.name}` : '请先选择设备'}
                </strong>
              </div>
              <div className="device-picker-actions">
                <button type="button" className="device-secondary-btn" onClick={handleCloseDevicePicker}>
                  取消
                </button>
                <button
                  type="button"
                  className="device-primary-btn"
                  onClick={handleConfirmDeviceInsert}
                  disabled={!selectedDevice}
                >
                  确认接入
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CabinManagement;
