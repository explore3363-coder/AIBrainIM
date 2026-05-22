export interface ProductionData {
  today: { output: number; unit: string; recovery: number; oee: number; safetyDays: number };
  monthly: { output: number; target: number; completion: number };
}

export interface Equipment {
  id: string;
  name: string;
  status: 'running' | 'standby' | 'fault' | 'maintenance';
  temp?: number;
  vibration?: number;
}

export interface Alert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  time: string;
  zone: string;
  acknowledged?: boolean;
}

export interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  scene: string;
}

export interface SafetyKPI {
  score: number;
  hazardsOpen: number;
  hazardsClosed: number;
  incidentsMonth: number;
  inspectionRate: number;
}

export interface OreBodySensor {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
}

export interface OreBodyZone {
  id: string;
  name: string;
  sensors: OreBodySensor[];
}

export interface OreBodySensorsData {
  zones: OreBodyZone[];
}
