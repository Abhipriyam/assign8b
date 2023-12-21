let express = require("express");
let app = express();
app.use(express.json());
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH,DELETE,HEAD"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-with, Content-Type,Accept"
  );
  next();
});
var port = process.env.PORT || 2410;
// const port = 2410;
app.listen(port, () => console.log(`Node app listening on port ${port}!`));

let { Client } = require("pg");
let client = new Client({
  user: "postgres",
  password: "anr(.-TmNaf5tzi",
  database: "postgres",
  port: 5432,
  host: "db.arnwpdjvjfgirpadvkbh.supabase.co",
  ssl: { rejectUnauthorized: false },
});
client.connect(function (res, error) {
  console.log(`Connected!!!`);
});

app.get("/shops/view", function (req, res) {
  client.query("SELECT * FROM shops", (error, result) => {
    if (error) {
      console.error("Error executing PostgreSQL query:", error);
      res.status(500).send("Internal Server Error");
    } else {
      res.send(result.rows);
    }
  });
});

app.get("/products/view", function (req, res) {
  client.query("SELECT * FROM products", (error, result) => {
    if (error) {
      console.error("Error executing PostgreSQL query:", error);
      res.status(500).send("Internal Server Error");
    } else {
      res.send(result.rows);
    }
  });
});

app.get("/products/edit/:id", (req, res) => {
  const productid = req.params.id;

  client.query(
    'SELECT * FROM products WHERE "productid" = $1',
    [productid],
    (error, result) => {
      if (error) {
        console.error("Error executing PostgreSQL query:", error);
        res.status(500).send("Internal Server Error");
      } else {
        res.send(result.rows);
      }
    }
  );
});

app.get("/purchases", (req, res) => {
  const productidArray = req.query.product ? req.query.product.split(",") : [];
  let shopid = req.query.shop;
  const sort = req.query.sort; // Added sort parameter
  // Convert the array elements to integers

  const productIDs = productidArray.map(item => item.substring(2));
  
  shopid = shopid?.substring(2);

  if (!productIDs.length && !shopid) {
    client.query(
      `
            SELECT purchases.*, products.productname, shops.shopname as shopname
            FROM purchases
            LEFT JOIN products ON purchases.productid = products.productid
            LEFT JOIN shops ON purchases.shopid = shops.shopid
            ${getOrderByClause(sort)}
          `,
      (error, result) => {
        if (error) {
          console.error("Error executing PostgreSQL query:", error);
          return res.status(500).send("Internal Server Error");
        }
        res.send(result.rows);
      }
    );
    return;
  }

  // Filter purchases based on the provided product ID and/or shop ID
  let whereClause = "";
  let values = [];

  if (productIDs.length && shopid) {
    // If both product ID array and shop ID are provided
    whereClause =
      "WHERE purchases.productid = ANY($1) AND purchases.shopid = $2";
    values = [productIDs, shopid];
  } else if (productIDs.length) {
    // If only product ID array is provided
    whereClause = "WHERE purchases.productid = ANY($1)";
    values = [productIDs];
  } else if (shopid) {
    // If only shop ID is provided
    whereClause = "WHERE purchases.shopid = $1";
    values = [shopid];
  }

  client.query(
    `
          SELECT purchases.*, products.productname, shops.shopname as shopname
          FROM purchases
          LEFT JOIN products ON purchases.productid = products.productid
          LEFT JOIN shops ON purchases.shopid = shops.shopid
          ${whereClause}
          ${getOrderByClause(sort)}
        `,
    values,
    (error, result) => {
      if (error) {
        console.error("Error executing PostgreSQL query:", error);
        return res.status(500).send("Internal Server Error");
      }

      const purchasesWithDetails = result.rows.map((purchase) => ({
        purchaseid: purchase.purchaseid,
        productid: purchase.productid,
        productname: purchase.productname || "Product Not Found",
        shopid: purchase.shopid,
        shopname: purchase.shopname || "Shop Not Found",
        quantity: purchase.quantity,
        price: purchase.price,
      }));

      res.send(purchasesWithDetails);
    }
  );
});

