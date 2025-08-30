import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
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
    const [model] = await db.insert(mlModels).values(modelData).returning();
    return model;
  }

  // Get model by ID
  static async getModelById(id: string): Promise<MLModel | null> {
    const [model] = await db.select().from(mlModels).where(eq(mlModels.id, id));
    return model || null;
  }

  // Get models by type
  static async getModelsByType(type: string, activeOnly: boolean = true): Promise<MLModel[]> {
    const conditions = [eq(mlModels.type, type)];
    if (activeOnly) {
      conditions.push(eq(mlModels.status, 'active'));
    }

    return db
      .select()
      .from(mlModels)
      .where(and(...conditions))
      .orderBy(desc(mlModels.lastTrainedAt));
  }

  // Get active models
  static async getActiveModels(): Promise<MLModel[]> {
    return db
      .select()
      .from(mlModels)
      .where(eq(mlModels.status, 'active'))
      .orderBy(desc(mlModels.lastTrainedAt));
  }

  // Update model
  static async updateModel(id: string, updates: Partial<Omit<MLModel, 'id' | 'createdAt'>>): Promise<MLModel | null> {
    const [updatedModel] = await db
      .update(mlModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mlModels.id, id))
      .returning();
    
    return updatedModel || null;
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

    // Deactivate other models of the same type
    await db
      .update(mlModels)
      .set({ status: 'deprecated', updatedAt: new Date() })
      .where(and(
        eq(mlModels.type, model.type),
        eq(mlModels.status, 'active')
      ));

    // Activate this model
    const updatedModel = await this.updateModel(id, { status: 'active' });
    return !!updatedModel;
  }

  // Create prediction
  static async createPrediction(predictionData: Omit<NewMLPrediction, 'id' | 'createdAt'>): Promise<MLPrediction> {
    const [prediction] = await db.insert(mlPredictions).values(predictionData).returning();
    return prediction;
  }

  // Get predictions for model
  static async getModelPredictions(
    modelId: string, 
    symbol?: string, 
    limit: number = 100
  ): Promise<MLPrediction[]> {
    const conditions = [eq(mlPredictions.modelId, modelId)];
    if (symbol) {
      conditions.push(eq(mlPredictions.symbol, symbol));
    }

    return db
      .select()
      .from(mlPredictions)
      .where(and(...conditions))
      .orderBy(desc(mlPredictions.predictionTime))
      .limit(limit);
  }

  // Get recent predictions
  static async getRecentPredictions(
    symbol: string, 
    predictionType: string, 
    hours: number = 24
  ): Promise<MLPrediction[]> {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return db
      .select()
      .from(mlPredictions)
      .where(and(
        eq(mlPredictions.symbol, symbol),
        eq(mlPredictions.predictionType, predictionType),
        gte(mlPredictions.predictionTime, startTime)
      ))
      .orderBy(desc(mlPredictions.predictionTime));
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

    return stats;
  }

  // Create training job
  static async createTrainingJob(jobData: Omit<NewMLTrainingJob, 'id' | 'createdAt'>): Promise<MLTrainingJob> {
    const [job] = await db.insert(mlTrainingJobs).values(jobData).returning();
    return job;
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
    return db
      .select()
      .from(mlTrainingJobs)
      .where(eq(mlTrainingJobs.status, 'queued'))
      .orderBy(mlTrainingJobs.createdAt);
  }

  // Get training jobs for model
  static async getModelTrainingJobs(modelId: string, limit: number = 10): Promise<MLTrainingJob[]> {
    return db
      .select()
      .from(mlTrainingJobs)
      .where(eq(mlTrainingJobs.modelId, modelId))
      .orderBy(desc(mlTrainingJobs.createdAt))
      .limit(limit);
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
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    const deleted = await db
      .delete(mlPredictions)
      .where(lte(mlPredictions.predictionTime, cutoffDate))
      .returning({ id: mlPredictions.id });
    
    return deleted.length;
  }

  // Get model leaderboard
  static async getModelLeaderboard(type?: string, limit: number = 10) {
    const conditions = [eq(mlModels.status, 'active')];
    if (type) {
      conditions.push(eq(mlModels.type, type));
    }

    return db
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
      .limit(limit);
  }
}
