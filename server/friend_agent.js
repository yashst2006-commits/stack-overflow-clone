import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.MONGODB_URL;
if (!url) {
  console.error("MONGODB_URL is not set");
  process.exit(1);
}

const client = new MongoClient(url);

async function run() {
  try {
    await client.connect();
    const db = client.db();
    const usersCol = db.collection("users");
    
    // Find the browser agent user
    const agent = await usersCol.findOne({ email: "browseragent@example.com" });
    if (!agent) {
      console.error("browseragent@example.com not found. Please register first!");
      process.exit(1);
    }
    
    // Find another user to make friends with
    const friend = await usersCol.findOne({ email: "yashwanthst2006@gmail.com" });
    if (!friend) {
      console.error("yashwanthst2006@gmail.com not found!");
      process.exit(1);
    }
    
    // Establish friendship
    await usersCol.updateOne({ _id: agent._id }, { $addToSet: { friends: friend._id } });
    await usersCol.updateOne({ _id: friend._id }, { $addToSet: { friends: agent._id } });
    
    console.log(`Successfully made ${agent.name} friends with ${friend.name}`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
