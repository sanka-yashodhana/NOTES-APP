require("dotenv").config();

const mongoose = require("mongoose");

const connectionString = process.env.MONGODB_URL;

const connectDB = async()=>{

    mongoose.connection.on('connected', ()=>{
        console.log("DB Connected")
    })

   await mongoose.connect(`${connectionString}/Note-App-New`)
}


connectDB();

const User = require("./models/userModel.js");
const Note = require("./models/noteModel.js");

const express = require("express");
const cors = require("cors");

const app = express();

const jwt = require("jsonwebtoken");
const { authenticateToken } = require("./utilities");

app.use(cors({ origin: "*" }));

//Create a Account
app.post("/create-account", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const isUser = await User.findOne({
    email: email,
  });

  if (isUser) {
    return res.status(400).json({
      error: true,
      message: "User already exists",
    });
  }

  const user = new User({
    fullName,
    email,
    password,
  });

  await user.save();

  const accessToken = jwt.sign({ user }, process.env.JWT_SECRET, {
    expiresIn: "3d",
  });

  return res.json({
    error: false,
    user,
    accessToken,
    message: "registration Successful",
  });
});

//Login User
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const userInfo = await User.findOne({ email: email });

  if (!userInfo) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  if (userInfo.email === email && userInfo.password === password) {
    const user = { user: userInfo };

    const accessToken = jwt.sign(user, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.json({
      error: false,
      message: "Login Successful",
      email,
      accessToken,
    });
  } else {
    return res.status(400).json({
      error: true,
      message: "Invalid Credentials",
    });
  }
});

//Get User
app.get("/get-user", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const isUser = await User.findOne({ _id: user._id });

    if (!isUser) {
      return res.status(404).json({
        error: true,
        message: "User not found",
      });
    }

    return res.status(200).json({
      error: false,
      user: {
        fullName: isUser.fullName,
        email: isUser.email,
        id: isUser._id,
        createdOn: isUser.createdOn,
      },
      message: "User retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Add Note
app.post("/add-note", authenticateToken, async (req, res) => {
  const { title, content, tags } = req.body;
  const { user } = req.user;

  if (!title || !content) {
    return res.status(400).json({
      error: true,
      message: "Title and Content are required",
    });
  }

  try {
    const note = new Note({
      title,
      content,
      tags: tags || [],
      userId: user._id,
    });

    await note.save();

    return res.status(201).json({
      error: false,
      note,
      message: "Note added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Edit Note
app.put("/edit-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { title, content, tags } = req.body;
  const { user } = req.user;

  if (!title && !content && !tags) {
    return res.status(400).json({
      error: true,
      message: "No changes provided",
    });
  }

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found",
      });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (tags) note.tags = tags;

    await note.save();

    return res.status(200).json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Get All Notes
app.get("/get-notes", authenticateToken, async (req, res) => {
  const { user } = req.user;

  try {
    const notes = await Note.find({ userId: user._id }).sort({
      isPinned: -1,
      createdOn: -1,
    });

    return res.status(200).json({
      error: false,
      notes,
      message: "All notes retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal server Error",
    });
  }
});

//Delete Note
app.delete("/delete-note/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { user } = req.user;

  try {
    const note = await Note.findOneAndDelete({ _id: noteId, userId: user._id });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found",
      });
    }

    return res.status(200).json({
      error: false,
      message: "Note deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//update Note pin value
app.put("/update-note-pin/:noteId", authenticateToken, async (req, res) => {
  const noteId = req.params.noteId;
  const { isPinned } = req.body;
  const { user } = req.user;

  try {
    const note = await Note.findOne({ _id: noteId, userId: user._id });

    if (!note) {
      return res.status(404).json({
        error: true,
        message: "Note not found",
      });
    }

    note.isPinned = isPinned;

    await note.save();

    return res.status(200).json({
      error: false,
      note,
      message: "Note updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

//Search Notes
app.get("/search-notes/", authenticateToken, async (req, res) => {
  const { user } = req.user;
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({
      error: true,
      message: "Search query is required",
    });
  }

  try {
    const matchingNotes = await Note.find({
      userId: user._id,
      $or: [
        { title: { $regex: query, $options: "i" } },
        { content: { $regex: query, $options: "i" } },
        { tags: { $regex: query, $options: "i" } },
      ],
    });

    return res.status(200).json({
      error: false,
      notes: matchingNotes,
      message: "Search results retrieved successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
    });
  }
});

const PORT = process.env.PORT || 8000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
