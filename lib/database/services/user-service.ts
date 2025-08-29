import { eq, and } from 'drizzle-orm';
import { db } from '../connection';
import { users, portfolios, type User, type NewUser, type Portfolio } from '../schema';
import bcrypt from 'bcryptjs';

export class UserService {
  // Create a new user
  static async createUser(userData: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const hashedPassword = await bcrypt.hash(userData.passwordHash, 12);
    
    const [user] = await db.insert(users).values({
      ...userData,
      passwordHash: hashedPassword,
    }).returning();

    // Create default portfolio for the user
    await db.insert(portfolios).values({
      userId: user.id,
      name: 'Default Portfolio',
      description: 'Default trading portfolio',
    });

    return user;
  }

  // Get user by ID
  static async getUserById(id: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || null;
  }

  // Get user by email
  static async getUserByEmail(email: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || null;
  }

  // Get user by username
  static async getUserByUsername(username: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || null;
  }

  // Verify user password
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  // Update user
  static async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser || null;
  }

  // Update user password
  static async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const [updatedUser] = await db
      .update(users)
      .set({ passwordHash: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return !!updatedUser;
  }

  // Update last login
  static async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  // Deactivate user
  static async deactivateUser(id: string): Promise<boolean> {
    const [updatedUser] = await db
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return !!updatedUser;
  }

  // Get user with portfolios
  static async getUserWithPortfolios(id: string): Promise<(User & { portfolios: Portfolio[] }) | null> {
    const user = await this.getUserById(id);
    if (!user) return null;

    const userPortfolios = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, id));

    return {
      ...user,
      portfolios: userPortfolios,
    };
  }

  // Update user preferences
  static async updatePreferences(id: string, preferences: Record<string, any>): Promise<boolean> {
    const [updatedUser] = await db
      .update(users)
      .set({ preferences, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return !!updatedUser;
  }

  // Verify user email
  static async verifyEmail(id: string): Promise<boolean> {
    const [updatedUser] = await db
      .update(users)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return !!updatedUser;
  }

  // Get active users count
  static async getActiveUsersCount(): Promise<number> {
    const result = await db
      .select({ count: users.id })
      .from(users)
      .where(eq(users.isActive, true));
    
    return result.length;
  }

  // Search users by email or username
  static async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    const searchResults = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          // Note: In a real implementation, you'd use proper text search
          // This is a simplified version
        )
      )
      .limit(limit);
    
    return searchResults.filter(user => 
      user.email.toLowerCase().includes(query.toLowerCase()) ||
      user.username.toLowerCase().includes(query.toLowerCase())
    );
  }
}
