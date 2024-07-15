const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 3001;
const { MongoClient, ServerApiVersion } = require('mongodb');


// middleares 
app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.qoryues.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const dbConnect = async () => {
    try {
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
        // Ensures that the client will close when you finish/error
        console.log(error);
    }
}
dbConnect();

const usersCollection = client.db("jobTask1").collection("users");


app.get('/menu', async (req, res) => {
    const result = await menuCollection.find().toArray();
    res.send(result);
})





































app.get('/', (req, res) => {
    res.send("Boss server is running..........");
})

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
})