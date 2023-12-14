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
const port = 2410;
app.listen(port, () => console.log(`Node app listening on port ${port}!`));
let { data } = require("./data.js");

app.get("/shops/view", function (req, res) {
  res.send(data.shops);
});

app.get("/products/view", function (req, res) {
  res.send(data.products);
});
app.get("/products/edit/:id", function (req, res) {
  const id = req.params.id;
  let result_pur = data.products.filter((item) => item.productId == id);
  res.send(result_pur);
});
// purchase filter
app.get("/purchases", function (req, res) {
  const productId = parseInt(req.query.productId);
  const shopId = parseInt(req.query.shopId);

  // If neither product ID nor shop ID is provided, send all purchases
  if (!productId && !shopId) {
    data.purchases = data.purchases.map((purchase) => {
      const product = data.products.find(
        (p) => p.productId === purchase.productid
      );
      const shop = data.shops.find((s) => s.shopId === purchase.shopId);

      return {
        ...purchase,
        productName: product ? product.productName : "Product Not Found",
        shopName: shop ? shop.name : "Shop Not Found",
      };
    });

    res.send(data.purchases);
    return;
  }

  // Filter purchases based on the provided product ID and/or shop ID
  let filteredPurchases;

  if (productId && shopId) {
    // If both product ID and shop ID are provided
    filteredPurchases = data.purchases.filter(
      (purchase) =>
        purchase.productid === productId && purchase.shopId === shopId
    );
  } else if (productId) {
    // If only product ID is provided
    filteredPurchases = data.purchases.filter(
      (purchase) => purchase.productid === productId
    );
  } else if (shopId) {
    // If only shop ID is provided
    filteredPurchases = data.purchases.filter(
      (purchase) => purchase.shopId === shopId
    );
  }

  // Fetch product and shop details for each purchase
  const result = filteredPurchases.map((purchase) => {
    const product = data.products.find(
      (p) => p.productId === purchase.productid
    );
    const shop = data.shops.find((s) => s.shopId === purchase.shopId);

    return {
      purchaseId: purchase.purchaseId,
      productId: purchase.productid,
      productName: product ? product.productName : "Product Not Found",
      shopId: purchase.shopId,
      shopName: shop ? shop.name : "Shop Not Found",
      quantity: purchase.quantity,
      price: purchase.price,
    };
  });

  // Send the filtered purchases with product and shop details
  res.send(result);
});

app.get("/shops/purchases/:id", function (req, res) {
  const id = req.params.id;

  // Find the shop based on the provided id
  const shop = data.shops.find((shop) => shop.shopId == id);

  if (!shop) {
    return res.status(404).send("Shop not found");
  }

  // Filter purchases for the specific shop
  const shopPurchases = data.purchases.filter((item) => item.shopId == id);

  // Include the shop name in each purchase record
  const result_pur = shopPurchases.map((purchase) => {
    return {
      ...purchase,
      shopName: shop.name,
    };
  });

  res.send(result_pur);
});

