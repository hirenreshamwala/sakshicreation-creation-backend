// config/mongo.native.js
const { MongoClient } = require("mongodb");

let client;
let db;

async function connectNativeDB() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db(); // default DB from URI
    console.log("✅ Native MongoDB connected");
  }
  return db;
}

module.exports = { connectNativeDB };
