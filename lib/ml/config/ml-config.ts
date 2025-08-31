// ML Configuration and Environment Variables
export interface MLConfig {
  modelsPath: string;
  trainingEnabled: boolean;
  inferenceTimeout: number;
  batchSize: number;
  maxMemoryUsage: string;
  tensorflowLogLevel: string;
  enableOneDNN: boolean;
}

// Default ML configuration
const defaultConfig: MLConfig = {
  modelsPath: '/tmp/ml/models',
  trainingEnabled: false,
  inferenceTimeout: 5000,
  batchSize: 32,
  maxMemoryUsage: '2GB',
  tensorflowLogLevel: '2',
  enableOneDNN: true,
};

// Get ML configuration from environment variables
export function getMLConfig(): MLConfig {
  return {
    modelsPath: process.env.ML_MODELS_PATH || defaultConfig.modelsPath,
    trainingEnabled: process.env.ML_TRAINING_ENABLED === 'true' || defaultConfig.trainingEnabled,
    inferenceTimeout: parseInt(process.env.ML_INFERENCE_TIMEOUT || '') || defaultConfig.inferenceTimeout,
    batchSize: parseInt(process.env.ML_BATCH_SIZE || '') || defaultConfig.batchSize,
    maxMemoryUsage: process.env.ML_MAX_MEMORY_USAGE || defaultConfig.maxMemoryUsage,
    tensorflowLogLevel: process.env.TF_CPP_MIN_LOG_LEVEL || defaultConfig.tensorflowLogLevel,
    enableOneDNN: process.env.TF_ENABLE_ONEDNN_OPTS !== 'false',
  };
}

// Validate ML configuration
export function validateMLConfig(config: MLConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.modelsPath || config.modelsPath.trim() === '') {
    errors.push('ML_MODELS_PATH must be specified');
  }

  if (config.inferenceTimeout < 1000 || config.inferenceTimeout > 30000) {
    errors.push('ML_INFERENCE_TIMEOUT must be between 1000 and 30000 milliseconds');
  }

  if (config.batchSize < 1 || config.batchSize > 256) {
    errors.push('ML_BATCH_SIZE must be between 1 and 256');
  }

  if (!config.maxMemoryUsage.match(/^\d+[GM]B$/)) {
    errors.push('ML_MAX_MEMORY_USAGE must be in format like "2GB" or "512MB"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Get validated ML configuration
export function getValidatedMLConfig(): MLConfig {
  const config = getMLConfig();
  const validation = validateMLConfig(config);

  if (!validation.valid) {
    console.warn('ML Configuration validation failed:', validation.errors);
    // Use default config for invalid settings
    return defaultConfig;
  }

  return config;
}

// Check if ML training is enabled and safe
export function isMLTrainingEnabled(): boolean {
  const config = getMLConfig();
  
  // Only allow training in development or if explicitly enabled
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isExplicitlyEnabled = config.trainingEnabled;
  
  return isDevelopment || isExplicitlyEnabled;
}

// Get TensorFlow.js configuration
export function getTensorFlowConfig() {
  const config = getMLConfig();
  
  return {
    // Set TensorFlow.js environment variables
    TF_CPP_MIN_LOG_LEVEL: config.tensorflowLogLevel,
    TF_ENABLE_ONEDNN_OPTS: config.enableOneDNN ? '1' : '0',
  };
}

// ML model limits and constraints
export const ML_LIMITS = {
  MAX_SEQUENCE_LENGTH: 168, // 1 week of hourly data
  MIN_SEQUENCE_LENGTH: 12,  // 12 hours minimum
  MAX_FEATURES: 100,        // Maximum number of features
  MIN_FEATURES: 5,          // Minimum number of features
  MAX_EPOCHS: 1000,         // Maximum training epochs
  MIN_EPOCHS: 10,           // Minimum training epochs
  MAX_BATCH_SIZE: 256,      // Maximum batch size
  MIN_BATCH_SIZE: 1,        // Minimum batch size
  MAX_LEARNING_RATE: 0.1,   // Maximum learning rate
  MIN_LEARNING_RATE: 0.0001, // Minimum learning rate
  MAX_DROPOUT: 0.8,         // Maximum dropout rate
  MIN_DROPOUT: 0.0,         // Minimum dropout rate
  MAX_HIDDEN_UNITS: 512,    // Maximum hidden units per layer
  MIN_HIDDEN_UNITS: 8,      // Minimum hidden units per layer
  MAX_LAYERS: 10,           // Maximum number of layers
  MIN_LAYERS: 1,            // Minimum number of layers
} as const;

// Validate model configuration
export function validateModelConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.sequenceLength) {
    if (config.sequenceLength < ML_LIMITS.MIN_SEQUENCE_LENGTH || 
        config.sequenceLength > ML_LIMITS.MAX_SEQUENCE_LENGTH) {
      errors.push(`Sequence length must be between ${ML_LIMITS.MIN_SEQUENCE_LENGTH} and ${ML_LIMITS.MAX_SEQUENCE_LENGTH}`);
    }
  }

  if (config.epochs) {
    if (config.epochs < ML_LIMITS.MIN_EPOCHS || config.epochs > ML_LIMITS.MAX_EPOCHS) {
      errors.push(`Epochs must be between ${ML_LIMITS.MIN_EPOCHS} and ${ML_LIMITS.MAX_EPOCHS}`);
    }
  }

  if (config.batchSize) {
    if (config.batchSize < ML_LIMITS.MIN_BATCH_SIZE || config.batchSize > ML_LIMITS.MAX_BATCH_SIZE) {
      errors.push(`Batch size must be between ${ML_LIMITS.MIN_BATCH_SIZE} and ${ML_LIMITS.MAX_BATCH_SIZE}`);
    }
  }

  if (config.learningRate) {
    if (config.learningRate < ML_LIMITS.MIN_LEARNING_RATE || config.learningRate > ML_LIMITS.MAX_LEARNING_RATE) {
      errors.push(`Learning rate must be between ${ML_LIMITS.MIN_LEARNING_RATE} and ${ML_LIMITS.MAX_LEARNING_RATE}`);
    }
  }

  if (config.dropout) {
    if (config.dropout < ML_LIMITS.MIN_DROPOUT || config.dropout > ML_LIMITS.MAX_DROPOUT) {
      errors.push(`Dropout must be between ${ML_LIMITS.MIN_DROPOUT} and ${ML_LIMITS.MAX_DROPOUT}`);
    }
  }

  if (config.hiddenUnits && Array.isArray(config.hiddenUnits)) {
    for (const units of config.hiddenUnits) {
      if (units < ML_LIMITS.MIN_HIDDEN_UNITS || units > ML_LIMITS.MAX_HIDDEN_UNITS) {
        errors.push(`Hidden units must be between ${ML_LIMITS.MIN_HIDDEN_UNITS} and ${ML_LIMITS.MAX_HIDDEN_UNITS}`);
      }
    }
    
    if (config.hiddenUnits.length < ML_LIMITS.MIN_LAYERS || config.hiddenUnits.length > ML_LIMITS.MAX_LAYERS) {
      errors.push(`Number of layers must be between ${ML_LIMITS.MIN_LAYERS} and ${ML_LIMITS.MAX_LAYERS}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
