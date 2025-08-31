import { eq, and, desc, gte, lte, sql, ne } from 'drizzle-orm';
import { db } from '../../database/connection';
import { 
  mlModels, 
  mlPredictions, 
  mlTrainingJobs,
  type MLModel, 
  type NewMLModel,
  type MLPrediction,
  type NewMLPrediction,
  type MLTrainingJob,
  type NewMLTrainingJob
} from '../../database/schema';

export class MLModelService {
  // Create a new ML model
  static async createModel(modelData: Omit<NewMLModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<MLModel> {
    // Input validation
    if (!modelData.name || modelData.name.trim() === '') {
      throw new Error('Model name is required');
    }

    if (!modelData.type || modelData.type.trim() === '') {
      throw new Error('Model type is required');
    }

    if (!modelData.version || modelData.version.trim() === '') {
      throw new Error('Model version is required');
    }

    if (!modelData.parameters || typeof modelData.parameters !== 'object') {
      throw new Error('Model parameters are required and must be an object');
    }

    try {
      const [model] = await db.insert(mlModels).values(modelData).returning();
      return model;
    } catch (error) {
      console.error('Error creating ML model:', error);
      throw new Error('Failed to create ML model');
    }
  }

  // Get model by ID
  static async getModelById(id: string): Promise<MLModel | null> {
    if (!id || id.trim() === '') {
      return null;
    }

    try {
      const [model] = await db.select().from(mlModels).where(eq(mlModels.id, id));
      return model || null;
    } catch (error) {
      console.error('Error fetching model by ID:', error);
      return null;
    }
  }

  // Get models by type
  static async getModelsByType(type: string, activeOnly: boolean = true): Promise<MLModel[]> {
    if (!type || type.trim() === '') {
      return [];
    }

    try {
      const conditions = [eq(mlModels.type, type)];
      if (activeOnly) {
        conditions.push(eq(mlModels.status, 'active'));
      }

      return await db
        .select()
        .from(mlModels)
        .where(and(...conditions))
        .orderBy(desc(mlModels.lastTrainedAt));
    } catch (error) {
      console.error('Error fetching models by type:', error);
      return [];
    }
  }

  // Get active models
  static async getActiveModels(): Promise<MLModel[]> {
    try {
      return await db
        .select()
        .from(mlModels)
        .where(eq(mlModels.status, 'active'))
        .orderBy(desc(mlModels.lastTrainedAt));
    } catch (error) {
      console.error('Error fetching active models:', error);
      return [];
    }
  }

  // Get all models (including inactive ones)
  static async getAllModels(): Promise<MLModel[]> {
    try {
      return await db
        .select()
        .from(mlModels)
        .orderBy(desc(mlModels.lastTrainedAt));
    } catch (error) {
      console.error('Error fetching all models:', error);
      return [];
    }
  }

  // Update model
  static async updateModel(id: string, updates: Partial<Omit<MLModel, 'id' | 'createdAt'>>): Promise<MLModel | null> {
    if (!id || id.trim() === '') {
      return null;
    }

    if (!updates || Object.keys(updates).length === 0) {
      return null;
    }

    try {
      const [updatedModel] = await db
        .update(mlModels)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(mlModels.id, id))
        .returning();

      return updatedModel || null;
    } catch (error) {
      console.error('Error updating model:', error);
      return null;
    }
  }

  // Update model performance metrics
  static async updateModelPerformance(
    id: string, 
    performance: {
      accuracy?: number;
      precision?: number;
      recall?: number;
      f1Score?: number;
      sharpeRatio?: number;
      maxDrawdown?: number;
    }
  ): Promise<MLModel | null> {
    const updates: any = {};
    
    if (performance.accuracy !== undefined) updates.accuracy = performance.accuracy.toString();
    if (performance.precision !== undefined) updates.precision = performance.precision.toString();
    if (performance.recall !== undefined) updates.recall = performance.recall.toString();
    if (performance.f1Score !== undefined) updates.f1Score = performance.f1Score.toString();
    if (performance.sharpeRatio !== undefined) updates.sharpeRatio = performance.sharpeRatio.toString();
    if (performance.maxDrawdown !== undefined) updates.maxDrawdown = performance.maxDrawdown.toString();

    return this.updateModel(id, updates);
  }

  // Activate model (set as active and deactivate others of same type)
  static async activateModel(id: string): Promise<boolean> {
    const model = await this.getModelById(id);
    if (!model) return false;

    try {
      // First activate the new model
      const updatedModel = await this.updateModel(id, { status: 'active' });
      if (!updatedModel) return false;

      // Deactivate other models of the same type (excluding the just-activated model)
      await db
        .update(mlModels)
        .set({ status: 'deprecated', updatedAt: new Date() })
        .where(and(
          eq(mlModels.type, model.type),
          eq(mlModels.status, 'active'),
          ne(mlModels.id, id) // Exclude the just-activated model
        ));

      return true;
    } catch (error) {
      console.error('Error activating model:', error);
      return false;
    }
  }

