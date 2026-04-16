import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Link, Route, Routes } from 'react-router-dom';
import AlertCenter from './components/AlertCenter';
import CabinManagement from './components/CabinManagement';
import PetDigitalArchive from './components/PetDigitalArchive';
import SystemEdgeNodes from './components/SystemEdgeNodes';
import {
  AlertRecord,
  CabinControlKey,
  CabinRecord,
  cloneDeviceInsertBundle,
  deviceInsertOptions,
  deriveCabinStatus,
  getCurrentDateTime,
  initialAlerts,
  initialCabins,
  initialPets,
  PetRecord
} from './types/dashboard';

interface DashboardStats {
  deviceCount: number;
  petCount: number;
  aiProcessed: number;
  emotionTranslations: number;
  pendingAlerts: number;
}

interface DashboardProps {
  stats: DashboardStats;
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>{'\u5bc4\u517b\u8231\u7ba1\u7406'}</h2>
      </div>
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.deviceCount}</div>
          <div className="stat-label">{'\u5728\u7ebf\u8bbe\u5907\u6570'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.petCount}</div>
          <div className="stat-label">{'\u540c\u6b65\u5ba0\u7269\u6863\u6848'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.aiProcessed}</div>
          <div className="stat-label">{'AI \u5904\u7406\u7279\u5f81\u6570\u636e\u91cf'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.emotionTranslations}</div>
          <div className="stat-label">{'\u60c5\u7eea\u8f6c\u8bd1\u6b21\u6570'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pendingAlerts}</div>
          <div className="stat-label">{'\u5f85\u5904\u7406\u9884\u8b66'}</div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [cabins, setCabins] = useState<CabinRecord[]>(initialCabins);
  const [pets, setPets] = useState<PetRecord[]>(initialPets);
  const [alerts, setAlerts] = useState<AlertRecord[]>(initialAlerts);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCabins(prevCabins =>
        prevCabins.map(cabin => {
          const temperature = Number((cabin.temperature + (Math.random() - 0.5) * 0.5).toFixed(1));
          const humidity = Math.max(35, Math.min(75, Math.round(cabin.humidity + (Math.random() - 0.5) * 2)));
          const airQuality = Math.max(55, Math.min(98, Math.round(cabin.airQuality + (Math.random() - 0.5) * 3)));
          const heartRate = Math.max(95, Math.min(165, Math.round(cabin.heartRate + (Math.random() - 0.5) * 5)));

          return {
            ...cabin,
            temperature,
            humidity,
            airQuality,
            heartRate,
            status: deriveCabinStatus({ temperature, airQuality })
          };
        })
      );
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

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

  const availableDevices = useMemo(
    () => deviceInsertOptions.filter(device => !cabins.some(cabin => cabin.id === device.cabin.id)),
    [cabins]
  );

  const appendAlert = (nextAlert: Omit<AlertRecord, 'id' | 'time'>) => {
    const alertRecord: AlertRecord = {
      ...nextAlert,
      id: `A${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: getCurrentDateTime()
    };

    setAlerts(prevAlerts => [alertRecord, ...prevAlerts].slice(0, 20));
  };

  const handleAddDevice = (deviceId: string) => {
    const nextDevice = availableDevices.find(device => device.id === deviceId);

    if (!nextDevice) {
      return;
    }

    const nextBundle = cloneDeviceInsertBundle(nextDevice);

    setCabins(prevCabins => [...prevCabins, nextBundle.cabin]);
    setPets(prevPets => [...prevPets, nextBundle.pet]);

    appendAlert({
      cabinId: nextBundle.cabin.id,
      type: 'info',
      handled: false,
      message: `\u5df2\u63a5\u5165\u8bbe\u5907 ${nextBundle.cabin.id}\uff0c\u5e76\u540c\u6b65\u5ba0\u7269 ${nextBundle.pet.name} \u7684\u6863\u6848\u4fe1\u606f\u3002`
    });
  };

  const handleDeleteDevice = (cabinId: string) => {
    const targetPet = pets.find(pet => pet.cabinId === cabinId && pet.status === 'active') ?? null;

    setCabins(prevCabins => prevCabins.filter(cabin => cabin.id !== cabinId));
    setPets(prevPets => prevPets.filter(pet => pet.cabinId !== cabinId));
    setAlerts(prevAlerts => prevAlerts.filter(alert => alert.cabinId !== cabinId));

    appendAlert({
      cabinId: 'SYS',
      type: 'info',
      handled: false,
      message: targetPet
        ? `\u8bbe\u5907 ${cabinId} \u5df2\u79fb\u9664\uff0c\u5ba0\u7269 ${targetPet.name} \u7684\u540c\u6b65\u6863\u6848\u5df2\u4e00\u5e76\u4e0b\u7ebf\u3002`
        : `\u8bbe\u5907 ${cabinId} \u5df2\u79fb\u9664\uff0c\u76f8\u5173\u540c\u6b65\u6570\u636e\u5df2\u4e0b\u7ebf\u3002`
    });
  };

  const handleAlertHandled = (alertId: string) => {
    setAlerts(prevAlerts =>
      prevAlerts.map(alert => (alert.id === alertId ? { ...alert, handled: true } : alert))
    );
  };

  const handleControlToggle = (cabinId: string, controlType: CabinControlKey) => {
    const currentCabin = cabins.find(cabin => cabin.id === cabinId);

    if (!currentCabin) {
      return;
    }

    const nextEnabled = !currentCabin.controls[controlType];

    setCabins(prevCabins =>
      prevCabins.map(cabin => {
        if (cabin.id !== cabinId) {
          return cabin;
        }

        let temperature = cabin.temperature;
        let humidity = cabin.humidity;
        let airQuality = cabin.airQuality;

        if (controlType === 'fan') {
          temperature = Number((temperature + (nextEnabled ? -1.2 : 0.8)).toFixed(1));
          humidity = Math.max(35, Math.min(75, Math.round(humidity + (nextEnabled ? -4 : 2))));
          airQuality = Math.max(55, Math.min(98, Math.round(airQuality + (nextEnabled ? 10 : -4))));
        }

        if (controlType === 'heater') {
          temperature = Number((temperature + (nextEnabled ? 1.1 : -0.6)).toFixed(1));
        }

        if (controlType === 'light') {
          airQuality = Math.max(55, Math.min(98, Math.round(airQuality + (nextEnabled ? 1 : -1))));
        }

        return {
          ...cabin,
          controls: {
            ...cabin.controls,
            [controlType]: nextEnabled
          },
          temperature,
          humidity,
          airQuality,
          status: deriveCabinStatus({ temperature, airQuality })
        };
      })
    );

    const controlLabels: Record<CabinControlKey, string> = {
      fan: '\u901a\u98ce',
      heater: '\u52a0\u70ed',
      light: '\u7167\u660e'
    };

    appendAlert({
      cabinId,
      type: 'info',
      handled: false,
      message: `${cabinId} \u5df2${nextEnabled ? '\u5f00\u542f' : '\u5173\u95ed'}${controlLabels[controlType]}\uff0c\u5f53\u524d\u540c\u6b65\u5ba0\u7269\uff1a${
        petByCabinId.get(cabinId)?.name ?? '\u7a7a\u8231'
      }\u3002`
    });
  };

  const dashboardStats = useMemo<DashboardStats>(() => {
    const pendingAlertCount = alerts.filter(alert => !alert.handled).length;
    const emotionalCabins = cabins.filter(cabin => petByCabinId.has(cabin.id) && cabin.emotion !== '\u5e73\u9759').length;

    return {
      deviceCount: cabins.length,
      petCount: activePets.length,
      aiProcessed: cabins.length * 32 + alerts.length * 4,
      emotionTranslations: emotionalCabins * 18 + activePets.length * 6,
      pendingAlerts: pendingAlertCount
    };
  }, [activePets.length, alerts, cabins, petByCabinId]);

  return (
    <Router>
      <div className="app">
        <div className="header">
          <h1>{'MoodPaws \u5ba0\u7269\u5bc4\u517b\u76d1\u63a7\u7cfb\u7edf'}</h1>
          <p>{'\u5b9e\u65f6\u591a\u7ef4\u72b6\u6001\u76d1\u63a7\u4e0e\u786c\u4ef6\u95ed\u73af\u8fdc\u7a0b\u63a7\u5236'}</p>
        </div>

        <nav className="nav-menu">
          <ul>
            <li>
              <Link to="/">{'\u5bc4\u517b\u8231\u7ba1\u7406'}</Link>
            </li>
            <li>
              <Link to="/cabin-management">{'\u96c6\u4e2d\u76d1\u63a7\u5927\u5c4f'}</Link>
            </li>
            <li>
              <Link to="/pet-archive">{'\u5ba0\u7269\u6570\u5b57\u6863\u6848'}</Link>
            </li>
            <li>
              <Link to="/alert-center">{'\u9884\u8b66\u4e2d\u5fc3'}</Link>
            </li>
            <li>
              <Link to="/system-edge">{'\u7cfb\u7edf\u4e0e\u8fb9\u7f18\u8282\u70b9'}</Link>
            </li>
          </ul>
        </nav>

        <div className="content">
          <Routes>
            <Route path="/" element={<Dashboard stats={dashboardStats} />} />
            <Route
              path="/cabin-management"
              element={
                <CabinManagement
                  cabins={cabins}
                  pets={pets}
                  availableDevices={availableDevices}
                  onToggleControl={handleControlToggle}
                  onAddDevice={handleAddDevice}
                  onDeleteDevice={handleDeleteDevice}
                />
              }
            />
            <Route path="/pet-archive" element={<PetDigitalArchive pets={pets} cabins={cabins} />} />
            <Route path="/alert-center" element={<AlertCenter alerts={alerts} onHandleAlert={handleAlertHandled} />} />
            <Route path="/system-edge" element={<SystemEdgeNodes cabins={cabins} pets={pets} alerts={alerts} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
