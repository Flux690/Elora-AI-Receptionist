import express from "express";
import cors from "cors";
import { env } from "./env.js";
import apiRoutes from "./api/index.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});