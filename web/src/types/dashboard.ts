export type CabinStatus = 'normal' | 'warning' | 'error';
export type AlertType = 'info' | 'warning' | 'error';
export type CabinControlKey = 'fan' | 'heater' | 'light';

export interface CabinControls {
  fan: boolean;
  heater: boolean;
  light: boolean;
}

export interface CabinRecord {
  id: string;
  status: CabinStatus;
  temperature: number;
  humidity: number;
  airQuality: number;
  heartRate: number;
  posture: string;
  emotion: string;
  healthTrend: string;
  controls: CabinControls;
}

export interface PetRecord {
  id: string;
  name: string;
  breed: string;
  age: number;
  gender: 'male' | 'female';
  weight: number;
  owner: string;
  contact: string;
  medicalHistory: string[];
  specialNeeds: string;
  arrivalDate: string;
  status: 'active' | 'completed';
  cabinId: string | null;
}

export interface AlertRecord {
  id: string;
  time: string;
  message: string;
  type: AlertType;
  cabinId: string;
  handled: boolean;
}

export const initialCabins: CabinRecord[] = [
  {
    id: 'C-01',
    status: 'normal',
    temperature: 22.5,
    humidity: 55,
    airQuality: 85,
    heartRate: 120,
    posture: '站立',
    emotion: '平静',
    healthTrend: '正常',
    controls: {
      fan: false,
      heater: false,
      light: true
    }
  },
  {
    id: 'C-02',
    status: 'warning',
    temperature: 28.0,
    humidity: 65,
    airQuality: 70,
    heartRate: 140,
    posture: '卧躺',
    emotion: '焦虑',
    healthTrend: '短期压力升高',
    controls: {
      fan: true,
      heater: false,
      light: true
    }
  },
  {
    id: 'C-03',
    status: 'normal',
    temperature: 21.0,
    humidity: 50,
    airQuality: 90,
    heartRate: 115,
    posture: '活动',
    emotion: '兴奋',
    healthTrend: '正常',
    controls: {
      fan: false,
      heater: false,
      light: true
    }
  }
];

export const initialPets: PetRecord[] = [
  {
    id: 'P001',
    name: '小白',
    breed: '拉布拉多',
    age: 2,
    gender: 'male',
    weight: 25.5,
    owner: '张先生',
    contact: '13812345678',
    medicalHistory: ['2026-01-15 疫苗接种', '2026-03-20 体检'],
    specialNeeds: '无特殊需求',
    arrivalDate: '2026-04-01',
    status: 'active',
    cabinId: 'C-01'
  },
  {
    id: 'P002',
    name: '咪咪',
    breed: '英短',
    age: 1,
    gender: 'female',
    weight: 3.2,
    owner: '李女士',
    contact: '13987654321',
    medicalHistory: ['2026-02-10 疫苗接种'],
    specialNeeds: '对海鲜过敏',
    arrivalDate: '2026-04-03',
    status: 'active',
    cabinId: 'C-02'
  },
  {
    id: 'P003',
    name: '大黄',
    breed: '金毛',
    age: 3,
    gender: 'male',
    weight: 30.0,
    owner: '王女士',
    contact: '13765432198',
    medicalHistory: ['2026-01-05 疫苗接种', '2026-02-28 体检', '2026-03-15 驱虫'],
    specialNeeds: '需要每日散步',
    arrivalDate: '2026-04-05',
    status: 'active',
    cabinId: 'C-03'
  }
];

export const initialAlerts: AlertRecord[] = [
  {
    id: 'A001',
    time: '2026-04-09 10:00:00',
    message: 'AI 识别到 C-02 宠物焦虑，建议优先安抚。',
    type: 'warning',
    cabinId: 'C-02',
    handled: false
  },
  {
    id: 'A002',
    time: '2026-04-09 09:45:00',
    message: 'STM32 已完成降温，C-02 温度正在恢复。',
    type: 'info',
    cabinId: 'C-02',
    handled: true
  },
  {
    id: 'A003',
    time: '2026-04-09 09:30:00',
    message: 'LSTM 模型复核 C-01 心率，当前状态正常。',
    type: 'info',
    cabinId: 'C-01',
    handled: true
  },
  {
    id: 'A004',
    time: '2026-04-09 09:15:00',
    message: 'C-03 空气质量短时下降，系统已自动通风。',
    type: 'warning',
    cabinId: 'C-03',
    handled: false
  }
];

const cabinTemplates: Array<Omit<CabinRecord, 'id' | 'status'>> = [
  {
    temperature: 23.1,
    humidity: 54,
    airQuality: 88,
    heartRate: 116,
    posture: '巡视',
    emotion: '平静',
    healthTrend: '正常',
    controls: {
      fan: false,
      heater: false,
      light: true
    }
  },
  {
    temperature: 24.6,
    humidity: 58,
    airQuality: 81,
    heartRate: 122,
    posture: '趴卧',
    emotion: '放松',
    healthTrend: '平稳',
    controls: {
      fan: false,
      heater: false,
      light: true
    }
  },
  {
    temperature: 26.8,
    humidity: 61,
    airQuality: 76,
    heartRate: 136,
    posture: '走动',
    emotion: '兴奋',
    healthTrend: '建议关注活动量',
    controls: {
      fan: true,
      heater: false,
      light: true
    }
  }
];

