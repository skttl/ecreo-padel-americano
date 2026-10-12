import { generateRound } from './scheduler.js';

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ round: generateRound(data), error: null });
  } catch (error) {
    self.postMessage({ round: null, error: error instanceof Error ? error.message : String(error) });
  }
};
