import { MongoClient, Db, Collection } from "mongodb";
import { ResumeData } from "./types.js";

export class MongoDBClient {
  private client: MongoClient;
  private db: Db | null = null;
  private collection: Collection<ResumeData> | null = null;
  private uri: string;
  private dbName: string;
  private collectionName: string;

  constructor(uri: string, dbName: string, collectionName: string) {
    this.uri = uri;
    this.dbName = dbName;
    this.collectionName = collectionName;
    this.client = new MongoClient(this.uri);
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection<ResumeData>(this.collectionName);
      console.log(`✓ Connected to MongoDB: ${this.dbName}.${this.collectionName}`);
    } catch (error) {
      throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async insertResume(resume: ResumeData): Promise<void> {
    if (!this.collection) {
      throw new Error("MongoDB collection not initialized. Call connect() first.");
    }
    
    try {
      await this.collection.insertOne(resume as any);
      console.log(`✓ Inserted resume: ${resume.fileName}`);
    } catch (error) {
      throw new Error(`Failed to insert resume: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async insertResumes(resumes: ResumeData[]): Promise<void> {
    if (!this.collection) {
      throw new Error("MongoDB collection not initialized. Call connect() first.");
    }
    
    if (resumes.length === 0) {
      return;
    }
    
    try {
      await this.collection.insertMany(resumes as any);
      console.log(`✓ Inserted ${resumes.length} resumes`);
    } catch (error) {
      throw new Error(`Failed to insert resumes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    await this.client.close();
    console.log("✓ MongoDB connection closed");
  }

  async clearCollection(): Promise<void> {
    if (!this.collection) {
      throw new Error("MongoDB collection not initialized. Call connect() first.");
    }
    
    try {
      const result = await this.collection.deleteMany({});
      console.log(`✓ Cleared ${result.deletedCount} documents from collection`);
    } catch (error) {
      throw new Error(`Failed to clear collection: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
