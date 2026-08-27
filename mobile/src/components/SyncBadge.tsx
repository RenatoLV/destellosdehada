import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSync } from '../sync/useSync';

interface Props {
  variant?: 'pill' | 'compact';
  onPress?: () => void;
}

export function SyncBadge({ variant = 'pill', onPress }: Props) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useSync();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      syncNow();
    }
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity 
        style={[
          styles.compactContainer, 
          !isOnline && styles.offlineCompact,
          isSyncing && styles.syncingCompact
        ]} 
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {isSyncing ? (
          <ActivityIndicator size="small" color="#7B5CF6" />
        ) : !isOnline ? (
          <Feather name="cloud-off" size={14} color="#EF4444" />
        ) : pendingCount > 0 ? (
          <View style={styles.badgeRow}>
            <Feather name="cloud" size={14} color="#D97706" />
            <Text style={styles.pendingNumber}>{pendingCount}</Text>
          </View>
        ) : (
          <Feather name="check-circle" size={14} color="#10B981" />
        )}
      </TouchableOpacity>
    );
  }

  // Variant 'pill' (Ideal for top of screens)
  const getPillStyle = () => {
    if (!isOnline) return styles.offlinePill;
    if (isSyncing) return styles.syncingPill;
    if (pendingCount > 0) return styles.pendingPill;
    return styles.onlinePill;
  };

  const getTextStyle = () => {
    if (!isOnline) return styles.offlineText;
    if (isSyncing) return styles.syncingText;
    if (pendingCount > 0) return styles.pendingText;
    return styles.onlineText;
  };

  const getDotColor = () => {
    if (!isOnline) return '#EF4444';
    if (pendingCount > 0) return '#F59E0B';
    return '#10B981';
  };

  const getIconColor = () => {
    if (!isOnline) return '#EF4444';
    if (pendingCount > 0) return '#B45309';
    return '#059669';
  };

  const getStatusMessage = () => {
    if (isSyncing) return 'Sincronizando...';
    if (!isOnline) return 'Sin conexión (Modo local)';
    if (pendingCount > 0) return `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`;
    return 'Supabase conectado ✨';
  };

  return (
    <TouchableOpacity 
      style={[styles.pillContainer, getPillStyle()]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.pillIconBox}>
        {isSyncing ? (
          <ActivityIndicator size={12} color="#7B5CF6" />
        ) : (
          <View style={[styles.dot, { backgroundColor: getDotColor() }]} />
        )}
      </View>

      <Text style={[styles.pillText, getTextStyle()]}>
        {getStatusMessage()}
      </Text>

      {isSyncing ? null : (
        <Feather 
          name="refresh-cw" 
          size={11} 
          color={getIconColor()} 
          style={{ marginLeft: 6 }} 
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  onlinePill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  offlinePill: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  syncingPill: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  pendingPill: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pillIconBox: {
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  onlineText: {
    color: '#065F46',
  },
  offlineText: {
    color: '#991B1B',
  },
  syncingText: {
    color: '#5B21B6',
  },
  pendingText: {
    color: '#92400E',
  },
  compactContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineCompact: {
    backgroundColor: '#FEE2E2',
  },
  syncingCompact: {
    backgroundColor: '#EDE9FE',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingNumber: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    marginLeft: 2,
  },
});
