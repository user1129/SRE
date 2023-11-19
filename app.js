const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const promClient = require("prom-client");
const { performance } = require("perf_hooks");
const cors = require("cors");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "pages"));

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const prometheusMetrics = {
  httpRequestCounter: new promClient.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
  }),
  fiboDurationHistogram: new promClient.Histogram({
    name: "fibo_duration_seconds",
    help: "Histogram of Fibonacci calculation durations",
    buckets: [0.1, 0.5, 1, 5],
  }),
};

app.use((req, res, next) => {
  prometheusMetrics.httpRequestCounter.inc();
  next();
});

app.get("/metrics", async (req, res) => {
  try {
    const metrics = await promClient.register.metrics();
    res.set("Content-Type", promClient.register.contentType);
    res.end(metrics);
  } catch (err) {
    console.error("Error while fetching metrics:", err);
    res.status(500).send("Internal Server Error");
  }
});

const port = 4000;
const logsPath = path.resolve(__dirname, "data", "logs.txt");
const fiboPath = path.resolve(__dirname, "data", "fibo.txt");

app.get("/", async (req, res) => {
  const data = await fs.readFile(logsPath, "utf-8");
  const logs = data.split("\r\n").filter((i) => !!i);
  res.render("index", { logs });
});

app.get("/fibo", async (req, res) => {
  const data = await fs.readFile(fiboPath, "utf-8");
  const fibos = data.split("\r\n").filter((i) => !!i);
  await fs.truncate(fiboPath);
  res.render("fibo", { fibos });
});

app.post("/", async (req, res) => {
  const text = req.body.text;
  await fs.appendFile(logsPath, `${text}\r\n`);
  res.redirect("/");
});

app.post("/fibo", async (req, res) => {
  const text = req.body.text;
  const start = performance.now();
  let result = fibo(Number(text));
  const end = performance.now();
  const duration = end - start;
  console.log("Duration:", duration);
  await prometheusMetrics.fiboDurationHistogram.observe(duration / 1000);
  await fs.appendFile(fiboPath, `${result}\r\n`);
  res.redirect("/fibo");
});

const fibo = function (n) {
  if (n <= 2) return n;
  return fibo(n - 1) + fibo(n - 2);
};

app.listen(port, () => console.log(`Server listening on port ${port}`));
