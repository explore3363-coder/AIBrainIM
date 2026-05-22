import React, {useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ActivityIndicator} from 'react-native';
import {C} from '../data/constants';

export interface SmartMineCardDataItem {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  status?: 'normal' | 'warning' | 'critical';
}

export interface SmartMineCardProps {
  title: string;
  icon: string;
  data: SmartMineCardDataItem[];
  onRefresh?: () => void;
  refreshing?: boolean;
}

function getStatusColor(status?: SmartMineCardDataItem['status']): string {
  switch (status) {
    case 'critical': return C.error;
    case 'warning':  return C.warning;
    case 'normal':   return C.success;
    default:         return C.textPrimary;
  }
}

function getTrendIcon(trend?: SmartMineCardDataItem['trend']): string {
  switch (trend) {
    case 'up':    return ' ↑';
    case 'down':  return ' ↓';
    case 'stable': return ' →';
    default:       return '';
  }
}

export function SmartMineCard({title, icon, data, onRefresh, refreshing}: SmartMineCardProps) {
  const handleRefresh = useCallback(() => {
    if (onRefresh && !refreshing) onRefresh();
  }, [onRefresh, refreshing]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        {onRefresh && (
          <TouchableOpacity onPress={handleRefresh} disabled={refreshing} style={styles.refreshBtn}>
            {refreshing
              ? <ActivityIndicator size="small" color={C.primary} />
              : <Text style={styles.refreshIcon}>🔄</Text>}
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.dataGrid}>
        {data.map((item, i) => (
          <View key={i} style={styles.dataItem}>
            <Text style={[styles.dataValue, {color: getStatusColor(item.status)}]}>
              {item.value}{getTrendIcon(item.trend)}{item.unit ? ` ${item.unit}` : ''}
            </Text>
            <Text style={styles.dataLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    padding: 14,
    borderRadius: 18,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {fontSize: 16},
  title: {
    color: C.textTitle,
    fontSize: 13,
    fontWeight: '900',
  },
  refreshBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {fontSize: 14},
  dataGrid: {
    gap: 10,
  },
  dataItem: {
    gap: 3,
  },
  dataValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  dataLabel: {
    color: C.textMuted,
    fontSize: 10,
  },
});