function getOrderByClause(sort) {
  if (sort === "QtyAsc") {
    return "ORDER BY purchases.quantity ASC";
  } else if (sort === "QtyDesc") {
    return "ORDER BY purchases.quantity DESC";
  } else if (sort === "ValueAsc") {
    return "ORDER BY purchases.quantity * purchases.price ASC";
  } else if (sort === "ValueDesc") {
    return "ORDER BY purchases.quantity * purchases.price DESC";
  } else {
    return ""; // Default order
  }
}

app.get("/shops/purchases/:id", (req, res) => {
  const shopid = req.params.id;

  // Find the shop based on the provided id
  client.query(
    'SELECT * FROM shops WHERE "shopid" = $1',
    [shopid],
    (shopError, shopResult) => {
      if (shopError) {
        console.error("Error executing PostgreSQL query:", shopError);
        return res.status(500).send("Internal Server Error");
      }

      const shop = shopResult.rows[0];

      if (!shop) {
        return res.status(404).send("Shop not found");
      }

      // Filter purchases for the specific shop
      client.query(
        'SELECT * FROM purchases WHERE "shopid" = $1',
        [shopid],
        (purchaseError, purchaseResult) => {
          if (purchaseError) {
            console.error("Error executing PostgreSQL query:", purchaseError);
            return res.status(500).send("Internal Server Error");
          }

          // Include the shop name in each purchase record
          const shopPurchases = purchaseResult.rows.map((purchase) => {
            return {
              ...purchase,
              shopname: shop.shopname,
            };
          });

          res.send(shopPurchases);
        }
      );
    }
  );
});

app.post("/shops/add", (req, res) => {
  const newShop = req.body;
  if (!newShop.shopname || !newShop.rent) {
    return res.status(400).send({ error: "Name and rent are required" });
  }

  // Check if a shop with the same name already exists
  client.query(
    'SELECT * FROM shops WHERE "shopname" = $1',
    [newShop.shopname],
    (existingShopError, existingShopResult) => {
      if (existingShopError) {
        console.error("Error executing PostgreSQL query:", existingShopError);
        return res.status(500).send("Internal Server Error");
      }

      if (existingShopResult.rows.length > 0) {
        return res
          .status(400)
          .send({ error: "A Shop with this name already exists." });
      }

      // Insert the new shop into the database
      client.query(
        'INSERT INTO shops ("shopname", "rent") VALUES ($1, $2) RETURNING *',
        [newShop.shopname, newShop.rent],
        (insertShopError, insertShopResult) => {
          if (insertShopError) {
            console.error("Error executing PostgreSQL query:", insertShopError);
            return res.status(500).send("Internal Server Error");
          }

          const insertedShop = insertShopResult.rows[0];

          res.send(insertedShop);
        }
      );
    }
  );
});

app.get("/shops/totalpurchases/:shopid", (req, res) => {
  const shopid = parseInt(req.params.shopid);

  // Check if the shop exists
  client.query(
    'SELECT * FROM shops WHERE "shopid" = $1',
    [shopid],
    (shopError, shopResult) => {
      if (shopError) {
        console.error("Error executing PostgreSQL query:", shopError);
        return res.status(500).send("Internal Server Error");
      }

      const shop = shopResult.rows[0];

      if (!shop) {
        return res.status(404).send("Shop not found");
      }

      // Retrieve total purchases for the specific shop
      client.query(
        'SELECT "productid", SUM("quantity") AS "totalQuantity" FROM purchases WHERE "shopid" = $1 GROUP BY "productid"',
        [shopid],
        (purchasesError, purchasesResult) => {
          if (purchasesError) {
            console.error("Error executing PostgreSQL query:", purchasesError);
            return res.status(500).send("Internal Server Error");
          }

          // Fetch product names for each product
          const productids = purchasesResult.rows.map(
            (purchase) => purchase.productid
          );

          client.query(
            'SELECT "productid", "productname" FROM products WHERE "productid" = ANY($1)',
            [productids],
            (productsError, productsResult) => {
              if (productsError) {
                console.error(
                  "Error executing PostgreSQL query:",
                  productsError
                );
                return res.status(500).send("Internal Server Error");
              }

              const productnamesMap = new Map(
                productsResult.rows.map((product) => [
                  product.productid,
                  product.productname,
                ])
              );

              // Create the result array with product names
              const result = purchasesResult.rows.map((purchase) => ({
                productid: purchase.productid,
                totalQuantity: purchase.totalQuantity,
                shopname: shop.shopname,
                productname: productnamesMap.get(purchase.productid),
              }));

              res.send(result);
            }
          );
        }
      );
    }
  );
});

