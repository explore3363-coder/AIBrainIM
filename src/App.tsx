import React from 'react';
import {StatusBar, StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

export type RootStackParamList = {
  Tabs: {screen?: 'Dashboard' | 'Agent' | 'Chat' | 'Tasks' | 'Profile' | 'SmartMine'} | undefined;
  MemoryStore: undefined;
  KnowledgeBase: undefined;
  FileLibrary: undefined;
  ProjectLibrary: undefined;
  DispatchChain: {focusDispatchId?: string; focusTaskId?: string; focusSessionKey?: string} | undefined;
  DispatchChainDetail: {dispatchId?: string; focusDispatchId?: string; focusTaskId?: string; focusSessionKey?: string} | undefined;
  Confirmations: {focusConfirmationId?: string; focusTaskId?: string; focusDispatchId?: string} | undefined;
  Upload: {focusFileId?: string; focusDispatchId?: string} | undefined;
  GatewaySettings: undefined;
  SmartMine: undefined;
};

import {C} from './data/constants';
import {AppProvider, useAppContext} from './context/AppContext';
import {TabBarIcon} from './components/TabBarIcon';

// Screens
import {DashboardScreen}       from './screens/DashboardScreen';
import {ChatScreen}            from './screens/ChatScreen';
import {AgentScreen}           from './screens/AgentScreen';
import {TaskScreen}            from './screens/TaskScreen';
import {ProfileScreen}         from './screens/ProfileScreen';
import {MemoryStoreScreen}     from './screens/MemoryStoreScreen';
import {KnowledgeBaseScreen}   from './screens/KnowledgeBaseScreen';
import {FileLibraryScreen}     from './screens/FileLibraryScreen';
import {ProjectLibraryScreen}  from './screens/ProjectLibraryScreen';
import {DispatchChainScreen}        from './screens/DispatchChainScreen';
import {DispatchChainDetailScreen}  from './screens/DispatchChainDetailScreen';
import {ConfirmationsScreen}   from './screens/ConfirmationsScreen';
import {UploadScreen}          from './screens/UploadScreen';
import {GatewaySettingsScreen} from './screens/GatewaySettingsScreen';
import {SmartMineScreen} from './screens/SmartMineScreen';


// ─── Navigators ────────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Tab bar icon factories (module scope avoids react/no-unstable-nested-components) ───
 
const _tabIcon = (label: string, emoji: string) => ({focused}: {focused: boolean}) => (
  <TabBarIcon label={label} emoji={emoji} focused={focused} />
);
 
const _tabIconWithBadge = (label: string, emoji: string, count: number | undefined) => ({focused}: {focused: boolean}) => (
  <TabBarIcon label={label} emoji={emoji} focused={focused} badge={count} />
);

function TabNavigator() {
  const {pendingConfirmations, uploads, tasks} = useAppContext();

  const uploadingCount = uploads.filter(
    (u: {status: string}) => u.status === 'queued' || u.status === 'uploading' || u.status === 'processing',
  ).length;
  const runningTaskCount = tasks.filter(
    (t: {state: string}) => t.state === 'running' || t.state === 'todo',
  ).length;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.tabBg,
          borderTopColor: C.borderSubtle,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 24,
          paddingTop: 10,
        },
        tabBarActiveTintColor: C.tabActive,
        tabBarInactiveTintColor: C.tabInactive,
        tabBarLabel: () => null,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{tabBarIcon: _tabIcon('总览', '🏠')}} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{tabBarIcon: _tabIcon('对话', '💬')}} />
      <Tab.Screen name="Agent" component={AgentScreen} options={{tabBarIcon: _tabIcon('智能体', '🧠')}} />
      <Tab.Screen
        name="Tasks"
        component={TaskScreen}
        options={{tabBarIcon: _tabIconWithBadge('任务', '📋', runningTaskCount > 0 ? runningTaskCount : undefined)}}
      />
      <Tab.Screen name="SmartMine" component={SmartMineScreen} options={{tabBarIcon: _tabIcon('矿山', '⛏️')}} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: _tabIconWithBadge(
            '我的',
            '👤',
            pendingConfirmations > 0
              ? pendingConfirmations
              : uploadingCount > 0
                ? uploadingCount
                : undefined,
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: C.bgRoot},
        headerTintColor: C.textTitle,
        headerTitleStyle: {fontWeight: '800'},
        contentStyle: {backgroundColor: C.bgRoot},
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} options={{headerShown: false}} />
      <Stack.Screen name="MemoryStore"    component={MemoryStoreScreen}    options={{title: '记忆库',       headerBackTitle: '返回'}} />
      <Stack.Screen name="KnowledgeBase"  component={KnowledgeBaseScreen}  options={{title: '知识库',       headerBackTitle: '返回'}} />
      <Stack.Screen name="FileLibrary"     component={FileLibraryScreen}    options={{title: '附件库',       headerBackTitle: '返回'}} />
      <Stack.Screen name="ProjectLibrary" component={ProjectLibraryScreen} options={{title: '项目库',       headerBackTitle: '返回'}} />
      <Stack.Screen name="DispatchChain"       component={DispatchChainScreen}        options={{title: '调度链',         headerBackTitle: '返回'}} />
      <Stack.Screen name="DispatchChainDetail"  component={DispatchChainDetailScreen} options={{title: '调度详情',     headerBackTitle: '返回'}} />
      <Stack.Screen name="Confirmations"   component={ConfirmationsScreen}  options={{title: '需确认项',     headerBackTitle: '返回'}} />
      <Stack.Screen name="Upload"          component={UploadScreen}         options={{title: '📤 上传管理',  headerBackTitle: '返回'}} />
      <Stack.Screen name="GatewaySettings" component={GatewaySettingsScreen} options={{title: 'Gateway 配置', headerBackTitle: '返回'}} />
      <Stack.Screen name="SmartMine" component={SmartMineScreen} options={{title: '⛏️ 智慧矿山', headerBackTitle: '返回'}} />
    </Stack.Navigator>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  rootSafeArea: {flex: 1, backgroundColor: C.bgRoot},
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <SafeAreaView style={styles.rootSafeArea} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={C.bgRoot} />
            <RootNavigator />
          </SafeAreaView>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}