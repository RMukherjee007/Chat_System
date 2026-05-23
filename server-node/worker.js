const mongoose = require('mongoose');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ensure Message model is registered
const messageSchema = new mongoose.Schema({
  room_id: String,
  sender_id: String,
  content: String,
  timestamp: Date
});
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// Configure Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'mock-key');

async function getEmbedding(text, isQuery = false) {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key') {
      throw new Error("Local/mock mode: No real GEMINI_API_KEY is configured.");
    }
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      taskType: isQuery ? "RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT"
    });
    return result.embedding.values;
  } catch (error) {
    console.warn("Gemini embedding generation error (using local fallback vector):", error.message || error);
    // Generate a deterministic 768-dimension vector based on text hashing
    const vector = [];
    let hash = 0;
    const cleanText = text || '';
    for (let i = 0; i < cleanText.length; i++) {
      hash = (hash << 5) - hash + cleanText.charCodeAt(i);
      hash |= 0;
    }
    for (let i = 0; i < 768; i++) {
      vector.push(Math.sin(hash + i) * 0.1);
    }
    return vector;
  }
}

async function startAIWorker(pgPool, redisClient) {
  console.log("Starting Node.js AI Background Worker...");
  
  // Create a duplicate redis client for blocking pop
  const workerRedis = redisClient.duplicate();
  await workerRedis.connect();
  
  // Background loop for embeddings
  const processEmbeddingsLoop = async () => {
    while (true) {
      try {
        const res = await workerRedis.brPop('message_embedding_queue', 0);
        if (res && res.element) {
          const data = JSON.parse(res.element);
          const { message_id, room_id, sender_id, content, timestamp } = data;
          console.log(`[Worker] Processing embedding for message: ${message_id}`);
          
          const embedding = await getEmbedding(content, false);
          
          // Resolve sender_id to user's UUID from Postgres
          let senderUuid = null;
          if (sender_id) {
            const userRes = await pgPool.query(
              'SELECT id FROM users WHERE lobby_id = $1 OR firebase_uid = $1 OR id::text = $1',
              [sender_id]
            );
            if (userRes.rows.length > 0) {
              senderUuid = userRes.rows[0].id;
            }
          }
          
          // Format embedding as pgvector string
          const embeddingStr = `[${embedding.join(',')}]`;
          
          // Store in Postgres
          await pgPool.query(
            `INSERT INTO message_embeddings (message_id, room_id, sender_id, timestamp, embedding)
             VALUES ($1, $2, $3, $4, $5::vector)
             ON CONFLICT (message_id) DO NOTHING`,
            [message_id, room_id, senderUuid, new Date(timestamp), embeddingStr]
          );
          console.log(`[Worker] Embedding successfully stored for message: ${message_id}`);
        }
      } catch (error) {
        console.error("[Worker] Error in embedding process loop:", error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // Background loop for @AI mentions
  const processAiQueryLoop = async () => {
    while (true) {
      try {
        const res = await workerRedis.brPop('ai_query_queue', 0);
        if (res && res.element) {
          const query = JSON.parse(res.element);
          const { message_id, room_id, sender_id, content, timestamp } = query;
          console.log(`[Worker] Processing @AI query for message: ${message_id}`);
          
          // 1. Vectorize the query
          const queryEmbedding = await getEmbedding(content, true);
          const embeddingStr = `[${queryEmbedding.join(',')}]`;
          
          // 2. Query Postgres for closest 10 embeddings in the same room
          const searchRes = await pgPool.query(
            `SELECT message_id, embedding <-> $1::vector AS distance
             FROM message_embeddings
             WHERE room_id = $2
             ORDER BY distance ASC
             LIMIT 10`,
            [embeddingStr, room_id]
          );
          
          const messageIds = searchRes.rows.map(row => row.message_id);
          
          let context = "Context messages from this chat room:\n";
          if (messageIds.length > 0) {
            // 3. Fetch raw texts from MongoDB
            const rawMessages = await Message.find({ _id: { $in: messageIds } });
            
            // Sort chronologically for better response quality
            rawMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            for (const msg of rawMessages) {
              context += `Message ID [${msg._id.toString()}] (from ${msg.sender_id}): ${msg.content}\n`;
            }
          } else {
            context += "(No previous messages found in history)\n";
          }
          
          // 4. Construct prompt
          const prompt = `
You are an intelligent AI assistant participating in a chat room. You have been tagged.
Use the following chat history context to answer the user's query.
When referring to previous context, cite the specific Message ID (e.g., [12345]).

${context}

User Query: ${content}
`;
          
          // 5. Generate Response
          let aiReply;
          try {
            if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key') {
              throw new Error("Local/mock mode: No real GEMINI_API_KEY is configured.");
            }
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const responseResult = await model.generateContent(prompt);
            aiReply = responseResult.response.text();
          } catch (genError) {
            console.warn("Gemini content generation failed, utilizing local RAG fallback:", genError.message || genError);
            
            // Build a highly professional local RAG reply citing messages
            if (messageIds.length > 0) {
              const citMsg = rawMessages[0];
              aiReply = `🤖 **Offline AI Assistant** (Local RAG Mode)

I have searched our chat history and retrieved **${messageIds.length}** relevant message(s).

Based on the message sent by **${citMsg.sender_id === 'AI_Bot' ? 'AI' : citMsg.sender_id}** (Message ID: [${citMsg._id.toString()}]):
> "${citMsg.content}"

Here is my response to your query "${content.replace('@AI', '').trim()}":
I am running locally without connection to the cloud Gemini API. However, according to our historical record [${citMsg._id.toString()}], we have discussing topics related to your query.

Let me know if you would like me to retrieve more messages or if you need assistance setting up the real API key!`;
            } else {
              aiReply = `🤖 **Offline AI Assistant** (Local RAG Mode)

I searched the chat history for "${content.replace('@AI', '').trim()}", but found no previous context in this room.

Please feel free to chat or add more history so I have context to pull from!`;
            }
          }
          
          // 6. Save AI reply to MongoDB
          const aiMessage = new Message({
            room_id,
            sender_id: 'AI_Bot',
            content: aiReply,
            timestamp: new Date()
          });
          const savedAiMsg = await aiMessage.save();
          
          // 7. Publish to Redis channel
          const aiResponsePayload = {
            message_id: savedAiMsg._id.toString(),
            room_id,
            sender_id: "AI_Bot",
            content: aiReply,
            timestamp: savedAiMsg.timestamp.toISOString()
          };
          
          await redisClient.publish(`room_${room_id}`, JSON.stringify(aiResponsePayload));
          console.log(`[Worker] @AI response generated and published for room: ${room_id}`);
        }
      } catch (error) {
        console.error("[Worker] Error in AI Query process loop:", error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

  // Run the loops concurrently
  processEmbeddingsLoop();
  processAiQueryLoop();
}

module.exports = { startAIWorker };