app.post("/products/add", (req, res) => {
  const newProduct = req.body;

  if (
    !newProduct.productname ||
    !newProduct.category ||
    !newProduct.description
  ) {
    return res
      .status(400)
      .send({ error: "Name, category, and description are required" });
  }

  // Insert the new product into the database
  client.query(
    'INSERT INTO products ("productname", "category", "description") VALUES ($1, $2, $3) RETURNING "productid"',
    [newProduct.productname, newProduct.category, newProduct.description],
    (insertError, insertResult) => {
      if (insertError) {
        console.error("Error executing PostgreSQL query:", insertError);
        return res.status(500).send("Internal Server Error");
      }

      const productid = insertResult.rows[0].productid;
      console.log(productid);
      // Update the newProduct object with the generated productid
      newProduct.productid = productid;

      // Send the updated list of products
      res.send(newProduct);
    }
  );
});

app.put("/products/edit/:id", (req, res) => {
  const id = +req.params.id;
  const { productname, category, description } = req.body;

  // Update the product in the database using PostgreSQL UPDATE query
  client.query(
    'UPDATE products SET "productname" = $1, "category" = $2, "description" = $3 WHERE "productid" = $4 RETURNING *',
    [productname, category, description, id],
    (err, result) => {
      if (err) {
        console.error("Error executing PostgreSQL query:", err);
        res.status(500).json({ error: "Internal Server Error" });
      } else {
        if (result.rows.length > 0) {
          const updatedProduct = result.rows[0];
          res.status(200).json(updatedProduct);
        } else {
          res.status(404).json({ message: "Product not found" });
        }
      }
    }
  );
});

app.get("/products/purchases/:id", function (req, res) {
  const id = req.params.id;

  // Retrieve purchases and product information using SQL JOIN query
  client.query(
    `SELECT p.*, pr.productname
      FROM purchases p
      INNER JOIN products pr ON p.productid = pr.productid
      WHERE p.productid = $1`,
    [id],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        if (result.rows.length > 0) {
          let productPurchases = result.rows;
          res.status(200).json(productPurchases);
        } else {
          res.status(404).json({ message: "Product not found" });
        }
      }
    }
  );
});
app.get("/products/totalpurchases/:productid", (req, res) => {
  const productid = parseInt(req.params.productid);

  // Find the product based on the provided productid
  client.query(
    'SELECT "productname" FROM products WHERE "productid" = $1',
    [productid],
    (productError, productResult) => {
      if (productError) {
        console.error("Error executing PostgreSQL query:", productError);
        return res.status(500).send("Internal Server Error");
      }

      const product = productResult.rows[0];

      if (!product) {
        return res.status(404).send("Product not found");
      }

      // Filter purchases for the specific product
      client.query(
        'SELECT * FROM purchases WHERE "productid" = $1',
        [productid],
        (purchasesError, purchasesResult) => {
          if (purchasesError) {
            console.error("Error executing PostgreSQL query:", purchasesError);
            return res.status(500).send("Internal Server Error");
          }

          const productPurchases = purchasesResult.rows;

          // Create a map to store the total quantity for each shop
          const shopTotalQuantityMap = new Map();

          // Aggregate total quantity for each shop
          productPurchases.forEach((purchase) => {
            const shopid = purchase.shopid;
            const quantity = purchase.quantity;

            if (shopTotalQuantityMap.has(shopid)) {
              // If shop exists in the map, update the total quantity
              shopTotalQuantityMap.set(
                shopid,
                shopTotalQuantityMap.get(shopid) + quantity
              );
            } else {
              // If shop doesn't exist in the map, add it with the initial quantity
              shopTotalQuantityMap.set(shopid, quantity);
            }
          });

          // Convert the map to an array of objects, including product name
          const result = Array.from(
            shopTotalQuantityMap,
            ([shopid, totalQuantity]) => ({
              shopid: shopid,
              totalQuantity: totalQuantity,
              productname: product.productname,
            })
          );

          res.send(result);
        }
      );
    }
  );
});
