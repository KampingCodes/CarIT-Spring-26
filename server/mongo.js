import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') }); // loads root .env

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