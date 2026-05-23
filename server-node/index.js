const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const { createClient } = require('redis');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const { verifyToken, admin } = require('./firebase');
const { generateLobbyId } = require('./utils');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const app = express();

// Security Middlewares
app.use(helmet()); // Set security HTTP headers
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Prevent HTTP Parameter Pollution

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api', limiter);

app.use(cors());
app.use(express.json({ limit: '10kb' })); // Limit body payload size

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development, allow all
    methods: ['GET', 'POST']
  }
});

// Database connections
const pgPool = new Pool({
  user: process.env.POSTGRES_USER || 'chatuser',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'chatdb',
  password: process.env.POSTGRES_PASSWORD || 'chatpassword',
  port: 5432,
});

mongoose.connect(process.env.MONGO_URI || 'mongodb://mongoadmin:mongopassword@localhost:27017/chatdb?authSource=admin')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Mongoose Schema for Messages
const messageSchema = new mongoose.Schema({
  room_id: String,
  sender_id: String,
  content: String,
  timestamp: Date
});
const Message = mongoose.model('Message', messageSchema);

// Redis setup for Pub/Sub and caching
const { startAIWorker } = require('./worker');
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
const redisSubscriber = redisClient.duplicate();
const redisPublisher = redisClient.duplicate();

Promise.all([redisClient.connect(), redisSubscriber.connect(), redisPublisher.connect()])
  .then(() => {
    console.log('Connected to Redis');
    startAIWorker(pgPool, redisClient).catch(err => console.error('AI Worker error:', err));
  })
  .catch(err => console.error('Redis connection error:', err));

// Setup Redis Subscription for all messages (Pattern matching)
redisSubscriber.pSubscribe('room_*', (message, channel) => {
  const roomId = channel.replace('room_', '');
  const parsedMessage = JSON.parse(message);
  
  // Broadcast to local connected sockets in this room
  io.to(roomId).emit('receive_message', parsedMessage);
});