  // Create prediction
  static async createPrediction(predictionData: Omit<NewMLPrediction, 'id' | 'createdAt'>): Promise<MLPrediction> {
    // Input validation
    if (!predictionData.modelId || predictionData.modelId.trim() === '') {
      throw new Error('Model ID is required for prediction');
    }

    if (!predictionData.symbol || predictionData.symbol.trim() === '') {
      throw new Error('Symbol is required for prediction');
    }

    if (!predictionData.predictionType || predictionData.predictionType.trim() === '') {
      throw new Error('Prediction type is required');
    }

    try {
      const [prediction] = await db.insert(mlPredictions).values(predictionData).returning();
      return prediction;
    } catch (error) {
      console.error('Error creating prediction:', error);
      throw new Error('Failed to create prediction');
    }
  }

  // Get predictions for model
  static async getModelPredictions(
    modelId: string,
    symbol?: string,
    limit: number = 100
  ): Promise<MLPrediction[]> {
    if (!modelId || modelId.trim() === '') {
      return [];
    }

    // Validate limit
    const validLimit = Math.max(1, Math.min(limit, 1000)); // Between 1 and 1000

    try {
      const conditions = [eq(mlPredictions.modelId, modelId)];
      if (symbol && symbol.trim() !== '') {
        conditions.push(eq(mlPredictions.symbol, symbol));
      }

      return await db
        .select()
        .from(mlPredictions)
        .where(and(...conditions))
        .orderBy(desc(mlPredictions.predictionTime))
        .limit(validLimit);
    } catch (error) {
      console.error('Error fetching model predictions:', error);
      return [];
    }
  }

  // Get recent predictions
  static async getRecentPredictions(
    symbol: string,
    predictionType: string,
    hours: number = 24
  ): Promise<MLPrediction[]> {
    if (!symbol || symbol.trim() === '') {
      return [];
    }

    if (!predictionType || predictionType.trim() === '') {
      return [];
    }

    // Validate hours parameter
    const validHours = Math.max(1, Math.min(hours, 168)); // Between 1 hour and 1 week

    try {
      const startTime = new Date(Date.now() - (validHours * 60 * 60 * 1000));

      return await db
        .select()
        .from(mlPredictions)
        .where(and(
          eq(mlPredictions.symbol, symbol),
          eq(mlPredictions.predictionType, predictionType),
          gte(mlPredictions.predictionTime, startTime)
        ))
        .orderBy(desc(mlPredictions.predictionTime));
    } catch (error) {
      console.error('Error fetching recent predictions:', error);
      return [];
    }
  }

  // Validate prediction (update with actual value)
  static async validatePrediction(
    id: string,
    actualValue: number
  ): Promise<MLPrediction | null> {
    try {
      const prediction = await db.select().from(mlPredictions).where(eq(mlPredictions.id, id));
      if (!prediction[0]) return null;

      const pred = prediction[0];
      const predictedValue = typeof pred.prediction === 'object' && pred.prediction !== null
        ? (pred.prediction as any).value || 0
        : Number(pred.prediction) || 0;

      // Calculate accuracy based on prediction type
      let accuracy = 0;
      if (pred.predictionType === 'direction') {
        // For direction predictions, check if direction was correct
        const predictedDirection = predictedValue > 0 ? 1 : -1;
        const actualDirection = actualValue > 0 ? 1 : -1;
        accuracy = predictedDirection === actualDirection ? 1 : 0;
      } else {
        // For value predictions, calculate percentage error
        const error = Math.abs(predictedValue - actualValue) / Math.abs(actualValue);
        accuracy = Math.max(0, 1 - error);
      }

      const [updatedPrediction] = await db
        .update(mlPredictions)
        .set({
          actualValue: actualValue.toString(),
          accuracy: accuracy.toString(),
          validatedAt: new Date(),
        })
        .where(eq(mlPredictions.id, id))
        .returning();

      return updatedPrediction || null;
    } catch (error) {
      console.error('Error validating prediction:', error);
      return null;
    }
  }

  // Get model accuracy statistics
  static async getModelAccuracy(modelId: string, days: number = 30) {
    try {
      const startTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const [stats] = await db
        .select({
          totalPredictions: sql<number>`COUNT(*)`,
          validatedPredictions: sql<number>`COUNT(CASE WHEN ${mlPredictions.validatedAt} IS NOT NULL THEN 1 END)`,
          avgAccuracy: sql<number>`AVG(CASE WHEN ${mlPredictions.accuracy} IS NOT NULL THEN CAST(${mlPredictions.accuracy} AS DECIMAL) END)`,
          avgConfidence: sql<number>`AVG(CAST(${mlPredictions.confidence} AS DECIMAL))`,
        })
        .from(mlPredictions)
        .where(and(
          eq(mlPredictions.modelId, modelId),
          gte(mlPredictions.predictionTime, startTime)
        ));

      return stats || {
        totalPredictions: 0,
        validatedPredictions: 0,
        avgAccuracy: 0,
        avgConfidence: 0,
      };
    } catch (error) {
      console.error('Error fetching model accuracy:', error);
      return {
        totalPredictions: 0,
        validatedPredictions: 0,
        avgAccuracy: 0,
        avgConfidence: 0,
      };
    }
  }

