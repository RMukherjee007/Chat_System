const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const { verifyToken } = require('./firebase');
const { generateLobbyId } = require('./utils');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const xss = require('xss-clean');
const sanitizeHtml = require('sanitize-html');
const app = express();

// Security Middlewares
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());
app.use(xss());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP' }
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Strict limit for auth
  message: { error: 'Too many auth requests from this IP, please try again later' }
});
app.use('/api/auth', authLimiter);

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? process.env.CLIENT_URL : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

// IN-MEMORY DATABASES (No Docker/Postgres Required)
const db = {
  users: [], // { id, firebase_uid, lobby_id, display_name }
  friendships: [], // { id, requester_id, receiver_id, status }
  chat_rooms: [], // { id, type, name }
  room_members: [], // { room_id, user_id }
  messages: [] // { _id, room_id, sender_id, content, timestamp }
};

let nextUserId = 1;
let nextFriendshipId = 1;
let nextRoomId = 1;
let nextMessageId = 1;

// API Routes
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { firebase_token } = req.body;
    const decodedToken = await verifyToken(firebase_token);
    const firebaseUid = decodedToken.uid;
    
    let user = db.users.find(u => u.firebase_uid === firebaseUid);
    
    if (!user) {
      const lobbyId = generateLobbyId(decodedToken.name || 'USER');
      user = {
        id: nextUserId++,
        firebase_uid: firebaseUid,
        lobby_id: lobbyId,
        display_name: decodedToken.name || 'User',
      };
      db.users.push(user);
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// Create friend request (auto-accepts and creates room)
app.post('/api/friends/request', async (req, res) => {
  try {
    const { token, target_lobby_id } = req.body;
    const decoded = await verifyToken(token);
    
    const requester = db.users.find(u => u.firebase_uid === decoded.uid);
    if (!requester) return res.status(404).json({ error: 'User not found' });
    
    const target = db.users.find(u => u.lobby_id === target_lobby_id);
    if (!target) return res.status(404).json({ error: 'Target user not found' });
    
    if (requester.id === target.id) {
      return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }

    let friendship = db.friendships.find(f => 
      (f.requester_id === requester.id && f.receiver_id === target.id) ||
      (f.requester_id === target.id && f.receiver_id === requester.id)
    );

    let roomId;
    if (friendship) {
      friendship.status = 'accepted';
      // Find existing direct room
      const reqRooms = db.room_members.filter(rm => rm.user_id === requester.id).map(rm => rm.room_id);
      const targetRooms = db.room_members.filter(rm => rm.user_id === target.id).map(rm => rm.room_id);
      const commonRoomIds = reqRooms.filter(id => targetRooms.includes(id));
      
      const directRoom = db.chat_rooms.find(cr => cr.type === 'direct' && commonRoomIds.includes(cr.id));
      if (directRoom) roomId = directRoom.id;
    } else {
      friendship = {
        id: nextFriendshipId++,
        requester_id: requester.id,
        receiver_id: target.id,
        status: 'accepted'
      };
      db.friendships.push(friendship);
    }

    if (!roomId) {
      roomId = nextRoomId++;
      db.chat_rooms.push({ id: roomId, type: 'direct', name: null });
      db.room_members.push({ room_id: roomId, user_id: requester.id });
      db.room_members.push({ room_id: roomId, user_id: target.id });
    }
    
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
    const user = db.users.find(u => u.firebase_uid === decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const friendLinks = db.friendships.filter(f => f.status === 'accepted' && (f.requester_id === user.id || f.receiver_id === user.id));
    const friendIds = friendLinks.map(f => f.requester_id === user.id ? f.receiver_id : f.requester_id);
    
    const friends = db.users.filter(u => friendIds.includes(u.id)).map(u => ({
      id: u.id,
      display_name: u.display_name,
      lobby_id: u.lobby_id
    }));
    
    res.json({ friends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
app.put('/api/user/profile', async (req, res) => {
  try {
    const { token, display_name } = req.body;
    const decoded = await verifyToken(token);
    const user = db.users.find(u => u.firebase_uid === decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    user.display_name = display_name;
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate new random code (Lobby ID)
app.post('/api/user/generate-lobby-id', async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = await verifyToken(token);
    const user = db.users.find(u => u.firebase_uid === decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    user.lobby_id = newCode;
    
    res.json({ success: true, lobby_id: newCode });
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
        throw new Error("No real GEMINI_API_KEY");
      }
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
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
      console.warn("Direct AI Chat failed:", genError.message || genError);
      aiReply = "I received your message, but the AI module is failing to connect to Gemini. Error: " + (genError.message || genError.toString());
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
    const user = db.users.find(u => u.firebase_uid === decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const roomId = nextRoomId++;
    db.chat_rooms.push({ id: roomId, type: 'group', name });
    db.room_members.push({ room_id: roomId, user_id: user.id });
    
    if (member_ids && Array.isArray(member_ids)) {
      for (const mId of member_ids) {
        db.room_members.push({ room_id: roomId, user_id: mId });
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
    const user = db.users.find(u => u.firebase_uid === decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const userRoomIds = db.room_members.filter(rm => rm.user_id === user.id).map(rm => rm.room_id);
    const rooms = db.chat_rooms.filter(cr => userRoomIds.includes(cr.id)).map(cr => {
      const otherMembersIds = db.room_members.filter(rm => rm.room_id === cr.id && rm.user_id !== user.id).map(rm => rm.user_id);
      const otherMembers = db.users.filter(u => otherMembersIds.includes(u.id)).map(u => u.display_name);
      return { id: cr.id, type: cr.type, name: cr.name, other_members: otherMembers };
    });
    
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch messages
app.get('/api/rooms/:roomId/messages', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    const decoded = await verifyToken(token);
    const user = db.users.find(u => u.firebase_uid === decoded.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const roomIdStr = req.params.roomId;
    const roomId = isNaN(parseInt(roomIdStr)) ? roomIdStr : parseInt(roomIdStr);
    
    // Check if user is a member of this room
    const isMember = db.room_members.some(rm => rm.room_id === roomId && rm.user_id === user.id);
    if (!isMember) return res.status(403).json({ error: 'Not authorized to view this room' });
    
    const roomMessages = db.messages.filter(m => m.room_id === roomId).slice(-50);
    res.json({ messages: roomMessages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Socket.io Events
io.on('connection', (socket) => {
  socket.on('join_room', async ({ room_id, token }) => {
    try {
      if (!token) return;
      const decoded = await verifyToken(token);
      const user = db.users.find(u => u.firebase_uid === decoded.uid);
      if (!user) return;
      
      const isMember = db.room_members.some(rm => rm.room_id === room_id && rm.user_id === user.id);
      if (isMember) {
        socket.join(room_id);
      }
    } catch (e) {
      console.error("Socket join error:", e.message);
    }
  });
  
  socket.on('send_message', async ({ room_id, sender_id, content, token }) => {
    try {
      if (!token) return;
      const decoded = await verifyToken(token);
      const user = db.users.find(u => u.firebase_uid === decoded.uid);
      if (!user || user.lobby_id !== sender_id) return; // Verify sender_id matches the token's lobby_id
      
      const isMember = db.room_members.some(rm => rm.room_id === room_id && rm.user_id === user.id);
      if (!isMember) return;

      // Sanitize message content to prevent XSS attacks
      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: [], // Don't allow any HTML tags
        allowedAttributes: {}
      });
      
      if (!sanitizedContent.trim()) return;

    const message = {
      _id: 'msg_' + nextMessageId++,
      room_id,
      sender_id,
      content: sanitizedContent,
      timestamp: new Date()
    };
    db.messages.push(message);
    
    io.to(room_id).emit('receive_message', message);
  });
});

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
