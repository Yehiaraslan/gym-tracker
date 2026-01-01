/**
 * TensorFlow.js Initialization for React Native
 * 
 * This module handles proper initialization of TensorFlow.js for React Native,
 * including registering the platform adapter and setting up the backend.
 */

import { Platform } from 'react-native';

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize TensorFlow.js for React Native
 * Must be called before using any TensorFlow.js features
 */
export async function initializeTensorFlow(): Promise<boolean> {
  if (isInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[TF-Init] Starting TensorFlow.js initialization...');
      
      // Import TensorFlow.js core
      const tf = await import('@tensorflow/tfjs');
      
      if (Platform.OS !== 'web') {
        // For React Native, we need to register the platform adapter
        try {
          // Import and register tfjs-react-native
          const tfjsRN = await import('@tensorflow/tfjs-react-native');
          
          // Register the platform adapter - this provides fetch and other platform-specific functions
          if (typeof tfjsRN.bundleResourceIO === 'function') {
            console.log('[TF-Init] tfjs-react-native module loaded');
          }
          
          // Set up the backend
          await tf.setBackend('cpu');
          await tf.ready();
          
          console.log('[TF-Init] TensorFlow.js ready with backend:', tf.getBackend());
        } catch (rnError) {
          console.warn('[TF-Init] React Native adapter not available, using CPU backend:', rnError);
          await tf.setBackend('cpu');
          await tf.ready();
        }
      } else {
        // For web, just use the default backend
        await tf.ready();
        console.log('[TF-Init] TensorFlow.js ready (web) with backend:', tf.getBackend());
      }
      
      isInitialized = true;
      return true;
    } catch (error) {
      console.error('[TF-Init] Failed to initialize TensorFlow.js:', error);
      isInitialized = false;
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

/**
 * Check if TensorFlow.js is initialized
 */
export function isTensorFlowReady(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (for testing)
 */
export function resetTensorFlowInit(): void {
  isInitialized = false;
  initPromise = null;
}
