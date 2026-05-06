/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('../src/data/api', () => ({
  fetchAgents: jest.fn().mockResolvedValue([]),
  fetchTasks: jest.fn().mockResolvedValue([]),
  fetchConfirmations: jest.fn().mockResolvedValue([]),
  resolveConfirmation: jest.fn().mockResolvedValue(true),
  sendMessage: jest.fn().mockResolvedValue({reply: 'ok', taskId: 'test-task'}),
  uploadFile: jest.fn().mockResolvedValue({success: true, fileId: 'test-file'}),
}));

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(tree).toBeTruthy();
});
