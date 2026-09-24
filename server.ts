import { server } from "./server/index.js";

const port = Number(process.env.PORT || 5173);
server.listen(port, () => {
  console.log(`WeatherAI Node server ready on port ${port}`);
});
