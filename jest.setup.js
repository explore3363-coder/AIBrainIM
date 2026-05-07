/* eslint-disable no-undef */
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}) => children,
  useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => {
    const React = require('react');
    const Screen = ({component: Component}) => React.createElement(Component);
    const Navigator = ({children}) => React.createElement(React.Fragment, null, children);
    return {Navigator, Screen};
  },
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => {
    const React = require('react');
    const Screen = ({component: Component}) => React.createElement(Component);
    const Navigator = ({children}) => React.createElement(React.Fragment, null, children);
    return {Navigator, Screen};
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({children}) => children,
    SafeAreaView: ({children}) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-document-picker', () => ({
  pick: jest.fn(),
  isCancel: jest.fn((err) => err?.code === 'DOCUMENT_PICKER_CANCELED'),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key) => store.get(key) ?? null),
      setItem: jest.fn(async (key, value) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
      getAllKeys: jest.fn(async () => Array.from(store.keys())),
      multiGet: jest.fn(async (keys) => keys.map((key) => [key, store.get(key) ?? null])),
      multiSet: jest.fn(async (pairs) => {
        pairs.forEach(([key, value]) => store.set(key, value));
      }),
      multiRemove: jest.fn(async (keys) => {
        keys.forEach((key) => store.delete(key));
      }),
      multiMerge: jest.fn(async (pairs) => {
        pairs.forEach(([key, value]) => store.set(key, value));
      }),
    },
  };
});