  // Create training job
  static async createTrainingJob(jobData: Omit<NewMLTrainingJob, 'id' | 'createdAt'>): Promise<MLTrainingJob> {
    // Input validation
    if (!jobData.modelId || jobData.modelId.trim() === '') {
      throw new Error('Model ID is required for training job');
    }

    if (!jobData.jobType || jobData.jobType.trim() === '') {
      throw new Error('Job type is required for training job');
    }

    if (!jobData.parameters || typeof jobData.parameters !== 'object') {
      throw new Error('Parameters are required and must be an object');
    }

    try {
      const [job] = await db.insert(mlTrainingJobs).values(jobData).returning();
      return job;
    } catch (error) {
      console.error('Error creating training job:', error);
      throw new Error('Failed to create training job');
    }
  }

  // Update training job status
  static async updateTrainingJob(
    id: string, 
    updates: Partial<Omit<MLTrainingJob, 'id' | 'createdAt'>>
  ): Promise<MLTrainingJob | null> {
    const [updatedJob] = await db
      .update(mlTrainingJobs)
      .set(updates)
      .where(eq(mlTrainingJobs.id, id))
      .returning();
    
    return updatedJob || null;
  }

  // Get pending training jobs
  static async getPendingTrainingJobs(): Promise<MLTrainingJob[]> {
    try {
      return await db
        .select()
        .from(mlTrainingJobs)
        .where(eq(mlTrainingJobs.status, 'queued'))
        .orderBy(mlTrainingJobs.createdAt);
    } catch (error) {
      console.error('Error fetching pending training jobs:', error);
      return [];
    }
  }

  // Get recent training jobs across all statuses
  static async getRecentTrainingJobs(limit: number = 10): Promise<MLTrainingJob[]> {
    try {
      const validLimit = Math.max(1, Math.min(limit, 100)); // Between 1 and 100
      return await db
        .select()
        .from(mlTrainingJobs)
        .orderBy(desc(mlTrainingJobs.createdAt))
        .limit(validLimit);
    } catch (error) {
      console.error('Error fetching recent training jobs:', error);
      return [];
    }
  }

  // Get training jobs for model
  static async getModelTrainingJobs(modelId: string, limit: number = 10): Promise<MLTrainingJob[]> {
    if (!modelId || modelId.trim() === '') {
      return [];
    }

    // Validate limit
    const validLimit = Math.max(1, Math.min(limit, 100)); // Between 1 and 100

    try {
      return await db
        .select()
        .from(mlTrainingJobs)
        .where(eq(mlTrainingJobs.modelId, modelId))
        .orderBy(desc(mlTrainingJobs.createdAt))
        .limit(validLimit);
    } catch (error) {
      console.error('Error fetching model training jobs:', error);
      return [];
    }
  }

  // Get model performance summary
  static async getModelPerformanceSummary(modelId: string) {
    const model = await this.getModelById(modelId);
    if (!model) return null;

    const accuracy = await this.getModelAccuracy(modelId);
    const recentPredictions = await this.getModelPredictions(modelId, undefined, 10);
    const trainingJobs = await this.getModelTrainingJobs(modelId, 5);

    return {
      model,
      accuracy,
      recentPredictions,
      trainingJobs,
      lastUpdated: new Date(),
    };
  }

  // Clean old predictions
  static async cleanOldPredictions(daysToKeep: number = 90): Promise<number> {
    // Validate daysToKeep parameter
    const validDays = Math.max(1, Math.min(daysToKeep, 365)); // Between 1 day and 1 year

    try {
      const cutoffDate = new Date(Date.now() - (validDays * 24 * 60 * 60 * 1000));

      const deleted = await db
        .delete(mlPredictions)
        .where(lte(mlPredictions.predictionTime, cutoffDate))
        .returning({ id: mlPredictions.id });

      return deleted.length;
    } catch (error) {
      console.error('Error cleaning old predictions:', error);
      return 0;
    }
  }

  // Get model leaderboard
  static async getModelLeaderboard(type?: string, limit: number = 10) {
    // Validate limit
    const validLimit = Math.max(1, Math.min(limit, 50)); // Between 1 and 50

    try {
      const conditions = [eq(mlModels.status, 'active')];
      if (type && type.trim() !== '') {
        conditions.push(eq(mlModels.type, type));
      }

      return await db
        .select({
          id: mlModels.id,
          name: mlModels.name,
          type: mlModels.type,
          version: mlModels.version,
          accuracy: mlModels.accuracy,
          sharpeRatio: mlModels.sharpeRatio,
          maxDrawdown: mlModels.maxDrawdown,
          lastTrainedAt: mlModels.lastTrainedAt,
        })
        .from(mlModels)
        .where(and(...conditions))
        .orderBy(desc(mlModels.sharpeRatio))
        .limit(validLimit);
    } catch (error) {
      console.error('Error fetching model leaderboard:', error);
      return [];
    }
  }
}
