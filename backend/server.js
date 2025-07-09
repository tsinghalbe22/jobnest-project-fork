// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// At the top with other imports
import Message from './models/message.js';

// Configure dotenv
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import routes
import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import eventsRoutes from './routes/events.js';
import usersRoutes from './routes/users.js';
import atsRoutes from './routes/ats.js';
import applicationsRoutes from './routes/applications.js';
import userRoutes from './routes/userRoutes.js';
import embeddingRoutes from './routes/embedding.js';
import recommendationRoutes from './routes/recommendations.js';
import jobSeekerRoutes from './routes/jobSeekerRoutes.js';
import testEmailRoutes from './routes/testEmail.js';
import chatRoutes from './routes/chat.js';

// ===================================
// INITIALIZE APP & UNIFIED SERVER
// ===================================
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors({
  origin: "https://jobnest-project.onrender.com",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploads directory
const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Serve static files from the root directory (for test HTML files)
app.use(express.static(__dirname));

// Add a route to check if uploads directory is accessible
app.get('/api/check-uploads', async (req, res) => {
  const fs = await import('fs');
  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log('Created uploads directory');
    }
    res.json({ success: true, message: 'Uploads directory is accessible' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Socket.io message history storage
const messageHistory = {};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`✅ Socket.IO: User Connected - ${socket.id}`);
  
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`Socket.IO: User ${socket.id} joined room ${room}`);
    
    // Send message history to the user when they join a room
    if (messageHistory[room]) {
      socket.emit('message_history', messageHistory[room]);
    }
  });

  socket.on('send_message', (data) => {
    // Store message in history
    if (!messageHistory[data.room]) {
      messageHistory[data.room] = [];
    }
    messageHistory[data.room].push(data);
    
    // This broadcasts the message to everyone else in the same room
    socket.to(data.room).emit('receive_message', data);
    console.log(`Socket.IO: Message sent to room ${data.room}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket.IO: User Disconnected - ${socket.id}`);
  });
});

// ===================================
// API ROUTES
// ===================================
app.use('/api/auth', authRoutes);
app.use('/api/auth/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ats', atsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/embedding', embeddingRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api', jobSeekerRoutes);
app.use('/api', testEmailRoutes);
app.use('/api/chat', chatRoutes);

// ✅ Add this route for frontend testing
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from backend!' });
});

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    // CRITICAL: Use server.listen(), NOT app.listen().
    // This starts the server that understands both HTTP requests and WebSocket connections.
    server.listen(PORT, () => {
      console.log(`🚀 Unified Server (API & Sockets) running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));
