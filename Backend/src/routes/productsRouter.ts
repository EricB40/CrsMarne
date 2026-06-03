import { Router } from "express";
import { getCategories, listProducts, getProductBySlug } from "../controllers/ProductController";


const router = Router();

// first route: GET /products, which will be prefixed with /api/products (see index.ts)
router.get("/", listProducts);
router.get("/categories", getCategories);
// the 3rd route will be dynamic
// dynamic route must be defined after the static routes, 
// otherwise it will catch all requests and the static routes will never be reached
// because for instance, if we type a catergory, it would serach for a product with that slug and
//  not find it, instead of returning the list of products in that category

router.get("/:slug", getProductBySlug);


export default router;