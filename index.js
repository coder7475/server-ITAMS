require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@cluster0.xjslrno.mongodb.net/?retryWrites=true&w=majority`;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const myDB = client.db("assetsIT");
    const userCollection = myDB.collection("users");
    const paymentCollection = myDB.collection("payments");
    const assetCollection = myDB.collection("assets");
    const requestCollection = myDB.collection("requests");
    const customRequestsCol = myDB.collection("cusRequests");

    // users related apis
    // ? get all users in the database
    app.get("/api/v1/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get all requests from the database
    app.get("/api/v1/admin/allRequest/:company", async (req, res) => {
      const company = req.params.company;
      const query = { company };
      // console.log(query);
      // Search By name
      const value = req?.query?.search;
      
      if (value){
        query["name"] = { $regex: value, $options: 'i' };
      } 
      const result = await requestCollection.find(query).toArray();
      res.send(result);
    });
    // approve request
    app.put("/api/v1/admin/approveRequest/:name", async (req, res) => {
      const name = req.params.name;
      const filter = { name };
      
      // const data = req.body;
      // console.log(data);
      const updatedDoc = {
         $set: {
          status: "approved"
         }
      }
      const updatedDoc2 = {
        $inc: { quantity: -1 }
      }
      // console.log(data);
      const result = await requestCollection.updateOne(filter, updatedDoc);
      const result2 = await assetCollection.updateOne(filter, updatedDoc2);
      res.send({ result, result2});
    })

    // rejectRequest
    app.put("/api/v1/admin/rejectRequest/:name", async (req, res) => {
      const name = req.params.name;
      const filter = { name };
      
      // const data = req.body;
      // console.log(data);
      const updatedDoc = {
         $set: {
          status: "rejected"
         }
      }
    
      // console.log(data);
      const result = await requestCollection.updateOne(filter, updatedDoc);
      res.send(result);

    })

     // reject custom Request
     app.put("/api/v1/admin/rejectCustomRequest/:name", async (req, res) => {
      const name = req.params.name;
      const filter = { name };
      
      const updatedDoc = {
         $set: {
          status: "rejected"
         }
      }
    
      // console.log(data);
      const result = await customRequestsCol.updateOne(filter, updatedDoc);
      res.send(result);

    })

    // get all custom request
    app.get("/api/v1/admin/allCustomRequest/:company", async (req, res) => {
      const company = req.params.company;
      const query = { company };
      const result = await customRequestsCol.find(query).toArray();
      res.send(result);
    })

     // approve custom request
     app.put("/api/v1/admin/approveCustomRequest/:name", async (req, res) => {
      const name = req.params.name;
      const filter = { name };
      const data = req.body;
      // const data = req.body;
      // console.log(data);
      const updatedDoc = {
         $set: {
          status: "approved"
         }
      }

    
      const added = await assetCollection.insertOne(data);
      // console.log(data);
      const result = await customRequestsCol.updateOne(filter, updatedDoc);
      
      res.send({ added, result });
    })

    

    // request for all asset of the company
    app.get("/api/v1/allAssets/:company", async(req, res) => {
      const company = req.params.company;
      // console.log(company);
      const query = { company };
      // Search By asset name
      const name = req.query.name;

      if (name) query["name"] = { $regex: name, $options: 'i' };

  

      const result = await assetCollection.find(query).toArray();
      res.send(result);
    })

    // insert user into database
    // ? create user in users collection if it does not already exits
    app.post("/api/v1/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // check if user is admin
    //? get admins details
    app.get("/api/v1/users/admin/:email", async (req, res) => {
      const email = req.params.email;

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      // console.log(user);
      if (user) {
        admin = user?.role === "admin";
      }

      res.send({ admin, user });
    });

    // update the admin package payment from unpaid to paid
    app.patch("/api/v1/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const data = req.body;
      const query = { email: email };
      const updateDocument = {
        $set: {
          package: data,
        },
      };

      const result = await userCollection.updateOne(query, updateDocument);
      res.send(result);
    });

    // ? Payment Intent
    app.post("/api/v1/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // saved the payment history
    app.post("/api/v1/payments", async(req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    })

    // Assets related api

    //? add a new asset to database
    app.post("/api/v1/admin/addAnAsset", async(req, res) => {
      const asset = req.body;
      const result = await assetCollection.insertOne(asset);
      res.send(result);
    })

    // save asset request api
    app.post("/api/v1/user/makeAssetRequest", async(req, res) => {
      const request = req.body;
      const result = await requestCollection.insertOne(request);
      res.send(result);
    })

    // save custom request  api
    app.post("/api/v1/user/makeCustomRequest", async(req, res) => {
      const custRequest = req.body;
      const result = await customRequestsCol.insertOne(custRequest);
      res.send(result);
    })

    // add a user to the team via admin
    app.put("/api/v1/admin/addToTeam/:id", async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      const updatedDoc = {
        $set: data
      }
      // console.log(data);
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // remove a user to the team via admin
    app.put("/api/v1/admin/removeFromTeam/:id", async(req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      const updatedDoc = {
        $unset: data
      }
      // console.log(data);
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello ITAM!");
});

app.listen(port, () => {
  console.log(`ITAM Express app listening on port ${port}`);
});
