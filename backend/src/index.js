import express from "express";
import cors from "cors";
import config from "./config.js";
import apiRoutes from "./api/index.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRoutes);

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});