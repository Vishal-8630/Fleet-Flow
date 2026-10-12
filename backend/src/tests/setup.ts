import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

let mongoReplSet: MongoMemoryReplSet;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_12345678901234567890';

  mongoReplSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1, // Single-node replica set with full oplog and transaction support
      storageEngine: 'wiredTiger',
    },
  });
  const uri = mongoReplSet.getUri();
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) {
    await mongoReplSet.stop();
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