const petTemplates: Array<Omit<PetRecord, 'id' | 'arrivalDate' | 'status' | 'cabinId'>> = [
  {
    name: '奶糖',
    breed: '布偶猫',
    age: 2,
    gender: 'female',
    weight: 4.6,
    owner: '赵女士',
    contact: '13610293847',
    medicalHistory: ['2026-03-18 疫苗加强', '2026-04-02 日常检查'],
    specialNeeds: '需要安静环境'
  },
  {
    name: '可乐',
    breed: '柴犬',
    age: 1,
    gender: 'male',
    weight: 11.8,
    owner: '周先生',
    contact: '13566778899',
    medicalHistory: ['2026-02-11 疫苗接种', '2026-03-27 驱虫'],
    specialNeeds: '午后需要短时活动'
  },
  {
    name: '栗子',
    breed: '柯基',
    age: 4,
    gender: 'female',
    weight: 12.3,
    owner: '孙女士',
    contact: '18855667744',
    medicalHistory: ['2026-01-22 口腔检查', '2026-03-09 体重复查'],
    specialNeeds: '注意控制零食'
  }
];

export const getCurrentDate = () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const getCurrentDateTime = () => {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const hours = String(currentDate.getHours()).padStart(2, '0');
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');
  const seconds = String(currentDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const deriveCabinStatus = (metrics: Pick<CabinRecord, 'temperature' | 'airQuality'>): CabinStatus => {
  if (metrics.temperature >= 30 || metrics.airQuality <= 60) {
    return 'error';
  }

  if (metrics.temperature >= 27 || metrics.airQuality <= 75) {
    return 'warning';
  }

  return 'normal';
};

const getNextCabinId = (cabins: CabinRecord[]) => {
  const maxId = cabins.reduce((max, cabin) => {
    const value = Number.parseInt(cabin.id.slice(2), 10);
    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 0);

  return `C-${String(maxId + 1).padStart(2, '0')}`;
};

const getNextPetId = (pets: PetRecord[]) => {
  const maxId = pets.reduce((max, pet) => {
    const value = Number.parseInt(pet.id.slice(1), 10);
    return Number.isNaN(value) ? max : Math.max(max, value);
  }, 0);

  return `P${String(maxId + 1).padStart(3, '0')}`;
};

export const buildCabinRecord = (cabins: CabinRecord[]) => {
  const template = cabinTemplates[cabins.length % cabinTemplates.length];
  const nextCabin = {
    ...template,
    id: getNextCabinId(cabins)
  };

  return {
    ...nextCabin,
    status: deriveCabinStatus(nextCabin)
  };
};

export const buildPetRecord = (pets: PetRecord[], cabinId: string | null) => {
  const template = petTemplates[pets.length % petTemplates.length];

  return {
    ...template,
    id: getNextPetId(pets),
    arrivalDate: getCurrentDate(),
    status: 'active' as const,
    cabinId
  };
};

export const buildDeviceBundle = (cabins: CabinRecord[], pets: PetRecord[]) => {
  const cabin = buildCabinRecord(cabins);
  const pet = buildPetRecord(pets, cabin.id);

  return { cabin, pet };
};

export interface DeviceInsertOption {
  id: string;
  name: string;
  nodeAddress: string;
  ip: string;
  zone: string;
  firmwareVersion: string;
  heartbeatTime: string;
  signalStrength: string;
  cabin: CabinRecord;
  pet: PetRecord;
}

export const deviceInsertOptions: DeviceInsertOption[] = [
  {
    id: 'C-04',
    name: 'MoodPaws Edge 04',
    nodeAddress: 'Edge-C-04',
    ip: '192.168.1.104',
    zone: '\u4e1c\u4fa7\u6052\u6e29\u533a',
    firmwareVersion: 'FW 2.4.8',
    heartbeatTime: '2026-04-14 09:42:18',
    signalStrength: '-53 dBm',
    cabin: {
      id: 'C-04',
      status: 'normal',
      temperature: 23.4,
      humidity: 56,
      airQuality: 87,
      heartRate: 118,
      posture: '\u4f0f\u5367',
      emotion: '\u5b89\u5fc3',
      healthTrend: '\u72b6\u6001\u5e73\u7a33',
      controls: {
        fan: false,
        heater: false,
        light: true
      }
    },
    pet: {
      id: 'P004',
      name: '\u5976\u7cd5',
      breed: '\u5e03\u5076\u732b',
      age: 2,
      gender: 'female',
      weight: 4.8,
      owner: '\u8d75\u5973\u58eb',
      contact: '13610293847',
      medicalHistory: ['2026-03-18 \u75ab\u82d7\u52a0\u5f3a', '2026-04-02 \u65e5\u5e38\u4f53\u68c0'],
      specialNeeds: '\u9700\u8981\u5b89\u9759\u73af\u5883',
      arrivalDate: '2026-04-14',
      status: 'active',
      cabinId: 'C-04'
    }
  },
  {
    id: 'C-05',
    name: 'MoodPaws Edge 05',
    nodeAddress: 'Edge-C-05',
    ip: '192.168.1.105',
    zone: '\u897f\u4fa7\u89c2\u62a4\u533a',
    firmwareVersion: 'FW 2.5.1',
    heartbeatTime: '2026-04-14 09:44:07',
    signalStrength: '-49 dBm',
    cabin: {
      id: 'C-05',
      status: 'normal',
      temperature: 24.1,
      humidity: 57,
      airQuality: 84,
      heartRate: 124,
      posture: '\u7ad9\u7acb',
      emotion: '\u597d\u5947',
      healthTrend: '\u6d3b\u52a8\u91cf\u826f\u597d',
      controls: {
        fan: false,
        heater: false,
        light: true
      }
    },
    pet: {
      id: 'P005',
      name: '\u53ef\u53ef',
      breed: '\u67f4\u72ac',
      age: 1,
      gender: 'male',
      weight: 12.1,
      owner: '\u5468\u5148\u751f',
      contact: '13566778899',
      medicalHistory: ['2026-02-11 \u75ab\u82d7\u63a5\u79cd', '2026-03-27 \u9a71\u866b'],
      specialNeeds: '\u6bcf\u5929\u4e0b\u5348\u9700\u8981\u77ed\u65f6\u6d3b\u52a8',
      arrivalDate: '2026-04-14',
      status: 'active',
      cabinId: 'C-05'
    }
  },
  {
    id: 'C-06',
    name: 'MoodPaws Edge 06',
    nodeAddress: 'Edge-C-06',
    ip: '192.168.1.106',
    zone: '\u5317\u4fa7\u6062\u590d\u533a',
    firmwareVersion: 'FW 2.5.3',
    heartbeatTime: '2026-04-14 09:46:32',
    signalStrength: '-58 dBm',
    cabin: {
      id: 'C-06',
      status: 'warning',
      temperature: 26.5,
      humidity: 63,
      airQuality: 76,
      heartRate: 132,
      posture: '\u7f13\u6162\u884c\u8d70',
      emotion: '\u8b66\u89c9',
      healthTrend: '\u5efa\u8bae\u7ee7\u7eed\u89c2\u5bdf',
      controls: {
        fan: true,
        heater: false,
        light: true
      }
    },
    pet: {
      id: 'P006',
      name: '\u6817\u5b50',
      breed: '\u67ef\u57fa',
      age: 4,
      gender: 'female',
      weight: 12.3,
      owner: '\u5b59\u5973\u58eb',
      contact: '18855667744',
      medicalHistory: ['2026-01-22 \u53e3\u8154\u68c0\u67e5', '2026-03-09 \u4f53\u91cd\u590d\u67e5'],
      specialNeeds: '\u6ce8\u610f\u63a7\u5236\u96f6\u98df',
      arrivalDate: '2026-04-14',
      status: 'active',
      cabinId: 'C-06'
    }
  },
  {
    id: 'C-07',
    name: 'MoodPaws Edge 07',
    nodeAddress: 'Edge-C-07',
    ip: '192.168.1.107',
    zone: '\u5357\u4fa7\u660e\u4eae\u533a',
    firmwareVersion: 'FW 2.5.6',
    heartbeatTime: '2026-04-14 09:49:55',
    signalStrength: '-46 dBm',
    cabin: {
      id: 'C-07',
      status: 'normal',
      temperature: 22.8,
      humidity: 53,
      airQuality: 91,
      heartRate: 116,
      posture: '\u8e72\u5750',
      emotion: '\u653e\u677e',
      healthTrend: '\u6570\u636e\u7a33\u5b9a',
      controls: {
        fan: false,
        heater: false,
        light: true
      }
    },
    pet: {
      id: 'P007',
      name: '\u7cdc\u7cdc',
      breed: '\u94f6\u6e10\u5c42',
      age: 2,
      gender: 'female',
      weight: 4.1,
      owner: '\u9648\u5148\u751f',
      contact: '13901234567',
      medicalHistory: ['2026-02-06 \u75ab\u82d7\u52a0\u5f3a', '2026-03-21 \u809a\u80c3\u8c03\u7406'],
      specialNeeds: '\u63a7\u5236\u6362\u7cae\u8282\u594f',
      arrivalDate: '2026-04-14',
      status: 'active',
      cabinId: 'C-07'
    }
  }
];

export const cloneDeviceInsertBundle = (option: DeviceInsertOption) => ({
  cabin: {
    ...option.cabin,
    controls: {
      ...option.cabin.controls
    }
  },
  pet: {
    ...option.pet,
    medicalHistory: [...option.pet.medicalHistory]
  }
});
