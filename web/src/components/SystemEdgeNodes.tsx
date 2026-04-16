import React, { useMemo } from 'react';
import { AlertRecord, CabinRecord, PetRecord } from '../types/dashboard';
import './SystemEdgeNodes.css';

interface SystemEdgeNodesProps {
  cabins: CabinRecord[];
  pets: PetRecord[];
  alerts: AlertRecord[];
}

type EdgeNodeStatus = 'online' | 'warning';

const getNodeAddress = (cabinId: string) => `Edge-${cabinId}`;

const getNodeIp = (cabinId: string) => {
  const suffix = Number.parseInt(cabinId.replace(/\D/g, ''), 10);
  const host = Number.isNaN(suffix) ? 199 : 100 + suffix;

  return `192.168.1.${host}`;
};

const SystemEdgeNodes: React.FC<SystemEdgeNodesProps> = ({ cabins, pets, alerts }) => {
  const activePets = useMemo(() => pets.filter(pet => pet.status === 'active'), [pets]);

  const petByCabinId = useMemo(
    () =>
      new Map(
        activePets
          .filter(pet => pet.cabinId)
          .map(pet => [pet.cabinId as string, pet])
      ),
    [activePets]
  );

  const pendingAlertCabinIds = useMemo(
    () => new Set(alerts.filter(alert => !alert.handled).map(alert => alert.cabinId)),
    [alerts]
  );

  const latestTimeByCabinId = useMemo(() => {
    const latestTimes = new Map<string, string>();

    alerts.forEach(alert => {
      const previousTime = latestTimes.get(alert.cabinId);

      if (!previousTime || alert.time > previousTime) {
        latestTimes.set(alert.cabinId, alert.time);
      }
    });

    return latestTimes;
  }, [alerts]);

  const edgeNodes = useMemo(
    () =>
      cabins.map(cabin => {
        const assignedPet = petByCabinId.get(cabin.id) ?? null;
        const status: EdgeNodeStatus =
          cabin.status === 'error' || pendingAlertCabinIds.has(cabin.id) ? 'warning' : 'online';

        return {
          id: cabin.id,
          title: `设备节点 ${cabin.id}`,
          nodeAddress: getNodeAddress(cabin.id),
          ip: getNodeIp(cabin.id),
          status,
          petName: assignedPet?.name ?? '未关联宠物',
          lastTime: latestTimeByCabinId.get(cabin.id) ?? '暂无记录'
        };
      }),
    [cabins, latestTimeByCabinId, pendingAlertCabinIds, petByCabinId]
  );

  const systemStats = useMemo(
    () => ({
      totalNodes: edgeNodes.length,
      onlineNodes: edgeNodes.filter(node => node.status === 'online').length,
      warningNodes: edgeNodes.filter(node => node.status === 'warning').length,
      offlineNodes: 0
    }),
    [edgeNodes]
  );

  return (
    <div className="system-edge-nodes">
      <h2>系统与边缘节点</h2>

      <div className="system-overview">
        <h3>系统概览</h3>
        <div className="system-stats">
          <div className="stat-item">
            <div className="stat-value">{systemStats.totalNodes}</div>
            <div className="stat-label">设备节点数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{systemStats.onlineNodes}</div>
            <div className="stat-label">在线节点</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{systemStats.warningNodes}</div>
            <div className="stat-label">告警节点</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{systemStats.offlineNodes}</div>
            <div className="stat-label">离线节点</div>
          </div>
        </div>
      </div>

      <div className="edge-nodes">
        <h3>设备节点状态</h3>
        <div className="nodes-container">
          {edgeNodes.map(node => (
            <div key={node.id} className={`node-card ${node.status}`}>
              <div className="node-header">
                <h4>{node.title}</h4>
              </div>
              <div className="node-info">
                <div className="info-item">
                  <label>关联宠物</label>
                  <span>{node.petName}</span>
                </div>
                <div className="info-item">
                  <label>节点地址</label>
                  <span>{node.nodeAddress}</span>
                </div>
                <div className="info-item">
                  <label>IP 地址</label>
                  <span>{node.ip}</span>
                </div>
                <div className="info-item">
                  <label>最后时间</label>
                  <span>{node.lastTime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemEdgeNodes;
