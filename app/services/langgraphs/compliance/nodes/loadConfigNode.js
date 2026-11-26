import { HARD_CODED_INITIAL_INTENT_CONFIG } from '../initialIntentConfig.js';

export const loadConfigNode = async (state) => {
  return {
    ...state,
    configDocuments: HARD_CODED_INITIAL_INTENT_CONFIG
  };
};