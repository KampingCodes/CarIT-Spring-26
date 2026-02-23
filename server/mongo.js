import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config(); // loads .env file into process.env

// URI to connect to MongoDB
const URI = process.env.MONGODB_URI;

// Create a MongoClient to connect to MongoDB
export const client = new MongoClient(URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  }
});