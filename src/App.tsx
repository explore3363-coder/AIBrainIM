import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {C} from './data/mockData';
import {AppProvider} from './context/AppContext';
import {TabBarIcon} from './components/TabBarIcon';

// Screens
import {DashboardScreen}      from './screens/DashboardScreen';
import {ChatScreen}           from './screens/ChatScreen';
import {AgentScreen}          from './screens/AgentScreen';
import {TaskScreen}           from './screens/TaskScreen';
import {ProfileScreen}        from './screens/ProfileScreen';
import {MemoryStoreScreen}    from './screens/MemoryStoreScreen';
import {KnowledgeBaseScreen}  from './screens/KnowledgeBaseScreen';
import {FileLibraryScreen}    from './screens/FileLibraryScreen';
import {ProjectLibraryScreen} from './screens/ProjectLibraryScreen';
import {DispatchChainScreen}  from './screens/DispatchChainScreen';
import {ConfirmationsScreen}  from './screens/ConfirmationsScreen';
import {UploadScreen}         from './screens/UploadScreen';

// ─── Navigators ────────────────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
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
      {/* 底部五主功能：总览、对话、智能体、任务、我的 */}
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{tabBarIcon: ({focused}) => <TabBarIcon label="总览" emoji="📊" focused={focused} />}}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{tabBarIcon: ({focused}) => <TabBarIcon label="对话" emoji="💬" focused={focused} />}}
      />
      <Tab.Screen
        name="Agent"
        component={AgentScreen}
        options={{tabBarIcon: ({focused}) => <TabBarIcon label="智能体" emoji="🤖" focused={focused} />}}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskScreen}
        options={{tabBarIcon: ({focused}) => <TabBarIcon label="任务" emoji="📋" focused={focused} />}}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{tabBarIcon: ({focused}) => <TabBarIcon label="我的" emoji="👤" focused={focused} />}}
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
      <Stack.Screen
        name="Tabs"
        component={TabNavigator}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="MemoryStore"
        component={MemoryStoreScreen}
        options={{title: '记忆库', headerBackTitle: '返回'}}
      />
      <Stack.Screen
        name="KnowledgeBase"
        component={KnowledgeBaseScreen}
        options={{title: '知识库', headerBackTitle: '返回'}}
      />
      <Stack.Screen
        name="FileLibrary"
        component={FileLibraryScreen}
        options={{title: '附件库', headerBackTitle: '返回'}}
      />
      <Stack.Screen
        name="ProjectLibrary"
        component={ProjectLibraryScreen}
        options={{title: '项目库', headerBackTitle: '返回'}}
      />
      <Stack.Screen
        name="DispatchChain"
        component={DispatchChainScreen}
        options={{title: '调度链', headerBackTitle: '返回'}}
      />
      <Stack.Screen
        name="Confirmations"
        component={ConfirmationsScreen}
        options={{title: '需确认项', headerBackTitle: '返回'}}
      />
      <Stack.Screen
        name="Upload"
        component={UploadScreen}
        options={{title: '📤 上传管理', headerBackTitle: '返回'}}
      />
    </Stack.Navigator>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer>
          <SafeAreaView style={{flex: 1, backgroundColor: C.bgRoot}} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={C.bgRoot} />
            <RootNavigator />
          </SafeAreaView>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
