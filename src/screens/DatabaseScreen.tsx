import React, {useState, useCallback} from 'react';
import {
  Text, View, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {C} from '../data/constants';

interface DatabaseItem {
  id: string;
  name: string;
  recordCount: number;
  updatedAt: string;
  active: boolean;
}

const MOCK_DATABASES: DatabaseItem[] = [
  {id: '1', name: 'AI 协作平台', recordCount: 128, updatedAt: '2026-05-09', active: true},
  {id: '2', name: '矿业大脑知识库', recordCount: 42, updatedAt: '2026-05-08', active: true},
  {id: '3', name: '任务调度记录', recordCount: 21, updatedAt: '2026-05-07', active: false},
  {id: '4', name: 'Agent 记忆库', recordCount: 67, updatedAt: '2026-05-06', active: false},
];

export function DatabaseScreen() {
  const [searchText, setSearchText] = useState('');
  const [items] = useState<DatabaseItem[]>(MOCK_DATABASES);

  const filtered = useCallback(
    () => items.filter((d) => d.name.includes(searchText)),
    [items, searchText],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>数据库</Text>
          <Text style={styles.subtitle}>Data Repository</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索数据库 / Search..."
            placeholderTextColor={C.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Database list */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>数据表</Text>
          {filtered().map((db) => (
            <TouchableOpacity key={db.id} style={styles.dbCard}>
              <View style={[styles.statusDot, db.active ? styles.dotActive : styles.dotInactive]} />
              <View style={styles.dbCardContent}>
                <Text style={styles.dbName}>{db.name}</Text>
                <Text style={styles.dbMeta}>
                  {db.recordCount} 条记录 · {db.updatedAt}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* CTA */}
      <TouchableOpacity style={styles.ctaButton}>
        <Text style={styles.ctaText}>+ 新建数据</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bgRoot},
  scrollContent: {padding: 16, paddingBottom: 100},
  header: {marginBottom: 16},
  title: {fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 4},
  subtitle: {fontSize: 14, color: C.textMuted},
  searchContainer: {marginBottom: 20},
  searchInput: {
    backgroundColor: C.bgCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  listSection: {gap: 8},
  sectionTitle: {fontSize: 14, fontWeight: '600', color: C.textMuted, marginBottom: 8},
  dbCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgCard,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  statusDot: {width: 8, height: 8, borderRadius: 4, marginRight: 12},
  dotActive: {backgroundColor: C.primary},
  dotInactive: {backgroundColor: C.textMuted},
  dbCardContent: {flex: 1},
  dbName: {fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 4},
  dbMeta: {fontSize: 12, color: C.textMuted},
  chevron: {fontSize: 20, color: C.textMuted},
  ctaButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {fontSize: 15, fontWeight: '700', color: '#000000'},
});