// shop add
app.post("/shops/add", function (req, res) {
  const newShop = req.body;
  if (!newShop.name || !newShop.rent) {
    return res.status(400).send({ error: "Name and rent are required" });
  }
  const shopAlreadyExists = data.shops.some((s) => s.name === newShop.name);
  if (shopAlreadyExists) {
    return res
      .status(400)
      .send({ error: "A Shop with this name already exists." });
  }
  let last_shop = data.shops.length;
  last_shop = last_shop + 1;
  newShop.shopId = last_shop;
  data.shops.push(newShop);
  res.send(data.shops);
});
// total purchase for shop
app.get("/shops/totalpurchases/:shopId", function (req, res) {
  const shopId = parseInt(req.params.shopId);

  // Find the shop based on the provided shopId
  const shop = data.shops.find((shop) => shop.shopId === shopId);

  if (!shop) {
    return res.status(404).send("Shop not found");
  }

  // Filter purchases for the specific shop
  const shopPurchases = data.purchases.filter(
    (purchase) => purchase.shopId === shopId
  );

  // Create a map to store the total quantity for each product
  const productTotalQuantityMap = new Map();

  // Aggregate total quantity for each product
  shopPurchases.forEach((purchase) => {
    const productId = purchase.productid;
    const quantity = purchase.quantity;

    if (productTotalQuantityMap.has(productId)) {
      // If product exists in the map, update the total quantity
      productTotalQuantityMap.set(
        productId,
        productTotalQuantityMap.get(productId) + quantity
      );
    } else {
      // If product doesn't exist in the map, add it with the initial quantity
      productTotalQuantityMap.set(productId, quantity);
    }
  });

  // Convert the map to an array of objects, including shop name
  const result = Array.from(
    productTotalQuantityMap,
    ([productId, totalQuantity]) => ({
      productId: productId,
      totalQuantity: totalQuantity,
      shopName: shop.name,
    })
  );

  res.send(result);
});

// product add
app.post("/products/add", function (req, res) {
  const newProduct = req.body;
  if (
    !newProduct.productName ||
    !newProduct.category ||
    !newProduct.description
  ) {
    return res
      .status(400)
      .send({ error: "Name, category and description are required" });
  }
  const productAlreadyExists = data.products.some(
    (s) => s.productName === newProduct.productName
  );
  if (productAlreadyExists) {
    return res
      .status(400)
      .send({ error: "A Product with this name already exists." });
  }
  let last_product = data.products.length;
  last_product = last_product + 1;
  newProduct.productId = last_product;
  data.products.push(newProduct);
  res.send(data.products);
});
// edit product
app.put("/products/edit/:id", function (req, res) {
  let id = +req.params.id;
  let body = req.body;
  let index = data.products.findIndex((st) => st.productId === id);
  let updatedProduct = { productId: id, ...body };
  data.products[index] = updatedProduct;
  res.send(updatedProduct);
});
// purchase for product
app.get("/products/purchases/:id", function (req, res) {
  const id = req.params.id;

  // Find the shop based on the provided id
  let product = data.products.find((product) => product.productId == id);

  if (!product) {
    return res.status(404).send("Product not found");
  }

  // Filter purchases for the specific shop
  const productPurchases = data.purchases.filter(
    (item) => item.productid == id
  );

  // Include the shop name in each purchase record
  const result_pur = productPurchases.map((purchase) => {
    return {
      ...purchase,
      productName: product.productName,
    };
  });

  res.send(result_pur);
});
// total purchase for product
app.get("/products/totalpurchases/:productId", function (req, res) {
  const productId = parseInt(req.params.productId);

  // Find the product based on the provided productId
  const product = data.products.find(
    (product) => product.productId === productId
  );

  if (!product) {
    return res.status(404).send("Product not found");
  }

  // Filter purchases for the specific product
  const productPurchases = data.purchases.filter(
    (purchase) => purchase.productid === productId
  );

  // Create a map to store the total quantity for each shop
  const shopTotalQuantityMap = new Map();

  // Aggregate total quantity for each shop
  productPurchases.forEach((purchase) => {
    const shopId = purchase.shopId;
    const quantity = purchase.quantity;

    if (shopTotalQuantityMap.has(shopId)) {
      // If shop exists in the map, update the total quantity
      shopTotalQuantityMap.set(
        shopId,
        shopTotalQuantityMap.get(shopId) + quantity
      );
    } else {
      // If shop doesn't exist in the map, add it with the initial quantity
      shopTotalQuantityMap.set(shopId, quantity);
    }
  });

  // Convert the map to an array of objects, including product name
  const result = Array.from(
    shopTotalQuantityMap,
    ([shopId, totalQuantity]) => ({
      shopId: shopId,
      totalQuantity: totalQuantity,
      productName: product.productName,
    })
  );

  res.send(result);
});