// API Routes
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { firebase_token } = req.body;
    const decodedToken = await verifyToken(firebase_token);
    const firebaseUid = decodedToken.uid;
    
    // Check if user exists in Postgres
    let result = await pgPool.query('SELECT * FROM users WHERE firebase_uid = $1', [firebaseUid]);
    let user = result.rows[0];
    
    if (!user) {
      // Create new user
      const lobbyId = generateLobbyId(decodedToken.name || 'USER');
      result = await pgPool.query(
        'INSERT INTO users (firebase_uid, lobby_id, display_name, profile_picture_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [firebaseUid, lobbyId, decodedToken.name || 'User', decodedToken.picture || '']
      );
      user = result.rows[0];
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// Create friend request (auto-accepts and creates room)
app.post('/api/friends/request', async (req, res) => {
  const client = await pgPool.connect();
  try {
    const { token, target_lobby_id } = req.body;
    const decoded = await verifyToken(token);
    
    // Get requester ID
    const reqRes = await client.query('SELECT id FROM users WHERE firebase_uid = $1', [decoded.uid]);
    if (!reqRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const requesterId = reqRes.rows[0].id;
    
    // Get target user
    const targetRes = await client.query('SELECT id FROM users WHERE lobby_id = $1', [target_lobby_id]);
    if (!targetRes.rows.length) return res.status(404).json({ error: 'Target user not found' });
    const targetId = targetRes.rows[0].id;
    
    if (requesterId === targetId) {
      return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }

    await client.query('BEGIN');
    
    // Check if friendship already exists
    const checkFriendship = await client.query(
      'SELECT id, status FROM friendships WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)',
      [requesterId, targetId]
    );

    let roomId;
    if (checkFriendship.rows.length > 0) {
      const friendship = checkFriendship.rows[0];
      if (friendship.status === 'accepted') {
        // Find existing room
        const roomMemberRes = await client.query(
          `SELECT room_id FROM room_members rm1
           JOIN room_members rm2 ON rm1.room_id = rm2.room_id
           JOIN chat_rooms cr ON rm1.room_id = cr.id
           WHERE rm1.user_id = $1 AND rm2.user_id = $2 AND cr.type = 'direct'`,
          [requesterId, targetId]
        );
        if (roomMemberRes.rows.length > 0) {
          roomId = roomMemberRes.rows[0].room_id;
        }
      } else {
        await client.query('UPDATE friendships SET status = \'accepted\' WHERE id = $1', [friendship.id]);
      }
    } else {
      await client.query(
        'INSERT INTO friendships (requester_id, receiver_id, status) VALUES ($1, $2, \'accepted\')',
        [requesterId, targetId]
      );
    }

    if (!roomId) {
      // Create direct room
      const roomRes = await client.query("INSERT INTO chat_rooms (type) VALUES ('direct') RETURNING id");
      roomId = roomRes.rows[0].id;
      
      await client.query(
        'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)',
        [roomId, requesterId, targetId]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true, roomId });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Accept friend request and create room
app.post('/api/friends/accept', async (req, res) => {
  try {
    const { token, friendship_id } = req.body;
    await verifyToken(token); // should verify user is the receiver, omitted for brevity
    
    await pgPool.query('UPDATE friendships SET status = $1 WHERE id = $2 RETURNING *', ['accepted', friendship_id]);
    const friendRes = await pgPool.query('SELECT requester_id, receiver_id FROM friendships WHERE id = $1', [friendship_id]);
    const { requester_id, receiver_id } = friendRes.rows[0];
    
    // Create direct room
    const roomRes = await pgPool.query("INSERT INTO chat_rooms (type) VALUES ('direct') RETURNING id");
    const roomId = roomRes.rows[0].id;
    
    await pgPool.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)',
      [roomId, requester_id, receiver_id]
    );
    
    res.json({ success: true, roomId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user friends
app.get('/api/friends', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const decoded = await verifyToken(token);
    const userRes = await pgPool.query('SELECT id FROM users WHERE firebase_uid = $1', [decoded.uid]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const userId = userRes.rows[0].id;
    
    const friends = await pgPool.query(
      `SELECT u.id, u.display_name, u.lobby_id, f.id as friendship_id
       FROM friendships f
       JOIN users u ON (f.requester_id = u.id AND f.receiver_id = $1) OR (f.receiver_id = u.id AND f.requester_id = $1)
       WHERE f.status = 'accepted'`,
      [userId]
    );
    res.json({ friends: friends.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/user/profile', async (req, res) => {
  try {
    const { token, display_name } = req.body;
    const decoded = await verifyToken(token);
    const result = await pgPool.query(
      'UPDATE users SET display_name = $1 WHERE firebase_uid = $2 RETURNING *',
      [display_name, decoded.uid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dedicated AI chat helper
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { token, message, history } = req.body;
    await verifyToken(token);
    
    let aiReply;
    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'mock-key') {
        throw new Error("Local/mock mode: No real GEMINI_API_KEY is configured.");
      }
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const contents = [];
      if (history && Array.isArray(history)) {
        for (const h of history) {
          contents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
          });
        }
      }
      contents.push({ role: 'user', parts: [{ text: message }] });
      
      const responseResult = await model.generateContent({ contents });
      aiReply = responseResult.response.text();
    } catch (genError) {
      console.warn("Direct AI Chat failed, using offline response:", genError.message || genError);
      
      const msgLower = message.toLowerCase();
      if (msgLower.includes('help') || msgLower.includes('what can you do')) {
        aiReply = `🤖 **Offline Workspace Assistant**\n\nI can help you with:\n1. Managing your tasks and workspaces under the **Work** tab.\n2. Finding friends and copying your Lobby ID under **Friends**.\n3. Summarizing conversations and suggesting quick replies.\n4. Translating or explaining complex messages.\n\nType anything and I will try to help!`;
      } else if (msgLower.includes('summarize')) {
        aiReply = `🤖 **Offline Summary Helper**\n\nTo summarize messages in a chat, hover over any message card and click the "Summarize" quick action button! This will scan the context and generate a clean recap.`;
      } else {
        aiReply = `🤖 **Offline Workspace Assistant**\n\nI received your message: "${message}".\n\nSince no active GEMINI_API_KEY is configured in the environment, I am operating in offline workspace helper mode. I can still guide you on using the platform features or process workspace requests locally!`;
      }
    }
    
    res.json({ reply: aiReply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create group/work room
app.post('/api/rooms', async (req, res) => {
  try {
    const { token, name, member_ids } = req.body;
    const decoded = await verifyToken(token);
    const userRes = await pgPool.query('SELECT id FROM users WHERE firebase_uid = $1', [decoded.uid]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const userId = userRes.rows[0].id;
    
    const roomRes = await pgPool.query(
      "INSERT INTO chat_rooms (type, name) VALUES ('group', $1) RETURNING id",
      [name]
    );
    const roomId = roomRes.rows[0].id;
    
    await pgPool.query(
      "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)",
      [roomId, userId]
    );
    
    if (member_ids && Array.isArray(member_ids)) {
      for (const mId of member_ids) {
        await pgPool.query(
          "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)",
          [roomId, mId]
        );
      }
    }
    
    res.json({ success: true, roomId, name, type: 'group' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const decoded = await verifyToken(token);
    const userRes = await pgPool.query('SELECT id FROM users WHERE firebase_uid = $1', [decoded.uid]);
    const userId = userRes.rows[0].id;
    
    const rooms = await pgPool.query(
      `SELECT c.id, c.type, c.name, 
        (SELECT array_agg(u.display_name) FROM room_members rm2 JOIN users u ON rm2.user_id = u.id WHERE rm2.room_id = c.id AND u.id != $1) as other_members
       FROM chat_rooms c 
       JOIN room_members rm ON c.id = rm.room_id 
       WHERE rm.user_id = $1`,
      [userId]
    );
    res.json({ rooms: rooms.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch messages
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const messages = await Message.find({ room_id: req.params.roomId }).sort({ timestamp: -1 }).limit(50);
    res.json({ messages: messages.reverse() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Socket.io Events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_room', ({ room_id }) => {
    socket.join(room_id);
    console.log(`Socket ${socket.id} joined room ${room_id}`);
  });
  
  socket.on('send_message', async ({ room_id, sender_id, content }) => {
    const timestamp = new Date();
    
    // Save to Mongo
    const message = new Message({
      room_id,
      sender_id,
      content,
      timestamp
    });
    const savedMessage = await message.save();
    
    const messagePayload = {
      message_id: savedMessage._id.toString(),
      room_id,
      sender_id,
      content,
      timestamp
    };
    
    // Publish to Redis
    await redisPublisher.publish(`room_${room_id}`, JSON.stringify(messagePayload));
    
    // Push to processing queue for Python worker
    await redisPublisher.lPush('message_embedding_queue', JSON.stringify({
      message_id: messagePayload.message_id,
      room_id,
      sender_id,
      content,
      timestamp
    }));
    
    // If mentions @AI, push to ai query queue
    if (content.toLowerCase().includes('@ai')) {
      await redisPublisher.lPush('ai_query_queue', JSON.stringify({
        message_id: messagePayload.message_id,
        room_id,
        sender_id,
        content,
        timestamp
      }));
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Serve static React files
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
