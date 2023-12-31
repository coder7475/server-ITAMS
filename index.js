require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const uri = `mongodb+srv://${process.env.DB_USER_NAME}:${process.env.DB_PASSWORD}@cluster0.xjslrno.mongodb.net/?retryWrites=true&w=majority`;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(
  cors(
    {
    origin: [
      "http://localhost:5173",
      // "https://assetit-18c66.web.app",
      // "https://assetit-18c66.firebaseapp.com",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }
  )
);
app.use(express.json());
app.use(cookieParser());

// define middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized" });

  // verify with jwt token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(401).send({ message: "Unauthorized" });

    // token passed verification
    req.user = decoded;
  });
  next();
};

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
    app.get("/api/v1/users", verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // get all requests from the database

    // get all reques of a company
    app.get(
      "/api/v1/admin/allRequest/:company",
      verifyToken,
      async (req, res) => {
        const company = req.params.company;
        const query = { company };
        // console.log(query);
        // Search By name
        const value = req?.query?.search;

        if (value) {
          query["name"] = { $regex: value, $options: "i" };
        }
        const result = await requestCollection.find(query).toArray();
        res.send(result);
      }
    );

    // get all data needed for user homer
    app.get("/api/v1/user/homeStats/:email", async (req, res) => {
      const email = req.params.email;
      const company = req.query.company;

      const queryByEmail = { requesterEmail : email };
      const queryByCompany = { company }

      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();
      const monthlyQuery = {
        requestDate: {
          $gte: startOfMonth,
          $lte: endOfMonth
        },
        requesterEmail : email
      }

      const customRequests = await customRequestsCol.find(queryByEmail).toArray();
      const pendingRequests = await requestCollection.find({ requesterEmail : email, status: "pending" }).toArray();
      const monthlyRequests = await requestCollection.find(monthlyQuery).sort({ requestDate: -1 }).toArray();
      const mostRequested = await assetCollection.find(queryByCompany).sort({ requested: -1 }).limit(4).toArray();

      res.send({ customRequests, pendingRequests, monthlyRequests, mostRequested });
    })
    

    // approve request
    app.put(
      "/api/v1/admin/approveRequest/:name",
      verifyToken,
      async (req, res) => {
        const name = req.params.name;
        const filter = { name };

        // const data = req.body;
        // console.log(data);
        const updatedDoc = {
          $set: {
            status: "approved",
          },
        };
        const updatedDoc2 = {
          $inc: { quantity: -1, requested: 1 },
        };
        // console.log(data);
        const result = await requestCollection.updateOne(filter, updatedDoc);
        const result2 = await assetCollection.updateOne(filter, updatedDoc2);
        res.send({ result, result2 });
      }
    );

    // rejectRequest
    app.put(
      "/api/v1/admin/rejectRequest/:name",
      verifyToken,
      async (req, res) => {
        const name = req.params.name;
        const filter = { name };

        // const data = req.body;
        // console.log(data);
        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };

        // console.log(data);
        const result = await requestCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // reject custom Request
    app.put(
      "/api/v1/admin/rejectCustomRequest/:name",
      verifyToken,
      async (req, res) => {
        const name = req.params.name;
        const filter = { name };

        const updatedDoc = {
          $set: {
            status: "rejected",
          },
        };

        // console.log(data);
        const result = await customRequestsCol.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // get all custom request
    app.get(
      "/api/v1/admin/allCustomRequest/:company",
      verifyToken,
      async (req, res) => {
        const company = req.params.company;
        const query = { company };
        const result = await customRequestsCol.find(query).toArray();
        res.send(result);
      }
    );

    // approve custom request
    app.put(
      "/api/v1/admin/approveCustomRequest/:name",
      verifyToken,
      async (req, res) => {
        const name = req.params.name;
        const filter = { name };
        const data = req.body;
        // const data = req.body;
        // console.log(data);
        const updatedDoc = {
          $set: {
            status: "approved",
          },
        };

        const added = await assetCollection.insertOne(data);
        // console.log(data);
        const result = await customRequestsCol.updateOne(filter, updatedDoc);

        res.send({ added, result });
      }
    );

    // delete asset from the asset list
    app.delete(
      "/api/v1/admin/deleteAsset/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };

        const result = await assetCollection.deleteOne(query);
        res.send(result);
      }
    );

    // request for all asset of the company
    app.get("/api/v1/allAssets/:company", verifyToken, async (req, res) => {
      const company = req.params.company;
      // console.log(company);
      const query = { company };
      // Search By asset name
      const name = req.query.name;

      if (name) query["name"] = { $regex: name, $options: "i" };

      const result = await assetCollection.find(query).toArray();
      res.send(result);
    });

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
    app.patch("/api/v1/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
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
    app.post("/api/v1/create-payment-intent", verifyToken, async (req, res) => {
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
    app.post("/api/v1/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    });

    // Assets related api

    app.get("/api/v1/admin/allAssets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetCollection.findOne(query);
      res.send(result);
    });

    //? add a new asset to database
    app.post("/api/v1/admin/addAnAsset", verifyToken, async (req, res) => {
      const asset = req.body;
      const result = await assetCollection.insertOne(asset);
      res.send(result);
    });

    //? add an api to update an asset
    app.patch(
      "/api/v1/admin/updateAnAsset/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        // console.log(id);
        const filter = { _id: new ObjectId(id) };
        const data = req.body;
        const updatedDoc = {
          $set: data,
        };

        const result = await assetCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // update profile user data
    app.patch("/api/v1/updateProfile/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      // console.log(filter);
      const data = req.body;
      // console.log(data);
      const updatedDoc = {
        $set: data,
      };

      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // save asset request api
    app.post("/api/v1/user/makeAssetRequest", verifyToken, async (req, res) => {
      const request = req.body;
      const result = await requestCollection.insertOne(request);
      res.send(result);
    });

    // save custom request  api
    app.post(
      "/api/v1/user/makeCustomRequest",
      verifyToken,
      async (req, res) => {
        const custRequest = req.body;
        const result = await customRequestsCol.insertOne(custRequest);
        res.send(result);
      }
    );

    // update custom request 
    //? use requester email and request date to update the request
    // /:email?date=date
    app.patch("/api/v1/user/updateCustomRequest/:email", verifyToken, async (req, res) => {
      const requesterEmail = req.params.email;
      const date = req.query.date;
      
      const filter = {
        requesterEmail,
        date
      }

      // console.log(filter);
      const data = req.body;

      const updatedDoc = {
        $set: data
      }

      const result = await customRequestsCol.updateOne(filter, updatedDoc);
      res.send(result);
    })

    // admin home status
    app.get("/api/v1/admin/homeStatus/:company", async (req, res) => {
      const company = req.params.company;
      const query = { company };
      const filter = { status: "pending" };
      const sort = { requested: -1 };
      const stock = { quantity: { $lt: 10 } };

      const pendingRequests = await requestCollection
        .find(filter)
        .limit(5)
        .toArray();
      const topRequestedItems = await assetCollection
        .find(query)
        .sort(sort)
        .limit(4)
        .toArray();
      const limitedStockItems = await assetCollection.find(stock).toArray();
      const returnableItems = await requestCollection.countDocuments({
        type: "returnable",
      });
      const nonReturnableItems = await requestCollection.countDocuments({
        type: "non-returnable",
      });

      res.send({
        pendingRequests,
        topRequestedItems,
        limitedStockItems,
        returnableItems,
        nonReturnableItems,
      });
    });

    // add a user to the team via admin
    app.put("/api/v1/admin/addToTeam/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const data = req.body;
      const updatedDoc = {
        $set: data,
      };
      // console.log(data);
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // remove a user to the team via admin
    app.put(
      "/api/v1/admin/removeFromTeam/:id",
      verifyToken,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const data = req.body;
        const updatedDoc = {
          $unset: data,
        };
        // console.log(data);
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // auth jwt realted api
    // Auth related api
    app.post("/api/v1/create-token", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          path: "/",
        })
        .send({ success: true });
    });

    // clear cookies
    app.get("/api/v1/clear-token", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          path: "/",
        })
        .send({ success: true });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
