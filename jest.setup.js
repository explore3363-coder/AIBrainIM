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
