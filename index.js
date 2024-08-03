const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const port = process.env.PORT || 3001;
const bodyParser = require("body-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Middleware
const corsOptions = {
  origin: ["http://localhost:5173", "https://job-task1-web.vercel.app/"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qoryues.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.log(error);
  }
};
dbConnect();

const usersCollection = client.db("jobTask1").collection("users");
const requestsCollection = client.db("jobTask1").collection("requests");

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ message: "Access denied" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      console.log("Token verification failed", err);
      return res.status(403).json({ message: "Invalid token" });
    }

    req.user = user;
    next();
  });
};

// User authentication API with password verification
app.post("/api/authenticate", async (req, res) => {
  const { emailOrPhone, password } = req.body;

  try {
    const user = await usersCollection.findOne({
      $or: [{ email: emailOrPhone }, { phoneNumber: emailOrPhone }],
    });

    if (!user) {
      console.log("User not found");
      return res
        .status(401)
        .json({ message: "Invalid email/phone number or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      console.log("Invalid password");
      return res
        .status(401)
        .json({ message: "Invalid email/phone number or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token, id: user._id }); //todo: send here user ID replace this 'role: user.role'
  } catch (error) {
    console.error("Error during authentication:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// User status change API (Protected)
// app.patch('/users/status/:id', authenticateToken, async (req, res) => {
//     const { id } = req.params;
//     const { status } = req.body;

//     try {
//         const user = await usersCollection.findOne({ _id: new ObjectId(id) });
//         if (!user) {
//             return res.status(404).json({ message: 'User not found' });
//         }
//         const updateData = { status };
//         // Add currentBalance only if it doesn't already exist
//         if (user.currentBalance === undefined) {
//             updateData.currentBalance = 40;
//         }
//         const result = await usersCollection.updateOne(
//             { _id: new ObjectId(id) },
//             { $set: updateData }
//         );
//         if (result.modifiedCount > 0) {
//             res.json({ modifiedCount: result.modifiedCount });
//         } else {
//             res.status(404).json({ message: 'User not found or status already set' });
//         }
//     } catch (error) {
//         console.error('Error updating user status:', error);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// });
// app.patch('/users/status/:id', authenticateToken, async (req, res) => {
//     const { id } = req.params;
//     const { status } = req.body;

//     try {
//         const user = await usersCollection.findOne({ _id: new ObjectId(id) });
//         if (!user) {
//             return res.status(404).json({ message: 'User not found' });
//         }

//         const updateData = { status };

//         // Add currentBalance only if status is changing from pending to active and currentBalance is undefined
//         if (status === 'active' && user.status === 'pending' && user.currentBalance === undefined) {
//             updateData.currentBalance = user.role === 'agent' ? 5000 : 40;
//         }

//         const result = await usersCollection.updateOne(
//             { _id: new ObjectId(id) },
//             { $set: updateData }
//         );

//         if (result.modifiedCount > 0) {
//             res.json({ modifiedCount: result.modifiedCount });
//         } else {
//             res.status(404).json({ message: 'User not found or status already set' });
//         }
//     } catch (error) {
//         console.error('Error updating user status:', error);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// });

// dashboard component id specific user role finiding api

app.patch("/users/status/:id", authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(id) });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updateData = { status };
    let newTransaction = null;

    // Add currentBalance only if status is changing from pending to active and currentBalance is undefined
    if (
      status === "active" &&
      user.status === "pending" &&
      user.currentBalance === undefined
    ) {
      const bonusAmount = user.role === "agent" ? 5000 : 40;
      updateData.currentBalance = bonusAmount;
      newTransaction = {
        id: new ObjectId(),
        date: new Date(),
        type: "incoming",
        senderName: "admin",
        amount: bonusAmount,
      };
    }

    if (newTransaction) {
      if (!user.transactions) {
        user.transactions = [];
      }
      user.transactions.push(newTransaction);
      updateData.transactions = user.transactions;
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.modifiedCount > 0) {
      res.json({ modifiedCount: result.modifiedCount });
    } else {
      res.status(404).json({ message: "User not found or status already set" });
    }
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// for dashboard
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await usersCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ role: user.role });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/users", async (req, res) => {
  const { name, email, phoneNumber, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { name, email, phoneNumber, password: hashedPassword, role };

    const query = { email: user.email };
    const userExist = await usersCollection.findOne(query);
    if (userExist) {
      return res
        .status(200)
        .json({ message: "User is already in the database", insertedId: null });
    }

    const result = await usersCollection.insertOne(user);
    res.status(200).json({
      message: "User added to the database",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Error during user registration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await usersCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// api for CashIn component to find user based on the phone number
// Get user by ID
app.get("/api/user/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(user);
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

app.get("/users/phone/:phoneNumber", async (req, res) => {
  const phoneNumber = req.params.phoneNumber;
  try {
    const user = await usersCollection.findOne({ phoneNumber });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(user);
  } catch (error) {
    console.error("Error fetching user by phone number:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// transaction related apis

app.post("/sendRequest", async (req, res) => {
  const { agentPhoneNumber, userPhoneNumber, amount, status, date, type } =
    req.body;

  try {
    const request = {
      agentPhoneNumber,
      userPhoneNumber,
      amount,
      status,
      date,
      type,
    };

    const result = await requestsCollection.insertOne(request);
    res.status(200).json({
      message: "User added to the database",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Error during user registration:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/cashRequests", async (req, res) => {
  try {
    const result = await requestsCollection.find().toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching cash requests:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// agent management component

// Get User by Phone Number
app.get("/users/phones/:phoneNumber", async (req, res) => {
  const { phoneNumber } = req.params;
  try {
    const user = await usersCollection.findOne({ phoneNumber });
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error fetching user by phone number:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(user);
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Update User Balance

app.patch("/users/:id/balance", async (req, res) => {
  const { id } = req.params;
  const { balance } = req.body;

  try {
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { currentBalance: balance } }
    );

    if (result.modifiedCount > 0) {
      res.json({ message: "Balance updated successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error("Error updating user balance:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add Transaction
app.post("/transactions", async (req, res) => {
  const { userId, date, type, direction, senderName, amount } = req.body;

  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const transaction = {
      id: new ObjectId(),
      date: new Date(date),
      type,
      direction,
      senderName,
      amount,
    };

    user.transactions = user.transactions || [];
    user.transactions.push(transaction);

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { transactions: user.transactions } }
    );

    if (result.modifiedCount > 0) {
      res.json({ message: "Transaction added successfully" });
    } else {
      res.status(500).json({ message: "Failed to add transaction" });
    }
  } catch (error) {
    console.error("Error adding transaction:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Delete Request

app.delete("/requests/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await requestsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount > 0) {
      res.json({ message: "Request deleted successfully" });
    } else {
      res.status(404).json({ message: "Request not found" });
    }
  } catch (error) {
    console.error("Error deleting request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// agent current balance

app.get("/api/agentBalance/:id", async (req, res) => {
  try {
    const user = await usersCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ balance: user.currentBalance });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// agent history

app.get("/api/agentHistory/:userId", async (req, res) => {
  try {
    const user = await usersCollection.findOne({
      _id: new ObjectId(req.params.userId),
    });
    console.log(user.transactions);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ transactions: user.transactions }); // Assuming transactions is an array in user document
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// user related apis

// user current balance

app.get("/api/userCurrentBalance/:id", async (req, res) => {
  try {
    const user = await usersCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ balance: user.currentBalance });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//----------------------------------------------------//
//
//
// node server code
app.get("/", (req, res) => {
  res.send("Job Task 1 server is running..........");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
