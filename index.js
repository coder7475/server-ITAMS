require('dotenv').config()
const express = require('express')
const app = express()
const cors = require('cors')
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@cluster0.xjslrno.mongodb.net/?retryWrites=true&w=majority`
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const { MongoClient, ServerApiVersion } = require('mongodb')
const port = process.env.PORT || 5000

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const myDB = client.db('assetsIT')
    const userCollection = myDB.collection("users")

    // users related apis
    // ? get all users in the database
    app.get('/api/v1/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // insert user into database
    // ? create user in users collection if it does not already exits
    app.post('/api/v1/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)

      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // check if user is admin
    app.get('/api/v1/users/admin/:email', async(req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;

      if (user){
        admin = user?.role === 'admin';
      }

      res.send({ admin })

    })

    // ? Payment Intent
    app.post("/api/v1/create-payment-intent", async(req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ['card']
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello ITAM!')
})

app.listen(port, () => {
  console.log(`ITAM Express app listening on port ${port}`)
})