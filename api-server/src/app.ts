import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import router from "./routes";
import ogRouter from "./routes/og";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// www → non-www canonical redirect (consolidates crawl authority)
app.use((req, res, next) => {
  const host = req.hostname;
  if (host.startsWith("www.")) {
    const canonical = `https://${host.slice(4)}${req.originalUrl}`;
    return res.redirect(301, canonical);
  }
  next();
});

app.use("/api", router);

// OG / bot-detection for article pages — must be at root level (not under /api)
app.use(ogRouter);

export default app;
